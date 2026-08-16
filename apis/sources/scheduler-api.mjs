#!/usr/bin/env node

// ============================================================
// SCHEDULER-API.MJS — Планировщик задач для Crucix
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const TASKS_FILE = join(ROOT, 'data', 'scheduler', 'tasks.json');
const LOGS_DIR = join(ROOT, 'logs', 'scheduler');

// ============================================================
// 1. ЗАДАЧИ ПО УМОЛЧАНИЮ
// ============================================================

const DEFAULT_TASKS = [
  {
    id: 'rss-update',
    name: 'Обновление RSS-лент',
    description: 'Проверка всех RSS-лент на новые записи',
    script: 'scripts/rss-updater.mjs',
    schedule: '0 */6 * * *',
    enabled: true,
    lastRun: null,
    lastStatus: null,
    lastLog: null,
    runCount: 0,
    failCount: 0
  },
  {
    id: 'collect-feeds',
    name: 'Сбор новостей из OPML',
    description: 'Сбор новостей из всех RSS-лент',
    script: 'scripts/collect-feeds.mjs',
    schedule: '0 */4 * * *',
    enabled: true,
    lastRun: null,
    lastStatus: null,
    lastLog: null,
    runCount: 0,
    failCount: 0
  },
  {
    id: 'ai-analyze-news',
    name: 'AI-анализ новостей',
    description: 'Оценка новых новостей через Ollama',
    script: 'scripts/ai-analyze-news.mjs',
    schedule: '0 */2 * * *',
    enabled: true,
    lastRun: null,
    lastStatus: null,
    lastLog: null,
    runCount: 0,
    failCount: 0
  },
  {
    id: 'update-global-index',
    name: 'Обновление глобального индекса',
    description: 'Расчёт глобального индекса напряжённости',
    script: 'scripts/update-global-index.mjs',
    schedule: '0 */12 * * *',
    enabled: true,
    lastRun: null,
    lastStatus: null,
    lastLog: null,
    runCount: 0,
    failCount: 0
  },
  {
    id: 'collect-newsapi',
    name: 'Сбор NewsAPI в корзину',
    description: 'Сбор новостей из NewsAPI в корзину',
    script: 'scripts/collect-newsapi.mjs',
    schedule: '0 */3 * * *',
    enabled: true,
    lastRun: null,
    lastStatus: null,
    lastLog: null,
    runCount: 0,
    failCount: 0
  },
  {
    id: 'cleanup-old-data',
    name: 'Очистка старых данных',
    description: 'Удаление данных старше N дней',
    script: 'scripts/cleanup-data.mjs',
    schedule: '0 3 * * *',
    enabled: true,
    lastRun: null,
    lastStatus: null,
    lastLog: null,
    runCount: 0,
    failCount: 0
  }
];

// ============================================================
// 2. КЛАСС ПЛАНИРОВЩИКА
// ============================================================

class Scheduler {
  constructor() {
    this.tasks = [];
    this.runningTasks = new Set();
    this.intervalId = null;
  }

  async loadTasks() {
    try {
      const data = await fs.readFile(TASKS_FILE, 'utf-8');
      this.tasks = JSON.parse(data);
      return this.tasks;
    } catch (e) {
      this.tasks = JSON.parse(JSON.stringify(DEFAULT_TASKS));
      await this.saveTasks();
      return this.tasks;
    }
  }

  async saveTasks() {
    const dir = join(ROOT, 'data', 'scheduler');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(TASKS_FILE, JSON.stringify(this.tasks, null, 2));
  }

  getTask(id) {
    return this.tasks.find(t => t.id === id);
  }

  async updateTask(id, updates) {
    const task = this.getTask(id);
    if (!task) throw new Error(`Задача "${id}" не найдена`);
    Object.assign(task, updates);
    await this.saveTasks();
    return task;
  }

  async toggleTask(id) {
    const task = this.getTask(id);
    if (!task) throw new Error(`Задача "${id}" не найдена`);
    task.enabled = !task.enabled;
    await this.saveTasks();
    return task;
  }

  async runTask(id) {
    const task = this.getTask(id);
    if (!task) throw new Error(`Задача "${id}" не найдена`);

    if (this.runningTasks.has(id)) {
      throw new Error(`Задача "${id}" уже выполняется`);
    }

    this.runningTasks.add(id);
    const startTime = Date.now();

    try {
      const logDir = LOGS_DIR;
      await fs.mkdir(logDir, { recursive: true });
      const logFile = join(logDir, `${id}-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);

      const scriptPath = join(ROOT, task.script);
      const command = `node "${scriptPath}" 2>&1 | tee "${logFile}"`;

      const { stdout, stderr } = await execAsync(command, {
        cwd: ROOT,
        timeout: 300000,
        maxBuffer: 10 * 1024 * 1024
      });

      const duration = Date.now() - startTime;
      const success = !stderr || !stderr.includes('Error');

      await this.updateTask(id, {
        lastRun: new Date().toISOString(),
        lastStatus: success ? 'success' : 'error',
        lastLog: logFile,
        runCount: task.runCount + 1,
        failCount: success ? task.failCount : task.failCount + 1
      });

      return { success, duration, logFile, output: stdout || stderr };
    } catch (e) {
      const duration = Date.now() - startTime;
      await this.updateTask(id, {
        lastRun: new Date().toISOString(),
        lastStatus: 'error',
        runCount: task.runCount + 1,
        failCount: task.failCount + 1
      });
      throw e;
    } finally {
      this.runningTasks.delete(id);
    }
  }

  async runAllEnabled() {
    const results = [];
    for (const task of this.tasks) {
      if (task.enabled) {
        try {
          const result = await this.runTask(task.id);
          results.push({ id: task.id, success: result.success, duration: result.duration });
        } catch (e) {
          results.push({ id: task.id, success: false, error: e.message });
        }
      }
    }
    return results;
  }

  getStats() {
    return {
      total: this.tasks.length,
      enabled: this.tasks.filter(t => t.enabled).length,
      running: this.runningTasks.size,
      success: this.tasks.filter(t => t.lastStatus === 'success').length,
      error: this.tasks.filter(t => t.lastStatus === 'error').length,
      neverRun: this.tasks.filter(t => t.lastRun === null).length
    };
  }

  getNextRun(schedule) {
    const parts = schedule.split(' ');
    if (parts.length !== 5) return Date.now() + 3600000;
    const [minute, hour] = parts;
    const now = new Date();
    const next = new Date(now);
    next.setHours(parseInt(hour) || 0);
    next.setMinutes(parseInt(minute) || 0);
    next.setSeconds(0);
    next.setMilliseconds(0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.getTime();
  }

  startScheduler() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(async () => {
      const now = Date.now();
      for (const task of this.tasks) {
        if (!task.enabled || this.runningTasks.has(task.id)) continue;
        if (now >= this.getNextRun(task.schedule)) {
          this.runTask(task.id).catch(e => console.error(`[Scheduler] Ошибка ${task.id}:`, e.message));
        }
      }
    }, 60000);
    console.log('[Scheduler] Планировщик запущен');
  }

  stopScheduler() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[Scheduler] Планировщик остановлен');
    }
  }
}

const scheduler = new Scheduler();

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

export async function handleSchedulerAPI(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  await scheduler.loadTasks();

  // Получение ID из пути
  function getTaskIdFromPath(pathname) {
    const parts = pathname.split('/').filter(p => p.length > 0);
    // /api/scheduler/tasks/ID/action
    if (parts.length >= 4 && parts[2] === 'tasks') {
      return parts[3];
    }
    return null;
  }

  // --- GET /api/scheduler/tasks ---
  if (path === '/api/scheduler/tasks' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      tasks: scheduler.tasks,
      stats: scheduler.getStats(),
      running: Array.from(scheduler.runningTasks)
    }));
    return;
  }

  // --- GET /api/scheduler/stats ---
  if (path === '/api/scheduler/stats' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, stats: scheduler.getStats() }));
    return;
  }

  // --- GET /api/scheduler/status ---
  if (path === '/api/scheduler/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      running: scheduler.intervalId !== null,
      tasks: scheduler.tasks.length,
      runningTasks: Array.from(scheduler.runningTasks)
    }));
    return;
  }

  // --- POST /api/scheduler/tasks/:id/run ---
  if (path.startsWith('/api/scheduler/tasks/') && path.endsWith('/run') && req.method === 'POST') {
    const id = getTaskIdFromPath(path);
    if (!id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'ID задачи не указан' }));
      return;
    }
    try {
      const result = await scheduler.runTask(id);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, result }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // --- POST /api/scheduler/tasks/:id/toggle ---
  if (path.startsWith('/api/scheduler/tasks/') && path.endsWith('/toggle') && req.method === 'POST') {
    const id = getTaskIdFromPath(path);
    if (!id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'ID задачи не указан' }));
      return;
    }
    try {
      const task = await scheduler.toggleTask(id);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, task }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // --- POST /api/scheduler/run-all ---
  if (path === '/api/scheduler/run-all' && req.method === 'POST') {
    try {
      const results = await scheduler.runAllEnabled();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, results }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // --- POST /api/scheduler/start ---
  if (path === '/api/scheduler/start' && req.method === 'POST') {
    scheduler.startScheduler();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Планировщик запущен' }));
    return;
  }

  // --- POST /api/scheduler/stop ---
  if (path === '/api/scheduler/stop' && req.method === 'POST') {
    scheduler.stopScheduler();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Планировщик остановлен' }));
    return;
  }

  // --- GET /api/scheduler/logs/:id ---
  if (path.startsWith('/api/scheduler/logs/') && req.method === 'GET') {
    const id = path.split('/').pop();
    const task = scheduler.getTask(id);
    if (!task || !task.lastLog) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Лог не найден' }));
      return;
    }
    try {
      const logContent = await fs.readFile(task.lastLog, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(logContent);
    } catch (e) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Не удалось прочитать лог' }));
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));
}

export default scheduler;
