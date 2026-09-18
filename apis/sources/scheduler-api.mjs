/**
 * apis/sources/scheduler-api.mjs — SERVICE-МОДУЛЬ: ПЛАНИРОВЩИК ЗАДАЧ
 *
 * КОНТРАКТ CRUCIX v2 (SERVICE, мультиметодный).
 * ИСТОЧНИК: data/scheduler/tasks.json — persist-файл со списком задач.
 * ЛОГИ: logs/scheduler/*.log — логи запусков.
 *
 * Планировщик задач Crucix: cron-подобные расписания (5 полей),
 * запуск скриптов проекта, управление задачами, история запусков.
 *
 * ПОЧЕМУ SERVICE:
 *   - Мультиметодный (GET + POST + DELETE).
 *   - Хранит состояние задач.
 *   - Не слой карты.
 *
 * БЕЗОПАСНОСТЬ:
 *   - Скрипты запускаются только из PROJECT_ROOT/scripts/**.
 *   - Валидация пути: script.startsWith('scripts/'), без '..', ';', '|', '&'.
 *   - Timeout 300 сек, maxBuffer 10 MB.
 *
 * ПУБЛИЧНЫЕ ЭНДПОИНТЫ:
 *   GET    /                     — корень
 *   GET    /status               — статус планировщика
 *   GET    /tasks                — список задач
 *   GET    /tasks/:id            — конкретная задача
 *   GET    /stats                — статистика
 *   GET    /logs/:id             — лог последнего запуска
 *   GET    /logs/:id/list        — список логов задачи
 *   GET    /schedule/:id/next    — следующий запуск
 *   GET    /render               — рендер-конфиг
 *   POST   /tasks                — создать задачу
 *   POST   /tasks/:id            — обновить
 *   POST   /tasks/:id/run        — запустить
 *   POST   /tasks/:id/toggle     — toggle enabled
 *   POST   /run-all              — запустить все включённые
 *   POST   /start                — запустить планировщик
 *   POST   /stop                 — остановить
 *   POST   /validate-cron        — проверить cron-выражение
 *   DELETE /tasks/:id            — удалить задачу
 *   DELETE /tasks                — сбросить к defaults (confirm)
 *
 * CRON: 5 полей (min hour day month weekday). Поддержка: звёздочка, шаг через дробь,
 *       конкретное значение, список через запятую, диапазон через дефис.
 * ФОРМАТЫ: json, csv, series, stats, raw.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const SCHEDULER_DIR = join(PROJECT_ROOT, 'data', 'scheduler');
const TASKS_FILE = join(SCHEDULER_DIR, 'tasks.json');
const LOGS_DIR = join(PROJECT_ROOT, 'logs', 'scheduler');

export const route = '/api/services/scheduler';
export const methods = ['GET', 'POST', 'DELETE'];

export const meta = {
  service: true,
  description: 'Планировщик задач: cron-расписания, запуск скриптов проекта, логи, управление задачами',
  cache: 0,
  version: '2.0.0',
};

// ============================================================
//  КОНСТАНТЫ
// ============================================================

const MAX_BODY_BYTES = 500_000;
const MAX_TASKS = 200;
const EXEC_TIMEOUT_MS = 300_000;
const MAX_BUFFER = 10 * 1024 * 1024;
const SCHEDULER_TICK_MS = 60_000;

// ============================================================
//  ЗАДАЧИ ПО УМОЛЧАНИЮ
// ============================================================

const DEFAULT_TASKS = [
  { id: 'rss-update',           name: 'Обновление RSS-лент',           description: 'Проверка всех RSS-лент на новые записи',       script: 'scripts/rss-updater.mjs',         schedule: '0 */6 * * *', enabled: true },
  { id: 'collect-feeds',        name: 'Сбор новостей из OPML',         description: 'Сбор новостей из всех RSS-лент в data/raw/',   script: 'scripts/collect-feeds.mjs',       schedule: '0 */4 * * *', enabled: true },
  { id: 'ai-analyze-news',      name: 'AI-анализ новостей',            description: 'Оценка новых новостей через Ollama',            script: 'scripts/ai-analyze-news.mjs',     schedule: '0 */2 * * *', enabled: true },
  { id: 'update-global-index',  name: 'Обновление глобального индекса', description: 'Расчёт глобального индекса напряжённости',     script: 'scripts/update-global-index.mjs', schedule: '0 */12 * * *', enabled: true },
  { id: 'collect-newsapi',      name: 'Сбор NewsAPI в корзину',        description: 'Сбор новостей из NewsAPI в корзину',            script: 'scripts/collect-newsapi.mjs',     schedule: '0 */3 * * *', enabled: true },
  { id: 'cleanup-old-data',     name: 'Очистка старых данных',         description: 'Удаление данных старше N дней',                 script: 'scripts/cleanup-data.mjs',        schedule: '0 3 * * *',   enabled: true },
];

// ============================================================
//  CRON-ПАРСЕР
// ============================================================

function parseCronField(field, min, max) {
  if (!field) return null;
  const out = new Set();
  for (const part of String(field).split(',')) {
    const p = part.trim();
    if (!p) return null;
    if (p === '*') {
      for (let i = min; i <= max; i++) out.add(i);
      continue;
    }
    const stepMatch = p.match(/^\*\/(\d+)$/);
    if (stepMatch) {
      const step = parseInt(stepMatch[1], 10);
      if (!Number.isFinite(step) || step <= 0) return null;
      for (let i = min; i <= max; i += step) out.add(i);
      continue;
    }
    const rangeMatch = p.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const a = parseInt(rangeMatch[1], 10);
      const b = parseInt(rangeMatch[2], 10);
      if (a < min || b > max || a > b) return null;
      for (let i = a; i <= b; i++) out.add(i);
      continue;
    }
    const singleMatch = p.match(/^(\d+)$/);
    if (singleMatch) {
      const n = parseInt(singleMatch[1], 10);
      if (n < min || n > max) return null;
      out.add(n);
      continue;
    }
    return null;
  }
  return out.size > 0 ? out : null;
}

function parseCron(expr) {
  if (!expr || typeof expr !== 'string') return null;
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const minutes = parseCronField(parts[0], 0, 59);
  const hours   = parseCronField(parts[1], 0, 23);
  const days    = parseCronField(parts[2], 1, 31);
  const months  = parseCronField(parts[3], 1, 12);
  const weekdays = parseCronField(parts[4], 0, 6);
  if (!minutes || !hours || !days || !months || !weekdays) return null;
  return { minutes, hours, days, months, weekdays, raw: expr.trim() };
}

function getNextRun(expr, from = new Date()) {
  const cron = parseCron(expr);
  if (!cron) return null;
  const start = new Date(from.getTime());
  start.setSeconds(0);
  start.setMilliseconds(0);
  start.setMinutes(start.getMinutes() + 1);
  const maxIter = 366 * 24 * 60;
  const cur = new Date(start.getTime());
  for (let i = 0; i < maxIter; i++) {
    if (
      cron.minutes.has(cur.getMinutes()) &&
      cron.hours.has(cur.getHours()) &&
      cron.days.has(cur.getDate()) &&
      cron.months.has(cur.getMonth() + 1) &&
      cron.weekdays.has(cur.getDay())
    ) {
      return cur.getTime();
    }
    cur.setMinutes(cur.getMinutes() + 1);
  }
  return null;
}

function validateCronExpression(expr) {
  const cron = parseCron(expr);
  if (!cron) return { valid: false, error: 'invalid_cron', hint: 'формат: minute hour day month weekday' };
  const next = getNextRun(expr);
  return {
    valid: true,
    expr: cron.raw,
    fields: {
      minutes: [...cron.minutes].sort((a, b) => a - b),
      hours: [...cron.hours].sort((a, b) => a - b),
      days: [...cron.days].sort((a, b) => a - b),
      months: [...cron.months].sort((a, b) => a - b),
      weekdays: [...cron.weekdays].sort((a, b) => a - b),
    },
    next_run_at: next ? new Date(next).toISOString() : null,
  };
}

// ============================================================
//  БЕЗОПАСНОСТЬ
// ============================================================

function isSafeScriptPath(script) {
  if (!script || typeof script !== 'string') return false;
  if (!script.startsWith('scripts/')) return false;
  if (script.includes('..')) return false;
  if (/[;&|`$><\n\r]/.test(script)) return false;
  if (!script.endsWith('.mjs')) return false;
  return true;
}

// ============================================================
//  СОСТОЯНИЕ ПЛАНИРОВЩИКА
// ============================================================

const runningTasks = new Set();
let schedulerInterval = null;
let schedulerStartedAt = null;

// ============================================================
//  ЗАГРУЗКА / СОХРАНЕНИЕ
// ============================================================

async function ensureDirs() {
  try { await fs.mkdir(SCHEDULER_DIR, { recursive: true }); } catch {}
  try { await fs.mkdir(LOGS_DIR, { recursive: true }); } catch {}
}

async function loadTasks() {
  await ensureDirs();
  let raw;
  try { raw = await fs.readFile(TASKS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const tasks = DEFAULT_TASKS.map(t => ({ ...t, lastRun: null, lastStatus: null, lastLog: null, runCount: 0, failCount: 0 }));
      await saveTasks(tasks);
      return { tasks, source: 'defaults' };
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { throw new Error('invalid_tasks_json: ' + e.message); }
  if (!Array.isArray(parsed)) throw new Error('tasks_json_not_array');
  const tasks = parsed.map(normalizeTask);
  return { tasks, source: 'file' };
}

async function saveTasks(tasks) {
  await ensureDirs();
  const tmp = `${TASKS_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(tasks, null, 2), 'utf8');
  await fs.rename(tmp, TASKS_FILE);
  return { ok: true };
}

function normalizeTask(t) {
  return {
    id: String(t.id || '').trim(),
    name: t.name || t.id || 'Без названия',
    description: t.description || null,
    script: t.script || null,
    schedule: t.schedule || '0 * * * *',
    enabled: t.enabled !== false,
    lastRun: t.lastRun || null,
    lastStatus: t.lastStatus || null,
    lastLog: t.lastLog || null,
    runCount: Number(t.runCount) || 0,
    failCount: Number(t.failCount) || 0,
  };
}

// ============================================================
//  ЗАПУСК ЗАДАЧИ
// ============================================================

async function runTask(taskId, tasks) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) { const e = new Error('task_not_found'); e.statusCode = 404; e.taskId = taskId; throw e; }
  if (!isSafeScriptPath(task.script)) {
    const e = new Error('unsafe_script_path'); e.statusCode = 400; e.script = task.script; throw e;
  }
  if (runningTasks.has(taskId)) {
    const e = new Error('task_already_running'); e.statusCode = 409; e.taskId = taskId; throw e;
  }

  runningTasks.add(taskId);
  const startTime = Date.now();
  const startISO = new Date(startTime).toISOString();
  const logFilename = `${taskId}-${startISO.replace(/[:.]/g, '-')}.log`;
  const logPath = join(LOGS_DIR, logFilename);

  try {
    const scriptPath = join(PROJECT_ROOT, task.script);
    const command = `node "${scriptPath}" 2>&1 | tee "${logPath}"`;

    let stdout = '', stderr = '';
    let success = false;

    try {
      const result = await execAsync(command, {
        cwd: PROJECT_ROOT,
        timeout: EXEC_TIMEOUT_MS,
        maxBuffer: MAX_BUFFER,
      });
      stdout = result.stdout || '';
      stderr = result.stderr || '';
      success = true;
    } catch (execErr) {
      stdout = execErr.stdout || '';
      stderr = execErr.stderr || execErr.message;
      success = false;
    }

    const duration = Date.now() - startTime;
    const nowISO = new Date().toISOString();

    task.lastRun = nowISO;
    task.lastStatus = success ? 'success' : 'error';
    task.lastLog = logPath;
    task.runCount = (task.runCount || 0) + 1;
    if (!success) task.failCount = (task.failCount || 0) + 1;

    await saveTasks(tasks);

    return { success, duration, logFile: logPath, output: (stdout || stderr || '').slice(0, 10000) };
  } finally {
    runningTasks.delete(taskId);
  }
}

// ============================================================
//  ПЛАНИРОВЩИК
// ============================================================

function startScheduler() {
  if (schedulerInterval) return { alreadyRunning: true };
  schedulerStartedAt = new Date().toISOString();

  schedulerInterval = setInterval(async () => {
    try {
      const { tasks } = await loadTasks();
      const now = Date.now();
      for (const task of tasks) {
        if (!task.enabled) continue;
        if (runningTasks.has(task.id)) continue;
        const next = getNextRun(task.schedule);
        if (next && now >= next - 30000 && now <= next + 30000) {
          runTask(task.id, tasks).catch(e => console.error(`[scheduler] ${task.id}:`, e.message));
        }
      }
    } catch (e) {
      console.error('[scheduler] tick error:', e.message);
    }
  }, SCHEDULER_TICK_MS);

  return { started: true };
}

function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    schedulerStartedAt = null;
    return { stopped: true };
  }
  return { alreadyStopped: true };
}

function schedulerStatus() {
  return {
    running: schedulerInterval !== null,
    started_at: schedulerStartedAt,
    tick_interval_ms: SCHEDULER_TICK_MS,
    running_tasks: [...runningTasks],
  };
}

// ============================================================
//  СТАТИСТИКА / ЛОГИ
// ============================================================

function computeStats(tasks) {
  return {
    total: tasks.length,
    enabled: tasks.filter(t => t.enabled).length,
    disabled: tasks.filter(t => !t.enabled).length,
    running: runningTasks.size,
    success: tasks.filter(t => t.lastStatus === 'success').length,
    error: tasks.filter(t => t.lastStatus === 'error').length,
    never_run: tasks.filter(t => !t.lastRun).length,
    total_runs: tasks.reduce((s, t) => s + (t.runCount || 0), 0),
    total_fails: tasks.reduce((s, t) => s + (t.failCount || 0), 0),
  };
}

async function listTaskLogs(taskId, limit = 20) {
  await ensureDirs();
  let files;
  try { files = await fs.readdir(LOGS_DIR); } catch { return []; }
  const matched = files.filter(f => f.startsWith(`${taskId}-`) && f.endsWith('.log'));
  const withStat = await Promise.all(matched.map(async f => {
    try {
      const st = await fs.stat(join(LOGS_DIR, f));
      return { filename: f, size: st.size, mtime: st.mtime.toISOString(), mtime_ms: st.mtime.getTime() };
    } catch { return null; }
  }));
  const clean = withStat.filter(Boolean).sort((a, b) => b.mtime_ms - a.mtime_ms).slice(0, limit);
  return clean;
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toCSV(tasks) {
  const lines = ['id,name,script,schedule,enabled,lastRun,lastStatus,runCount,failCount'];
  const esc = v => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  for (const t of tasks) lines.push([t.id, t.name, t.script, t.schedule, t.enabled, t.lastRun, t.lastStatus, t.runCount, t.failCount].map(esc).join(','));
  return lines.join('\n') + '\n';
}

function toSeries(tasks) {
  return tasks.map(t => ({
    id: t.id, name: t.name, schedule: t.schedule, enabled: t.enabled,
    lastRun: t.lastRun, lastStatus: t.lastStatus,
    nextRun: getNextRun(t.schedule) ? new Date(getNextRun(t.schedule)).toISOString() : null,
    runCount: t.runCount, failCount: t.failCount,
  }));
}

function sendJSON(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': String(Buffer.byteLength(body)), ...extra });
  res.end(body);
}

function sendText(res, status, text, ct = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': ct, 'Content-Length': String(Buffer.byteLength(text, 'utf8')) });
  res.end(text);
}

function readBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', c => {
      total += c.length;
      if (total > maxBytes) { req.destroy(); reject(new Error('body_too_large')); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      const raw = Buffer.concat(chunks).toString('utf8');
      try { resolve(JSON.parse(raw)); }
      catch (e) { reject(new Error('invalid_json_body: ' + e.message)); }
    });
    req.on('error', reject);
  });
}

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  const extra = {
    'X-Service': 'scheduler',
    'X-Service-Version': meta.version,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/services\/scheduler/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
      res.end();
      return;
    }

    let loaded;
    try { loaded = await loadTasks(); }
    catch (e) { return sendJSON(res, 500, { success: false, error: 'load_error', message: e.message }, extra); }
    const { tasks, source } = loaded;

    if (req.method === 'GET') {
      if (sub === '/' || sub === '') {
        return sendJSON(res, 200, {
          service: 'scheduler',
          version: meta.version,
          description: meta.description,
          tasks_count: tasks.length,
          stats: computeStats(tasks),
          endpoints: {
            'GET /status': 'статус планировщика',
            'GET /tasks': 'список задач',
            'GET /tasks/:id': 'конкретная задача',
            'GET /stats': 'статистика',
            'GET /logs/:id': 'лог последнего запуска',
            'GET /logs/:id/list': 'список логов',
            'GET /schedule/:id/next': 'следующий запуск',
            'GET /render': 'рендер-конфиг',
            'POST /tasks': 'создать',
            'POST /tasks/:id': 'обновить',
            'POST /tasks/:id/run': 'запустить',
            'POST /tasks/:id/toggle': 'toggle',
            'POST /run-all': 'запустить все',
            'POST /start': 'запустить планировщик',
            'POST /stop': 'остановить',
            'POST /validate-cron': 'проверить cron',
            'DELETE /tasks/:id': 'удалить',
            'DELETE /tasks': 'сбросить к defaults (confirm)',
          },
        }, extra);
      }

      if (sub === '/status') {
        return sendJSON(res, 200, {
          success: true,
          module: 'scheduler',
          ...schedulerStatus(),
          tasks: tasks.length,
          stats: computeStats(tasks),
          source,
          timestamp: new Date().toISOString(),
        }, extra);
      }

      if (sub === '/tasks') {
        if (format === 'csv') return sendText(res, 200, toCSV(tasks), 'text/csv; charset=utf-8');
        if (format === 'series') return sendJSON(res, 200, { series: toSeries(tasks), count: tasks.length }, extra);
        if (format === 'raw') return sendJSON(res, 200, { data: tasks, total: tasks.length }, extra);
        return sendJSON(res, 200, {
          success: true,
          tasks,
          stats: computeStats(tasks),
          running: [...runningTasks],
          source,
        }, extra);
      }

      if (sub.startsWith('/tasks/')) {
        const id = decodeURIComponent(sub.slice('/tasks/'.length));
        const task = tasks.find(t => t.id === id);
        if (!task) return sendJSON(res, 404, { success: false, error: 'task_not_found', id }, extra);
        const next = getNextRun(task.schedule);
        return sendJSON(res, 200, {
          success: true,
          task,
          next_run_at: next ? new Date(next).toISOString() : null,
          running: runningTasks.has(id),
        }, extra);
      }

      if (sub === '/stats' || format === 'stats') {
        return sendJSON(res, 200, { success: true, stats: computeStats(tasks) }, extra);
      }

      if (sub.startsWith('/logs/')) {
        const rest = sub.slice('/logs/'.length);
        if (rest.endsWith('/list')) {
          const id = decodeURIComponent(rest.slice(0, -'/list'.length));
          const list = await listTaskLogs(id, parseInt(query.limit, 10) || 20);
          return sendJSON(res, 200, { success: true, task_id: id, count: list.length, logs: list }, extra);
        }
        const id = decodeURIComponent(rest);
        const task = tasks.find(t => t.id === id);
        if (!task) return sendJSON(res, 404, { success: false, error: 'task_not_found', id }, extra);
        if (!task.lastLog) return sendJSON(res, 404, { success: false, error: 'no_log', id }, extra);
        try {
          const content = await fs.readFile(task.lastLog, 'utf8');
          return sendText(res, 200, content, 'text/plain; charset=utf-8');
        } catch (e) {
          return sendJSON(res, 404, { success: false, error: 'log_not_readable', message: e.message }, extra);
        }
      }

      if (sub.startsWith('/schedule/')) {
        const rest = sub.slice('/schedule/'.length);
        if (rest.endsWith('/next')) {
          const id = decodeURIComponent(rest.slice(0, -'/next'.length));
          const task = tasks.find(t => t.id === id);
          if (!task) return sendJSON(res, 404, { success: false, error: 'task_not_found', id }, extra);
          const next = getNextRun(task.schedule);
          return sendJSON(res, 200, {
            success: true, id,
            schedule: task.schedule,
            next_run_at: next ? new Date(next).toISOString() : null,
            next_run_ms: next,
          }, extra);
        }
        return sendJSON(res, 400, { success: false, error: 'invalid_path', hint: '/schedule/:id/next' }, extra);
      }

      if (sub === '/render') {
        return sendJSON(res, 200, {
          render: {
            type: 'table',
            columns: ['name', 'schedule', 'enabled', 'lastStatus', 'lastRun', 'nextRun'],
            tasks: toSeries(tasks),
            stats: computeStats(tasks),
            scheduler: schedulerStatus(),
          },
        }, extra);
      }

      return sendJSON(res, 404, {
        success: false,
        error: 'endpoint_not_found',
        path: sub,
        available: ['/', '/status', '/tasks', '/tasks/:id', '/stats', '/logs/:id', '/logs/:id/list', '/schedule/:id/next', '/render'],
      }, extra);
    }

    if (req.method === 'POST') {
      let body;
      try { body = await readBody(req); }
      catch (e) { return sendJSON(res, 400, { success: false, error: 'invalid_body', message: e.message }, extra); }

      if (sub === '/tasks') {
        const id = String(body.id || '').trim();
        if (!id) return sendJSON(res, 400, { success: false, error: 'field_required: id' }, extra);
        if (tasks.find(t => t.id === id)) return sendJSON(res, 409, { success: false, error: 'task_exists', id }, extra);
        if (tasks.length >= MAX_TASKS) return sendJSON(res, 409, { success: false, error: 'limit_reached', max: MAX_TASKS }, extra);

        const script = String(body.script || '');
        if (!isSafeScriptPath(script)) return sendJSON(res, 400, { success: false, error: 'unsafe_script_path', script }, extra);

        const schedule = String(body.schedule || '0 * * * *');
        if (!parseCron(schedule)) return sendJSON(res, 400, { success: false, error: 'invalid_cron', schedule }, extra);

        const newTask = {
          id,
          name: String(body.name || id),
          description: body.description || null,
          script,
          schedule,
          enabled: body.enabled !== false,
          lastRun: null, lastStatus: null, lastLog: null,
          runCount: 0, failCount: 0,
        };
        tasks.push(newTask);
        await saveTasks(tasks);
        return sendJSON(res, 200, { success: true, task: newTask, total: tasks.length }, extra);
      }

      if (sub === '/run-all') {
        const enabled = tasks.filter(t => t.enabled && !runningTasks.has(t.id));
        const results = [];
        for (const task of enabled) {
          try {
            const r = await runTask(task.id, tasks);
            results.push({ id: task.id, success: r.success, duration: r.duration });
          } catch (e) {
            results.push({ id: task.id, success: false, error: e.message });
          }
        }
        return sendJSON(res, 200, { success: true, total: results.length, results, stats: computeStats(tasks) }, extra);
      }

      if (sub === '/start') {
        const r = startScheduler();
        return sendJSON(res, 200, { success: true, ...r, ...schedulerStatus() }, extra);
      }

      if (sub === '/stop') {
        const r = stopScheduler();
        return sendJSON(res, 200, { success: true, ...r, ...schedulerStatus() }, extra);
      }

      if (sub === '/validate-cron') {
        const expr = String(body.expr || body.schedule || '').trim();
        if (!expr) return sendJSON(res, 400, { success: false, error: 'field_required: expr' }, extra);
        const result = validateCronExpression(expr);
        return sendJSON(res, result.valid ? 200 : 400, { success: result.valid, ...result }, extra);
      }

      if (sub.startsWith('/tasks/')) {
        const rest = sub.slice('/tasks/'.length);
        const parts = rest.split('/');
        const id = decodeURIComponent(parts[0]);
        const action = parts[1] || null;

        const task = tasks.find(t => t.id === id);
        if (!task) return sendJSON(res, 404, { success: false, error: 'task_not_found', id }, extra);

        if (action === 'run') {
          try {
            const result = await runTask(id, tasks);
            return sendJSON(res, 200, { success: true, result }, extra);
          } catch (e) {
            return sendJSON(res, e.statusCode || 400, { success: false, error: e.message, taskId: id }, extra);
          }
        }

        if (action === 'toggle') {
          task.enabled = !task.enabled;
          await saveTasks(tasks);
          return sendJSON(res, 200, { success: true, task }, extra);
        }

        if (!action) {
          if (body.name !== undefined) task.name = String(body.name);
          if (body.description !== undefined) task.description = body.description;
          if (body.schedule !== undefined) {
            const s = String(body.schedule);
            if (!parseCron(s)) return sendJSON(res, 400, { success: false, error: 'invalid_cron', schedule: s }, extra);
            task.schedule = s;
          }
          if (body.script !== undefined) {
            const s = String(body.script);
            if (!isSafeScriptPath(s)) return sendJSON(res, 400, { success: false, error: 'unsafe_script_path', script: s }, extra);
            task.script = s;
          }
          if (body.enabled !== undefined) task.enabled = body.enabled !== false;
          await saveTasks(tasks);
          return sendJSON(res, 200, { success: true, task }, extra);
        }

        return sendJSON(res, 404, { success: false, error: 'unknown_action', action }, extra);
      }

      return sendJSON(res, 404, {
        success: false,
        error: 'post_endpoint_not_found',
        path: sub,
        available: ['/tasks', '/tasks/:id', '/tasks/:id/run', '/tasks/:id/toggle', '/run-all', '/start', '/stop', '/validate-cron'],
      }, extra);
    }

    if (req.method === 'DELETE') {
      if (sub === '/tasks') {
        let body;
        try { body = await readBody(req); } catch { body = {}; }
        if (body.confirm !== true) {
          return sendJSON(res, 400, {
            success: false,
            error: 'confirmation_required',
            hint: 'send DELETE /api/services/scheduler/tasks with body {"confirm": true}',
            will_remove: tasks.length,
          }, extra);
        }
        const defaults = DEFAULT_TASKS.map(t => ({ ...t, lastRun: null, lastStatus: null, lastLog: null, runCount: 0, failCount: 0 }));
        await saveTasks(defaults);
        return sendJSON(res, 200, { success: true, reset_to_defaults: true, total: defaults.length }, extra);
      }

      if (sub.startsWith('/tasks/')) {
        const id = decodeURIComponent(sub.slice('/tasks/'.length));
        const idx = tasks.findIndex(t => t.id === id);
        if (idx === -1) return sendJSON(res, 404, { success: false, error: 'task_not_found', id }, extra);
        const removed = tasks.splice(idx, 1)[0];
        await saveTasks(tasks);
        return sendJSON(res, 200, { success: true, removed: { id: removed.id, name: removed.name }, total: tasks.length }, extra);
      }

      return sendJSON(res, 404, { success: false, error: 'delete_endpoint_not_found', path: sub, available: ['/tasks', '/tasks/:id'] }, extra);
    }

    return sendJSON(res, 405, { success: false, error: 'method_not_allowed', allowed: methods }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { success: false, error: status === 400 ? 'bad_request' : 'handler_error', message: e.message };
    try { sendJSON(res, status, payload, extra); } catch {}
  }
}
