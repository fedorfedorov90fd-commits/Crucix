/**
 * apis/sources/scan-pages-api.mjs — API-МОДУЛЬ: СКАНЕР ФАЙЛОВОЙ СИСТЕМЫ
 *
 * КОНТРАКТ CRUCIX v2 (Layer).
 * ИСТОЧНИК: сканирование файловой системы проекта в реальном времени.
 *   - dashboard/public/*.html           — HTML-страницы интерфейса
 *   - apis/sources/*.mjs                — API-модули
 *   - scripts/*.mjs                     — системные скрипты
 *   - scripts/collectors/collect-*.mjs  — сборщики данных
 *   - data/help/{ru,en}/*.{md,txt}      — справки
 *   - server.mjs, diag.mjs, crucix.config.mjs — корневые файлы
 *
 * Полный инвентарь проекта Crucix: страницы, API-модули, сборщики, скрипты,
 * справки, размеры, даты модификации, URL, категории, дерево, дубликаты, аудит.
 * Используется для диагностики, инвентаризации и страницы /registry.
 *
 * ФОРМАТЫ: json (items + stats + tree), csv, series, stats, raw, tree, inventory, summary, report.
 * ФИЛЬТРЫ: ?type=, ?category=, ?q=, ?ext=, ?min_size=, ?max_size=, ?modified_since=,
 *          ?modified_before=, ?sort=, ?limit=, ?top=.
 *
 * СЛУЖЕБНЫЕ ПОДПУТИ:
 *   GET /                       — все файлы + сводка + дерево
 *   GET /stats                  — агрегированная статистика
 *   GET /status                 — health-check
 *   GET /health                 — расширенный health (проверка корней)
 *   GET /config                 — конфигурация (директории, категории, цвета)
 *   GET /counts                 — только числа по категориям
 *   GET /html                   — HTML-страницы
 *   GET /api                    — все API-модули
 *   GET /api-real               — только *-api.mjs
 *   GET /collectors             — сборщики
 *   GET /scripts                — скрипты
 *   GET /root                   — корневые файлы
 *   GET /help                   — справки
 *   GET /tree                   — дерево по категориям
 *   GET /biggest?n=N            — топ-N по размеру
 *   GET /recent?n=N             — недавно модифицированные
 *   GET /duplicates             — файлы с одинаковым базовым именем
 *   GET /audit                  — аудит покрытия справками
 *   GET /orphans                — страницы/модули без справки
 *   GET /search?q=              — текстовый поиск
 *   GET /by-ext                 — группировка по расширениям
 *   GET /by-category            — группировка по категориям
 *   GET /by-size                — распределение по размерным бакетам
 *   GET /modified?since=        — изменённые после даты
 *   GET /full-inventory         — полный текстовый инвентарь
 *   GET /timeline               — динамика модификаций по дням
 *   GET /trends                 — топ изменений за период
 *   GET /compare?files=a,b,c    — сравнение размеров файлов
 *   GET /filter-presets         — готовые фильтры для UI
 *   GET /export                 — текстовый отчёт
 *   GET /reset-cache            — сброс кэша (сканирование свежее)
 *   GET /render                 — рендер-конфиг (таблица + дерево)
 */

import { promises as fs } from 'fs';
import { join, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const PUBLIC_DIR = join(PROJECT_ROOT, 'dashboard', 'public');
const API_DIR = join(PROJECT_ROOT, 'apis', 'sources');
const SCRIPTS_DIR = join(PROJECT_ROOT, 'scripts');
const COLLECTORS_DIR = join(SCRIPTS_DIR, 'collectors');
const HELP_DIR = join(PROJECT_ROOT, 'data', 'help');
const ROOT_SCRIPTS = ['server.mjs', 'diag.mjs', 'crucix.config.mjs'];

export const route  = '/api/layers/scan-pages';
export const method = 'GET';

export const meta = {
  category: 'infrastructure',
  icon: '🗂️',
  color: '#64748b',
  vizType: 'marker',
  source: null,
  collector: null,
  cache: 60,
  description: 'Сканер ФС: HTML-страницы, API-модули, сборщики, скрипты, справки, аудит проекта',
  unit: 'files',
};

const TYPE_COLORS = {
  'Страница':  '#3b82f6',
  'API':       '#22c55e',
  'Сборщик':   '#f97316',
  'Скрипт':    '#a855f7',
  'Корневой':  '#dc2626',
  'Помощь':    '#eab308',
  'unknown':   '#64748b',
};

const CATEGORY_MAP = {
  html: 'Страница',
  api: 'API',
  collector: 'Сборщик',
  script: 'Скрипт',
  root: 'Корневой',
  help: 'Помощь',
};

const SIZE_BUCKETS = [
  { min: 0,     max: 1024,         label: '< 1 KB',      color: '#22c55e' },
  { min: 1024,  max: 10 * 1024,    label: '1-10 KB',     color: '#84cc16' },
  { min: 10 * 1024, max: 50 * 1024, label: '10-50 KB',   color: '#eab308' },
  { min: 50 * 1024, max: 100 * 1024, label: '50-100 KB', color: '#f97316' },
  { min: 100 * 1024, max: Infinity, label: '> 100 KB',   color: '#dc2626' },
];

const FILTER_PRESETS = [
  { id: 'all',       label: 'Все файлы',              params: {} },
  { id: 'html',      label: 'Только страницы',        params: { category: 'html' } },
  { id: 'api-real',  label: 'Только API-модули',      params: { category: 'api', q: '-api.mjs' } },
  { id: 'collectors',label: 'Только сборщики',        params: { category: 'collector' } },
  { id: 'big',       label: 'Файлы > 50 KB',          params: { min_size: 51200 } },
  { id: 'recent',    label: 'Изменённые за 7 дней',   params: { modified_since: '7d' } },
  { id: 'help',      label: 'Только справки',         params: { category: 'help' } },
];

// ============================================================
//  IN-MEMORY КЭШ
// ============================================================

const _cache = new Map();
const CACHE_TTL = 30_000;
function cacheGet(key) {
  const item = _cache.get(key);
  if (!item) return null;
  if (item.expires < Date.now()) { _cache.delete(key); return null; }
  return item.value;
}
function cachePut(key, value) { _cache.set(key, { value, expires: Date.now() + CACHE_TTL }); }
function cacheClear() { _cache.clear(); return _cache.size; }

// ============================================================
//  УТИЛИТЫ
// ============================================================

function formatSize(bytes) {
  if (!bytes || bytes < 1) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function parseSince(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (s.endsWith('d')) {
    const n = parseInt(s, 10);
    if (Number.isFinite(n)) return Date.now() - n * 86400000;
  }
  if (s.endsWith('h')) {
    const n = parseInt(s, 10);
    if (Number.isFinite(n)) return Date.now() - n * 3600000;
  }
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : null;
}

async function safeReaddir(dir) {
  try { return await fs.readdir(dir); } catch (e) { return []; }
}

async function statFile(path) {
  try {
    const st = await fs.stat(path);
    return { size: st.size, mtime: st.mtime.toISOString(), mtime_ms: st.mtime.getTime() };
  } catch (e) { return { size: 0, mtime: null, mtime_ms: 0 }; }
}

async function fileExists(p) {
  try { await fs.access(p); return true; } catch (e) { return false; }
}

async function isDir(p) {
  try { const st = await fs.stat(p); return st.isDirectory(); } catch (e) { return false; }
}

function bucketOf(size) {
  for (const b of SIZE_BUCKETS) {
    if (size >= b.min && size < b.max) return b;
  }
  return SIZE_BUCKETS[SIZE_BUCKETS.length - 1];
}

// ============================================================
//  СКАНИРОВАНИЕ
// ============================================================

async function scanHtmlPages() {
  const files = await safeReaddir(PUBLIC_DIR);
  const result = [];
  for (const f of files) {
    if (!f.endsWith('.html') || f.startsWith('.')) continue;
    const full = join(PUBLIC_DIR, f);
    if (await isDir(full)) continue;
    const st = await statFile(full);
    result.push({
      id: f.replace('.html', ''),
      file: f,
      url: '/' + f.replace('.html', ''),
      type: 'Страница',
      category: 'html',
      typeColor: TYPE_COLORS['Страница'],
      ext: '.html',
      size: st.size,
      sizeFormatted: formatSize(st.size),
      mtime: st.mtime,
      mtimeMs: st.mtime_ms,
      description: 'HTML-страница интерфейса',
    });
  }
  return result;
}

async function scanApiModules() {
  const files = await safeReaddir(API_DIR);
  const result = [];
  for (const f of files) {
    if (!f.endsWith('.mjs') || f.startsWith('.')) continue;
    const full = join(API_DIR, f);
    if (await isDir(full)) continue;
    const st = await statFile(full);
    const isRealApi = f.endsWith('-api.mjs');
    const id = f.replace(/-api\.mjs$/, '').replace(/\.mjs$/, '');
    result.push({
      id,
      file: f,
      url: isRealApi ? '/api/layers/' + id : '/api/' + id,
      type: 'API',
      category: 'api',
      typeColor: TYPE_COLORS['API'],
      ext: '.mjs',
      size: st.size,
      sizeFormatted: formatSize(st.size),
      mtime: st.mtime,
      mtimeMs: st.mtime_ms,
      description: isRealApi ? 'API-модуль слоя' : 'Вспомогательный модуль',
      isApi: isRealApi,
    });
  }
  return result;
}

async function scanCollectors() {
  const files = await safeReaddir(COLLECTORS_DIR);
  const result = [];
  for (const f of files) {
    if (!f.endsWith('.mjs') || f.startsWith('.')) continue;
    const full = join(COLLECTORS_DIR, f);
    if (await isDir(full)) continue;
    const st = await statFile(full);
    result.push({
      id: f.replace('.mjs', ''),
      file: f,
      url: '/scripts/collectors/' + f,
      type: 'Сборщик',
      category: 'collector',
      typeColor: TYPE_COLORS['Сборщик'],
      ext: '.mjs',
      size: st.size,
      sizeFormatted: formatSize(st.size),
      mtime: st.mtime,
      mtimeMs: st.mtime_ms,
      description: 'Сборщик данных из внешних источников',
    });
  }
  return result;
}

async function scanScripts() {
  const files = await safeReaddir(SCRIPTS_DIR);
  const result = [];
  for (const f of files) {
    if (!f.endsWith('.mjs') || f.startsWith('.')) continue;
    const full = join(SCRIPTS_DIR, f);
    if (await isDir(full)) continue;
    const st = await statFile(full);
    result.push({
      id: f.replace('.mjs', ''),
      file: f,
      url: '/scripts/' + f,
      type: 'Скрипт',
      category: 'script',
      typeColor: TYPE_COLORS['Скрипт'],
      ext: '.mjs',
      size: st.size,
      sizeFormatted: formatSize(st.size),
      mtime: st.mtime,
      mtimeMs: st.mtime_ms,
      description: 'Системный скрипт или утилита',
    });
  }
  return result;
}

async function scanRootScripts() {
  const result = [];
  for (const f of ROOT_SCRIPTS) {
    const full = join(PROJECT_ROOT, f);
    const st = await statFile(full);
    if (st.size === 0) continue;
    result.push({
      id: f.replace('.mjs', ''),
      file: f,
      url: '/' + f,
      type: 'Корневой',
      category: 'root',
      typeColor: TYPE_COLORS['Корневой'],
      ext: '.mjs',
      size: st.size,
      sizeFormatted: formatSize(st.size),
      mtime: st.mtime,
      mtimeMs: st.mtime_ms,
      description: 'Корневой файл проекта',
    });
  }
  return result;
}

async function scanHelp() {
  const result = [];
  for (const lang of ['ru', 'en']) {
    const dir = join(HELP_DIR, lang);
    const files = await safeReaddir(dir);
    for (const f of files) {
      if (!f.endsWith('.md') && !f.endsWith('.txt')) continue;
      const full = join(dir, f);
      if (await isDir(full)) continue;
      const st = await statFile(full);
      result.push({
        id: `${lang}-${f.replace(/\.(md|txt)$/, '')}`,
        file: `${lang}/${f}`,
        url: `/data/help/${lang}/${f}`,
        type: 'Помощь',
        category: 'help',
        typeColor: TYPE_COLORS['Помощь'],
        ext: extname(f),
        size: st.size,
        sizeFormatted: formatSize(st.size),
        mtime: st.mtime,
        mtimeMs: st.mtime_ms,
        description: `Справка (${lang})`,
        lang,
      });
    }
  }
  return result;
}

async function scanAll() {
  const cached = cacheGet('scan-all');
  if (cached) return cached;
  const [html, api, collectors, scripts, root, help] = await Promise.all([
    scanHtmlPages(),
    scanApiModules(),
    scanCollectors(),
    scanScripts(),
    scanRootScripts(),
    scanHelp(),
  ]);
  const all = [...html, ...api, ...collectors, ...scripts, ...root, ...help];
  const result = { all, html, api, collectors, scripts, root, help };
  cachePut('scan-all', result);
  return result;
}

// ============================================================
//  ФИЛЬТРЫ
// ============================================================

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.type) {
    const t = String(query.type).toLowerCase();
    r = r.filter(x => x.type.toLowerCase().includes(t));
  }
  if (query.category) r = r.filter(x => x.category === String(query.category).toLowerCase());
  if (query.ext)      r = r.filter(x => x.ext === String(query.ext));
  if (query.lang)     r = r.filter(x => x.lang === String(query.lang));
  if (query.q) {
    const q = String(query.q).toLowerCase();
    r = r.filter(x => (x.file + ' ' + x.id + ' ' + (x.url || '') + ' ' + (x.description || '')).toLowerCase().includes(q));
  }
  if (query.min_size != null) { const n = Number(query.min_size); if (Number.isFinite(n)) r = r.filter(x => x.size >= n); }
  if (query.max_size != null) { const n = Number(query.max_size); if (Number.isFinite(n)) r = r.filter(x => x.size <= n); }
  if (query.modified_since) {
    const t = parseSince(query.modified_since);
    if (t != null) r = r.filter(x => x.mtimeMs >= t);
  }
  if (query.modified_before) {
    const t = parseSince(query.modified_before);
    if (t != null) r = r.filter(x => x.mtimeMs <= t);
  }

  const sortKey = query.sort || null;
  if (sortKey === 'size-desc')    r.sort((a, b) => b.size - a.size);
  else if (sortKey === 'size-asc') r.sort((a, b) => a.size - b.size);
  else if (sortKey === 'name')     r.sort((a, b) => a.file.localeCompare(b.file));
  else if (sortKey === 'mtime-desc') r.sort((a, b) => b.mtimeMs - a.mtimeMs);
  else if (sortKey === 'mtime-asc')  r.sort((a, b) => a.mtimeMs - b.mtimeMs);
  else if (sortKey === 'type')     r.sort((a, b) => a.type.localeCompare(b.type));

  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(scan, rows) {
  const byType = {};
  const byCategory = {};
  const byExt = {};
  let totalSize = 0;
  for (const x of rows) {
    byType[x.type] = (byType[x.type] || 0) + 1;
    byCategory[x.category] = (byCategory[x.category] || 0) + 1;
    byExt[x.ext] = (byExt[x.ext] || 0) + 1;
    totalSize += x.size;
  }
  const sizes = rows.map(x => x.size);
  const biggest = rows.slice().sort((a, b) => b.size - a.size).slice(0, 10).map(x => ({
    file: x.file, type: x.type, category: x.category, size: x.size, sizeFormatted: x.sizeFormatted,
  }));
  const newest = rows.slice().sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, 10).map(x => ({
    file: x.file, type: x.type, category: x.category, mtime: x.mtime,
  }));

  return {
    total: rows.length,
    by_type: byType,
    by_category: byCategory,
    by_ext: byExt,
    filesystem: {
      html: scan.html.length,
      api: scan.api.length,
      api_real: scan.api.filter(x => x.isApi).length,
      collector: scan.collectors.length,
      script: scan.scripts.length,
      root: scan.root.length,
      help: scan.help.length,
    },
    size: {
      total: totalSize,
      total_formatted: formatSize(totalSize),
      min: sizes.length ? Math.min(...sizes) : 0,
      max: sizes.length ? Math.max(...sizes) : 0,
      mean: sizes.length ? Number((totalSize / sizes.length).toFixed(2)) : 0,
      mean_formatted: formatSize(sizes.length ? totalSize / sizes.length : 0),
    },
    biggest_10: biggest,
    newest_10: newest,
  };
}

function computeSizeDistribution(rows) {
  return SIZE_BUCKETS.map(b => {
    const items = rows.filter(x => x.size >= b.min && x.size < b.max);
    return {
      label: b.label,
      range: [b.min, b.max === Infinity ? 'inf' : b.max],
      color: b.color,
      count: items.length,
      files: items.slice(0, 20).map(x => x.file),
    };
  }).filter(b => b.count > 0);
}

function computeTimeline(rows) {
  const byDate = {};
  for (const x of rows) {
    if (!x.mtime) continue;
    const date = String(x.mtime).slice(0, 10);
    if (!byDate[date]) byDate[date] = { date, count: 0, by_category: {} };
    byDate[date].count++;
    byDate[date].by_category[x.category] = (byDate[date].by_category[x.category] || 0) + 1;
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

function buildTree(rows) {
  const tree = {};
  for (const x of rows) {
    const cat = x.category || 'unknown';
    if (!tree[cat]) tree[cat] = [];
    tree[cat].push({ file: x.file, size: x.size, sizeFormatted: x.sizeFormatted, type: x.type, url: x.url });
  }
  for (const k of Object.keys(tree)) tree[k].sort((a, b) => a.file.localeCompare(b.file));
  return tree;
}

function findDuplicates(rows) {
  const map = {};
  for (const x of rows) {
    const base = x.file.replace(/\.\w+$/, '').replace(/[_-]?(copy|bak|tmp|old|\d+)$/i, '');
    if (!map[base]) map[base] = [];
    map[base].push({ file: x.file, size: x.size, type: x.type, mtime: x.mtime });
  }
  return Object.entries(map).filter(([, arr]) => arr.length > 1)
    .map(([name, files]) => ({ base: name, count: files.length, files }))
    .sort((a, b) => b.count - a.count);
}

async function computeAudit(scan) {
  const apiModules = scan.api.filter(x => x.isApi).map(x => x.id);
  const htmlPages = scan.html.map(x => x.id);
  const collectors = scan.collectors.map(x => x.id);
  const helpRu = new Set(scan.help.filter(x => x.lang === 'ru').map(x => x.file.replace(/^ru\//, '').replace(/\.(md|txt)$/, '')));
  const helpEn = new Set(scan.help.filter(x => x.lang === 'en').map(x => x.file.replace(/^en\//, '').replace(/\.(md|txt)$/, '')));

  const apiNoHelp = apiModules.filter(x => !helpRu.has(x) && !helpRu.has(`${x}-api`));
  const pagesNoHelp = htmlPages.filter(x => !helpRu.has(x));
  const collectorsNoHelp = collectors.filter(x => !helpRu.has(x));

  return {
    totals: {
      api_real: apiModules.length,
      pages: htmlPages.length,
      collectors: collectors.length,
      help_ru: helpRu.size,
      help_en: helpEn.size,
    },
    missing: {
      api_no_help: apiNoHelp.length,
      pages_no_help: pagesNoHelp.length,
      collectors_no_help: collectorsNoHelp.length,
    },
    api_no_help_sample: apiNoHelp.slice(0, 30),
    pages_no_help_sample: pagesNoHelp.slice(0, 30),
    collectors_no_help_sample: collectorsNoHelp.slice(0, 30),
    generated_at: new Date().toISOString(),
  };
}

function findOrphans(scan) {
  const apiIds = new Set(scan.api.filter(x => x.isApi).map(x => x.id));
  const pageIds = new Set(scan.html.map(x => x.id));
  const collectorIds = new Set(scan.collectors.map(x => x.id.replace(/^collect-/, '')));
  const helpRu = scan.help.filter(x => x.lang === 'ru').map(x => x.file.replace(/^ru\//, '').replace(/\.(md|txt)$/, ''));
  const helpSet = new Set(helpRu);

  const orphanApis = [...apiIds].filter(id => !helpSet.has(id) && !helpSet.has(`${id}-api`));
  const orphanPages = [...pageIds].filter(id => !helpSet.has(id));
  const orphanCollectors = [...collectorIds].filter(id => !helpSet.has(id) && !helpSet.has(`collect-${id}`));

  return {
    api: orphanApis,
    pages: orphanPages,
    collectors: orphanCollectors,
    counts: {
      api: orphanApis.length,
      pages: orphanPages.length,
      collectors: orphanCollectors.length,
    },
  };
}

function toReport(scan, stats) {
  const lines = [];
  lines.push('='.repeat(60));
  lines.push('  CRUCIX FILESYSTEM REPORT');
  lines.push(`  Generated: ${new Date().toISOString()}`);
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Всего файлов: ${stats.total}`);
  lines.push(`Общий размер: ${stats.size.total_formatted}`);
  lines.push('');
  lines.push(`HTML-страницы:  ${scan.html.length}`);
  lines.push(`API-модули:     ${scan.api.length}  (реальных *-api.mjs: ${scan.api.filter(x => x.isApi).length})`);
  lines.push(`Сборщики:       ${scan.collectors.length}`);
  lines.push(`Скрипты:        ${scan.scripts.length}`);
  lines.push(`Корневые:       ${scan.root.length}`);
  lines.push(`Помощь:         ${scan.help.length}`);
  lines.push('');
  lines.push('ТОП-10 по размеру:');
  for (const b of stats.biggest_10) lines.push(`  ${b.sizeFormatted.padStart(10)}  ${b.file}`);
  lines.push('');
  lines.push('ТОП-10 по дате:');
  for (const n of stats.newest_10) lines.push(`  ${n.mtime}  ${n.file}`);
  lines.push('');
  lines.push('='.repeat(60));
  return lines.join('\n');
}

function toInventoryText(scan) {
  const lines = [];
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('  CRUCIX PROJECT INVENTORY');
  lines.push(`  Generated: ${new Date().toISOString()}`);
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`HTML-страницы:  ${scan.html.length}`);
  lines.push(`API-модули:     ${scan.api.length}  (реальных *-api.mjs: ${scan.api.filter(x => x.isApi).length})`);
  lines.push(`Сборщики:       ${scan.collectors.length}`);
  lines.push(`Скрипты:        ${scan.scripts.length}`);
  lines.push(`Корневые:       ${scan.root.length}`);
  lines.push(`Помощь:         ${scan.help.length}`);
  lines.push(`ВСЕГО:          ${scan.all.length}`);
  lines.push('');
  const totalSize = scan.all.reduce((s, x) => s + x.size, 0);
  lines.push(`Общий размер:   ${formatSize(totalSize)}`);
  lines.push('═══════════════════════════════════════════════════════════');
  return lines.join('\n');
}

function toTreeText(rows) {
  const tree = buildTree(rows);
  const lines = [];
  for (const [cat, files] of Object.entries(tree)) {
    lines.push(`[${cat}]  (${files.length} files)`);
    for (const f of files.slice(0, 100)) lines.push(`  ${f.file}  (${f.sizeFormatted})`);
    if (files.length > 100) lines.push(`  ... and ${files.length - 100} more`);
    lines.push('');
  }
  return lines.join('\n');
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toSeries(rows) {
  return rows.map(x => ({ id: x.id, file: x.file, type: x.type, category: x.category, size: x.size, mtime: x.mtime }));
}

function toCSV(rows) {
  const lines = ['id,file,type,category,ext,size,sizeFormatted,mtime,url'];
  const esc = v => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  for (const r of rows) {
    lines.push([r.id, r.file, r.type, r.category, r.ext, r.size, r.sizeFormatted, r.mtime, r.url].map(esc).join(','));
  }
  return lines.join('\n') + '\n';
}

function toRenderConfig(rows) {
  return {
    type: 'table',
    columns: ['file', 'type', 'category', 'size', 'mtime', 'url'],
    rows: rows.slice(0, 500).map(x => ({
      file: x.file, type: x.type, category: x.category,
      size: x.sizeFormatted, mtime: x.mtime, url: x.url,
    })),
    tree: buildTree(rows),
    totals: { rows: rows.length },
  };
}

function sendJSON(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(body)),
    ...extra,
  });
  res.end(body);
}

function sendText(res, status, text, ct = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': ct, 'Content-Length': String(Buffer.byteLength(text)) });
  res.end(text);
}

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/layers\/scan-pages/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const extra = {
      'X-Module': 'scan-pages-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
      'Access-Control-Allow-Origin': '*',
    };

    // ---- Не-сканирующие эндпоинты ----

    if (sub === '/config') {
      return sendJSON(res, 200, {
        directories: {
          public: PUBLIC_DIR,
          api: API_DIR,
          scripts: SCRIPTS_DIR,
          collectors: COLLECTORS_DIR,
          help: HELP_DIR,
          root_scripts: ROOT_SCRIPTS,
        },
        categories: CATEGORY_MAP,
        colors: TYPE_COLORS,
        filter_presets: FILTER_PRESETS,
        size_buckets: SIZE_BUCKETS,
        cache_ttl_ms: CACHE_TTL,
      }, extra);
    }

    if (sub === '/filter-presets') {
      return sendJSON(res, 200, { presets: FILTER_PRESETS, count: FILTER_PRESETS.length }, extra);
    }

    if (sub === '/reset-cache') {
      const before = _cache.size;
      cacheClear();
      return sendJSON(res, 200, { cleared: before, now: _cache.size }, extra);
    }

    const scan = await scanAll();

    if (sub === '/health') {
      return sendJSON(res, 200, {
        status: 'online',
        dirs: {
          public: await fileExists(PUBLIC_DIR),
          api: await fileExists(API_DIR),
          scripts: await fileExists(SCRIPTS_DIR),
          collectors: await fileExists(COLLECTORS_DIR),
          help: await fileExists(HELP_DIR),
        },
        totals: {
          html: scan.html.length,
          api: scan.api.length,
          collectors: scan.collectors.length,
          scripts: scan.scripts.length,
          help: scan.help.length,
        },
        cache_size: _cache.size,
        generated_at: new Date().toISOString(),
      }, extra);
    }

    if (sub === '/counts') {
      return sendJSON(res, 200, {
        html: scan.html.length,
        api: scan.api.length,
        api_real: scan.api.filter(x => x.isApi).length,
        collectors: scan.collectors.length,
        scripts: scan.scripts.length,
        root: scan.root.length,
        help: scan.help.length,
        total: scan.all.length,
      }, extra);
    }

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(scan, scan.all) }, extra);
    }
    if (sub === '/status') {
      return sendJSON(res, 200, {
        status: 'online',
        total: scan.all.length,
        html: scan.html.length,
        api: scan.api.length,
        api_real: scan.api.filter(x => x.isApi).length,
        collectors: scan.collectors.length,
        scripts: scan.scripts.length,
        root: scan.root.length,
        help: scan.help.length,
        generated_at: new Date().toISOString(),
      }, extra);
    }
    if (sub === '/html') {
      const rows = applyFilters(scan.html, query);
      return sendJSON(res, 200, { items: rows, total: rows.length, all: scan.html.length }, extra);
    }
    if (sub === '/api') {
      const rows = applyFilters(scan.api, query);
      return sendJSON(res, 200, { items: rows, total: rows.length, all: scan.api.length }, extra);
    }
    if (sub === '/api-real') {
      const rows = applyFilters(scan.api.filter(x => x.isApi), query);
      return sendJSON(res, 200, { items: rows, total: rows.length }, extra);
    }
    if (sub === '/collectors') {
      const rows = applyFilters(scan.collectors, query);
      return sendJSON(res, 200, { items: rows, total: rows.length, all: scan.collectors.length }, extra);
    }
    if (sub === '/scripts') {
      const rows = applyFilters(scan.scripts, query);
      return sendJSON(res, 200, { items: rows, total: rows.length, all: scan.scripts.length }, extra);
    }
    if (sub === '/root') {
      return sendJSON(res, 200, { items: scan.root, total: scan.root.length }, extra);
    }
    if (sub === '/help') {
      const rows = applyFilters(scan.help, query);
      return sendJSON(res, 200, { items: rows, total: rows.length, all: scan.help.length }, extra);
    }
    if (sub === '/tree') {
      if (format === 'text') return sendText(res, 200, toTreeText(scan.all), 'text/plain; charset=utf-8');
      return sendJSON(res, 200, { tree: buildTree(scan.all) }, extra);
    }
    if (sub === '/biggest') {
      const n = parseInt(query.n, 10) || 30;
      const rows = scan.all.slice().sort((a, b) => b.size - a.size).slice(0, n);
      return sendJSON(res, 200, {
        biggest: rows.map(x => ({ file: x.file, type: x.type, category: x.category, size: x.size, sizeFormatted: x.sizeFormatted, mtime: x.mtime })),
        n,
      }, extra);
    }
    if (sub === '/recent') {
      const n = parseInt(query.n, 10) || 30;
      const rows = scan.all.slice().sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, n);
      return sendJSON(res, 200, {
        recent: rows.map(x => ({ file: x.file, type: x.type, category: x.category, size: x.size, mtime: x.mtime, mtimeMs: x.mtimeMs })),
        n,
      }, extra);
    }
    if (sub === '/duplicates') {
      const dups = findDuplicates(scan.all);
      return sendJSON(res, 200, { duplicates: dups, total: dups.length }, extra);
    }
    if (sub === '/audit') {
      const audit = await computeAudit(scan);
      return sendJSON(res, 200, { audit }, extra);
    }
    if (sub === '/orphans') {
      const orphans = findOrphans(scan);
      return sendJSON(res, 200, { orphans }, extra);
    }
    if (sub === '/search') {
      const q = String(query.q || '').toLowerCase();
      if (!q) return sendJSON(res, 400, { error: 'field_required: q' }, extra);
      const rows = scan.all.filter(x => (x.file + ' ' + x.id + ' ' + (x.url || '')).toLowerCase().includes(q));
      return sendJSON(res, 200, { query: q, results: rows, count: rows.length }, extra);
    }
    if (sub === '/by-ext') {
      const byExt = {};
      for (const x of scan.all) {
        if (!byExt[x.ext]) byExt[x.ext] = { ext: x.ext, count: 0, total_size: 0, files: [] };
        byExt[x.ext].count++;
        byExt[x.ext].total_size += x.size;
        if (byExt[x.ext].files.length < 20) byExt[x.ext].files.push(x.file);
      }
      const result = Object.values(byExt).sort((a, b) => b.count - a.count).map(b => ({
        ...b,
        total_size_formatted: formatSize(b.total_size),
      }));
      return sendJSON(res, 200, { extensions: result, total: result.length }, extra);
    }
    if (sub === '/by-category') {
      const byCategory = {};
      for (const x of scan.all) {
        if (!byCategory[x.category]) byCategory[x.category] = { category: x.category, label: CATEGORY_MAP[x.category], color: TYPE_COLORS[CATEGORY_MAP[x.category]], count: 0, total_size: 0 };
        byCategory[x.category].count++;
        byCategory[x.category].total_size += x.size;
      }
      const result = Object.values(byCategory).map(b => ({ ...b, total_size_formatted: formatSize(b.total_size) }));
      return sendJSON(res, 200, { categories: result, total: result.length }, extra);
    }
    if (sub === '/by-size') {
      const distribution = computeSizeDistribution(scan.all);
      return sendJSON(res, 200, { distribution }, extra);
    }
    if (sub === '/modified') {
      const since = parseSince(query.since || '7d');
      const rows = scan.all.filter(x => x.mtimeMs >= since).sort((a, b) => b.mtimeMs - a.mtimeMs);
      return sendJSON(res, 200, {
        modified: rows.slice(0, 100).map(x => ({ file: x.file, category: x.category, mtime: x.mtime, size: x.sizeFormatted })),
        count: rows.length,
        since: new Date(since).toISOString(),
      }, extra);
    }
    if (sub === '/timeline') {
      const timeline = computeTimeline(scan.all);
      return sendJSON(res, 200, { timeline, days: timeline.length }, extra);
    }
    if (sub === '/trends') {
      const cached = cacheGet('trends');
      if (cached) return sendJSON(res, 200, { trends: cached, cached: true }, extra);
      const trends = {
        top_categories: Object.entries(computeStats(scan, scan.all).by_category).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })),
        top_extensions: Object.entries(computeStats(scan, scan.all).by_ext).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })),
      };
      cachePut('trends', trends);
      return sendJSON(res, 200, { trends }, extra);
    }
    if (sub === '/compare') {
      const files = String(query.files || '').split(',').map(s => s.trim()).filter(Boolean);
      const results = files.map(f => scan.all.find(x => x.file === f || x.id === f)).filter(Boolean);
      const summary = {
        count: results.length,
        total_size: results.reduce((s, x) => s + x.size, 0),
        total_size_formatted: formatSize(results.reduce((s, x) => s + x.size, 0)),
        by_category: results.reduce((acc, x) => { acc[x.category] = (acc[x.category] || 0) + 1; return acc; }, {}),
      };
      return sendJSON(res, 200, { results, summary }, extra);
    }
    if (sub === '/full-inventory' || format === 'inventory') {
      const text = toInventoryText(scan);
      return sendText(res, 200, text, 'text/plain; charset=utf-8');
    }
    if (sub === '/export' || format === 'report') {
      const stats = computeStats(scan, scan.all);
      const report = toReport(scan, stats);
      return sendText(res, 200, report, 'text/plain; charset=utf-8');
    }
    if (sub === '/render') {
      const rows = applyFilters(scan.all, query);
      return sendJSON(res, 200, { render: toRenderConfig(rows) }, extra);
    }

    const rows = applyFilters(scan.all, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'tree')   return sendText(res, 200, toTreeText(rows), 'text/plain; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'summary') {
      return sendJSON(res, 200, {
        total: rows.length,
        html: scan.html.length,
        api: scan.api.length,
        api_real: scan.api.filter(x => x.isApi).length,
        collectors: scan.collectors.length,
        scripts: scan.scripts.length,
        root: scan.root.length,
        help: scan.help.length,
        total_size: rows.reduce((s, x) => s + x.size, 0),
        total_size_formatted: formatSize(rows.reduce((s, x) => s + x.size, 0)),
      }, extra);
    }
    if (format === 'raw')    return sendJSON(res, 200, { data: rows }, extra);

    const stats = computeStats(scan, rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      features: [],
      meta: {
        source: meta.source,
        category: meta.category,
        unit: meta.unit,
        total_files: scan.all.length,
        returned_files: rows.length,
        generated_at: new Date().toISOString(),
      },
      summary: {
        html: scan.html.length,
        api: scan.api.length,
        api_real: scan.api.filter(x => x.isApi).length,
        collectors: scan.collectors.length,
        scripts: scan.scripts.length,
        root: scan.root.length,
        help: scan.help.length,
      },
      items: rows,
      series: toSeries(rows),
      tree: buildTree(rows),
      stats,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
