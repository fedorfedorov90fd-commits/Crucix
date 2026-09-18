/**
 * apis/sources/help-api.mjs — SERVICE-МОДУЛЬ: ДВИЖОК СПРАВОК
 *
 * КОНТРАКТ CRUCIX v2 (SERVICE).
 * ИСТОЧНИКИ:
 *   - data/help/ru/*.txt      — справки на русском (118 файлов).
 *   - data/help/en/*.txt      — справки на английском (102 файла).
 *   - data/help/pages.json    — реестр страниц проекта.
 *
 * Движок справок проекта Crucix: раздача справок по страницам на двух языках,
 * метаданные, поиск, категории, покрытие справками, поиск потерянных справок.
 *
 * ПУБЛИЧНЫЕ ЭНДПОИНТЫ:
 *   GET /                       — корень (описание + языки)
 *   GET /status                 — health-check
 *   GET /stats                  — статистика (кол-во ru/en, категории, покрытие)
 *   GET /languages              — список доступных языков
 *   GET /list?lang=ru           — список страниц со справками
 *   GET /pages                  — реестр страниц из pages.json
 *   GET /page/:name?lang=ru     — конкретная справка (text по умолчанию, json при ?format=json)
 *   GET /meta/:name?lang=ru     — метаданные справки (заголовок, url, модуль, категория, размер)
 *   GET /categories?lang=ru     — группировка справок по категориям
 *   GET /search?q=&lang=ru      — полнотекстовый поиск по справкам
 *   GET /missing?lang=ru        — страницы из pages.json без справки
 *   GET /orphans?lang=ru        — справки без страницы в pages.json
 *   GET /latest?lang=ru         — последние обновлённые справки
 *   GET /render                 — рендер-конфиг (дерево каталога справок)
 *
 * ФОРМАТЫ: json, text, markdown, csv, series, stats, raw, meta.
 * ПАРАМЕТРЫ: ?lang=ru|en, ?format=json|text|markdown|csv|stats|raw|meta.
 */

import { promises as fs } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const HELP_DIR = join(PROJECT_ROOT, 'data', 'help');
const PAGES_FILE = join(HELP_DIR, 'pages.json');

export const route = '/api/services/help';
export const methods = ['GET'];

export const meta = {
  service: true,
  description: 'Движок справок Crucix: раздача справок по страницам (ru/en), метаданные, поиск, категории, покрытие, потерянные справки.',
  cache: 60,
  version: '2.0.0',
};

// ============================================================
//  КОНСТАНТЫ
// ============================================================

const LANGUAGES = [
  { code: 'ru', name: 'Русский',  native: 'Русский',   flag: '🇷🇺', dir: join(HELP_DIR, 'ru') },
  { code: 'en', name: 'English',  native: 'English',   flag: '🇬🇧', dir: join(HELP_DIR, 'en') },
];

const LANG_BY_CODE = new Map(LANGUAGES.map(l => [l.code, l]));
const DEFAULT_LANG = 'ru';
const MAX_SEARCH_RESULTS = 100;
const MAX_PREVIEW_CHARS = 400;

// ============================================================
//  УТИЛИТЫ
// ============================================================

async function fileExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function safeReaddir(dir) {
  try { return await fs.readdir(dir, { withFileTypes: true }); } catch { return []; }
}

async function statFile(p) {
  try { return await fs.stat(p); } catch { return null; }
}

function safeName(name) {
  // Защита от path traversal: только [a-z0-9_-] + точка
  const s = String(name || '').trim();
  if (!/^[a-zA-Z0-9._-]+$/.test(s)) return null;
  if (s.startsWith('.') || s.includes('..')) return null;
  return s;
}

function stripExtension(filename) {
  return basename(filename).replace(/\.\w+$/, '');
}

// ============================================================
//  ЗАГРУЗКА СПРАВОК
// ============================================================

async function listHelpFiles(langCode) {
  const lang = LANG_BY_CODE.get(langCode);
  if (!lang) return [];
  const entries = await safeReaddir(lang.dir);
  const out = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (!e.name.endsWith('.txt') && !e.name.endsWith('.md')) continue;
    const full = join(lang.dir, e.name);
    const st = await statFile(full);
    if (!st) continue;
    out.push({
      name: stripExtension(e.name),
      filename: e.name,
      path: full,
      size: st.size,
      sizeFormatted: formatBytes(st.size),
      mtime: st.mtime.toISOString(),
      mtime_ms: st.mtime.getTime(),
      lang: langCode,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

async function readHelpText(langCode, name) {
  const lang = LANG_BY_CODE.get(langCode);
  if (!lang) { const e = new Error('unknown_language'); e.statusCode = 400; e.lang = langCode; throw e; }

  const safe = safeName(name);
  if (!safe) { const e = new Error('invalid_name'); e.statusCode = 400; e.name = name; throw e; }

  // Пробуем .txt, потом .md
  const candidates = [
    join(lang.dir, `${safe}.txt`),
    join(lang.dir, `${safe}.md`),
    join(lang.dir, safe),
  ];

  for (const path of candidates) {
    try {
      const content = await fs.readFile(path, 'utf8');
      const st = await fs.stat(path);
      return {
        name: safe,
        lang: langCode,
        filename: basename(path),
        path,
        content,
        size: st.size,
        sizeFormatted: formatBytes(st.size),
        mtime: st.mtime.toISOString(),
        lines: content.split('\n').length,
        chars: content.length,
      };
    } catch (e) {
      if (e.code === 'ENOENT') continue;
      throw e;
    }
  }
  return null;
}

async function loadPagesRegistry() {
  try {
    const raw = await fs.readFile(PAGES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.pages)) return parsed.pages;
    return [];
  } catch { return []; }
}

// ============================================================
//  ПАРСИНГ СПРАВКИ (шапка из === Название ===, URL:, Модуль:, Категория:)
// ============================================================

function parseHelpMeta(content, filename) {
  const meta = {
    title: null,
    url: null,
    module: null,
    category: null,
    icon: null,
    lastUpdated: null,
    description: null,
    features: [],
    usage: null,
    sections: [],
  };

  const lines = content.split('\n');
  let currentSection = null;
  let sectionBody = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // === Название ===
    const titleMatch = line.match(/^===\s*(.+?)\s*===$/);
    if (titleMatch && !meta.title) {
      meta.title = titleMatch[1];
      continue;
    }

    // URL: /xxx
    const urlMatch = line.match(/^URL:\s*(.+)$/i);
    if (urlMatch) { meta.url = urlMatch[1].trim(); continue; }

    // Модуль: xxx
    const modMatch = line.match(/^Модуль:\s*(.+)$/i) || line.match(/^Module:\s*(.+)$/i);
    if (modMatch) { meta.module = modMatch[1].trim(); continue; }

    // Категория: xxx
    const catMatch = line.match(/^Категория:\s*(.+)$/i) || line.match(/^Category:\s*(.+)$/i);
    if (catMatch) { meta.category = catMatch[1].trim(); continue; }

    // Иконка: 🚢
    const iconMatch = line.match(/^Иконка:\s*(.+)$/i) || line.match(/^Icon:\s*(.+)$/i);
    if (iconMatch) { meta.icon = iconMatch[1].trim(); continue; }

    // ПОСЛЕДНЕЕ ОБНОВЛЕНИЕ: 2026-08-21
    const updMatch = line.match(/^ПОСЛЕДНЕЕ ОБНОВЛЕНИЕ:\s*(.+)$/i) || line.match(/^LAST UPDATED:\s*(.+)$/i);
    if (updMatch) { meta.lastUpdated = updMatch[1].trim(); continue; }

    // ФАЙЛ СПРАВКИ: xxx
    // (игнорируем)

    // Секции: ОПИСАНИЕ:, ФУНКЦИОНАЛ:, ИСПОЛЬЗОВАНИЕ:
    const sectionMatch = line.match(/^([А-ЯЁA-Z_ ]{3,}):\s*$/);
    if (sectionMatch) {
      if (currentSection) {
        meta.sections.push({ name: currentSection, body: sectionBody.join('\n').trim() });
      }
      currentSection = sectionMatch[1].trim();
      sectionBody = [];
      continue;
    }

    if (currentSection) {
      sectionBody.push(rawLine);
      if (currentSection === 'ФУНКЦИОНАЛ' || currentSection === 'FEATURES') {
        if (line.startsWith('-')) meta.features.push(line.slice(1).trim());
      }
    }
  }

  if (currentSection) {
    meta.sections.push({ name: currentSection, body: sectionBody.join('\n').trim() });
  }

  // Извлекаем описание и использование из секций
  for (const s of meta.sections) {
    if (s.name === 'ОПИСАНИЕ' || s.name === 'DESCRIPTION') meta.description = s.body;
    if (s.name === 'ИСПОЛЬЗОВАНИЕ' || s.name === 'USAGE') meta.usage = s.body;
  }

  if (!meta.title) meta.title = filename;
  return meta;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

async function computeStats() {
  const perLang = {};
  for (const lang of LANGUAGES) {
    const files = await listHelpFiles(lang.code);
    const byCategory = {};
    const byExt = {};
    let totalSize = 0;
    for (const f of files) {
      byExt[extname(f.filename)] = (byExt[extname(f.filename)] || 0) + 1;
      totalSize += f.size;
    }
    perLang[lang.code] = {
      lang: lang.code,
      name: lang.name,
      count: files.length,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      byExt,
    };
  }

  const pages = await loadPagesRegistry();
  const ruFiles = await listHelpFiles('ru');
  const enFiles = await listHelpFiles('en');
  const ruNames = new Set(ruFiles.map(f => f.name));
  const enNames = new Set(enFiles.map(f => f.name));
  const pageNames = new Set(pages.map(p => p.id));

  const missingRu = [...pageNames].filter(n => !ruNames.has(n));
  const missingEn = [...pageNames].filter(n => !enNames.has(n));
  const orphansRu = [...ruNames].filter(n => !pageNames.has(n));
  const orphansEn = [...enNames].filter(n => !pageNames.has(n));

  return {
    languages: perLang,
    pages_total: pages.length,
    coverage: {
      ru: {
        available: ruFiles.length,
        missing: missingRu.length,
        orphan: orphansRu.length,
        coverage_pct: pages.length > 0 ? Number(((ruFiles.length / pages.length) * 100).toFixed(2)) : null,
      },
      en: {
        available: enFiles.length,
        missing: missingEn.length,
        orphan: orphansEn.length,
        coverage_pct: pages.length > 0 ? Number(((enFiles.length / pages.length) * 100).toFixed(2)) : null,
      },
    },
  };
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function formatBytes(n) {
  if (!Number.isFinite(n) || n < 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
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

function sendText(res, status, text, contentType = 'text/plain; charset=utf-8', extra = {}) {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': String(Buffer.byteLength(text, 'utf8')),
    ...extra,
  });
  res.end(text);
}

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/services\/help/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const lang = (query.lang || DEFAULT_LANG).toLowerCase();
    const format = (query.format || '').toLowerCase();

    const extra = {
      'X-Service': 'help',
      'X-Service-Version': meta.version,
      'Cache-Control': `public, max-age=${meta.cache}`,
      'Access-Control-Allow-Origin': '*',
    };

    // ============================================================
    //  /, /status
    // ============================================================
    if (sub === '/' || sub === '') {
      return sendJSON(res, 200, {
        service: 'help',
        version: meta.version,
        description: meta.description,
        languages: LANGUAGES.map(l => ({ code: l.code, name: l.name, native: l.native })),
        endpoints: {
          'GET /': 'корень (описание)',
          'GET /status': 'health-check',
          'GET /stats': 'статистика (кол-во ru/en, покрытие)',
          'GET /languages': 'список языков',
          'GET /list?lang=ru': 'список страниц со справками',
          'GET /pages': 'реестр страниц из pages.json',
          'GET /page/:name?lang=ru': 'конкретная справка (text, ?format=json для структуры)',
          'GET /meta/:name?lang=ru': 'метаданные справки (заголовок, url, модуль, категория)',
          'GET /categories?lang=ru': 'группировка по категориям',
          'GET /search?q=&lang=ru': 'поиск по справкам',
          'GET /missing?lang=ru': 'страницы без справки',
          'GET /orphans?lang=ru': 'справки без страницы',
          'GET /latest?lang=ru': 'последние обновлённые',
          'GET /render': 'рендер-конфиг для UI',
        },
      }, extra);
    }

    if (sub === '/status') {
      const exists = {
        help_dir: await fileExists(HELP_DIR),
        pages_file: await fileExists(PAGES_FILE),
      };
      const langs = {};
      for (const l of LANGUAGES) langs[l.code] = await fileExists(l.dir);
      const allOk = exists.help_dir && Object.values(langs).every(Boolean);
      return sendJSON(res, 200, {
        service: 'help',
        status: allOk ? 'online' : 'degraded',
        checks: { ...exists, languages: langs },
        timestamp: new Date().toISOString(),
      }, extra);
    }

    if (sub === '/stats' || format === 'stats') {
      const stats = await computeStats();
      return sendJSON(res, 200, { success: true, stats }, extra);
    }

    if (sub === '/languages') {
      const list = [];
      for (const l of LANGUAGES) {
        const files = await listHelpFiles(l.code);
        list.push({ code: l.code, name: l.name, native: l.native, flag: l.flag, help_count: files.length });
      }
      return sendJSON(res, 200, { languages: list, total: list.length }, extra);
    }

    // ============================================================
    //  /list
    // ============================================================
    if (sub === '/list') {
      const files = await listHelpFiles(lang);
      const pages = [];
      for (const f of files) pages.push(f.name);
      return sendJSON(res, 200, { success: true, lang, pages, count: pages.length }, extra);
    }

    // ============================================================
    //  /pages — реестр страниц
    // ============================================================
    if (sub === '/pages') {
      const pages = await loadPagesRegistry();
      return sendJSON(res, 200, { success: true, pages, count: pages.length }, extra);
    }

    // ============================================================
    //  /page/:name
    // ============================================================
    if (sub.startsWith('/page/')) {
      const name = decodeURIComponent(sub.slice('/page/'.length));
      const help = await readHelpText(lang, name);

      if (!help) {
        // fallback: пробуем другой язык
        const fallbackLang = lang === 'ru' ? 'en' : 'ru';
        const fallbackHelp = await readHelpText(fallbackLang, name);
        if (fallbackHelp) {
          if (format === 'json') {
            const meta_ = parseHelpMeta(fallbackHelp.content, fallbackHelp.name);
            return sendJSON(res, 200, { success: true, fallback: true, lang: fallbackLang, help: { ...fallbackHelp, meta: meta_ } }, extra);
          }
          return sendText(res, 200, fallbackHelp.content, 'text/plain; charset=utf-8', { 'X-Lang': fallbackLang, 'X-Fallback': 'true' });
        }
        // 404
        if (format === 'json') {
          return sendJSON(res, 404, { success: false, error: 'help_not_found', name, lang, hint: `Создайте файл data/help/${lang}/${name}.txt` }, extra);
        }
        return sendText(res, 404, `Справка для страницы "${name}" не найдена на языке "${lang}".\n\nСоздайте файл: /data/help/${lang}/${name}.txt\n`, 'text/plain; charset=utf-8');
      }

      if (format === 'json') {
        const meta_ = parseHelpMeta(help.content, help.name);
        return sendJSON(res, 200, { success: true, lang, help: { ...help, meta: meta_ } }, extra);
      }

      return sendText(res, 200, help.content, 'text/plain; charset=utf-8', { 'X-Lang': lang });
    }

    // ============================================================
    //  /meta/:name
    // ============================================================
    if (sub.startsWith('/meta/')) {
      const name = decodeURIComponent(sub.slice('/meta/'.length));
      const help = await readHelpText(lang, name);
      if (!help) return sendJSON(res, 404, { success: false, error: 'help_not_found', name, lang }, extra);
      const meta_ = parseHelpMeta(help.content, help.name);
      return sendJSON(res, 200, {
        success: true,
        lang,
        filename: help.filename,
        size: help.size,
        sizeFormatted: help.sizeFormatted,
        lines: help.lines,
        chars: help.chars,
        mtime: help.mtime,
        meta: meta_,
      }, extra);
    }

    // ============================================================
    //  /categories
    // ============================================================
    if (sub === '/categories') {
      const files = await listHelpFiles(lang);
      const byCategory = {};
      for (const f of files) {
        const content = await fs.readFile(f.path, 'utf8').catch(() => '');
        const meta_ = parseHelpMeta(content, f.name);
        const cat = meta_.category || 'Прочее';
        if (!byCategory[cat]) byCategory[cat] = { name: cat, count: 0, helps: [] };
        byCategory[cat].count++;
        byCategory[cat].helps.push({ name: f.name, title: meta_.title, url: meta_.url });
      }
      const list = Object.values(byCategory).sort((a, b) => b.count - a.count);
      return sendJSON(res, 200, { success: true, lang, categories: list, total: list.length }, extra);
    }

    // ============================================================
    //  /search
    // ============================================================
    if (sub === '/search') {
      const q = String(query.q || '').toLowerCase().trim();
      if (!q) return sendJSON(res, 400, { success: false, error: 'field_required: q' }, extra);
      const files = await listHelpFiles(lang);
      const results = [];
      for (const f of files) {
        const content = await fs.readFile(f.path, 'utf8').catch(() => '');
        const lower = content.toLowerCase();
        const idx = lower.indexOf(q);
        if (idx !== -1) {
          const start = Math.max(0, idx - 100);
          const end = Math.min(content.length, idx + 200);
          const preview = content.slice(start, end).replace(/\s+/g, ' ').trim();
          results.push({
            name: f.name,
            filename: f.filename,
            size: f.size,
            mtime: f.mtime,
            match_index: idx,
            preview: (start > 0 ? '...' : '') + preview + (end < content.length ? '...' : ''),
          });
          if (results.length >= MAX_SEARCH_RESULTS) break;
        }
      }
      return sendJSON(res, 200, { success: true, lang, query: q, count: results.length, results }, extra);
    }

    // ============================================================
    //  /missing — страницы без справки
    // ============================================================
    if (sub === '/missing') {
      const pages = await loadPagesRegistry();
      const files = await listHelpFiles(lang);
      const fileNames = new Set(files.map(f => f.name));
      const missing = pages.filter(p => !fileNames.has(p.id));
      return sendJSON(res, 200, {
        success: true,
        lang,
        pages_total: pages.length,
        covered: pages.length - missing.length,
        missing_count: missing.length,
        missing,
      }, extra);
    }

    // ============================================================
    //  /orphans — справки без страницы
    // ============================================================
    if (sub === '/orphans') {
      const pages = await loadPagesRegistry();
      const pageIds = new Set(pages.map(p => p.id));
      const files = await listHelpFiles(lang);
      const orphans = files.filter(f => !pageIds.has(f.name));
      return sendJSON(res, 200, {
        success: true,
        lang,
        files_total: files.length,
        orphans_count: orphans.length,
        orphans: orphans.map(f => ({ name: f.name, size: f.size, mtime: f.mtime })),
      }, extra);
    }

    // ============================================================
    //  /latest — последние обновлённые
    // ============================================================
    if (sub === '/latest') {
      const files = await listHelpFiles(lang);
      const sorted = files.slice().sort((a, b) => b.mtime_ms - a.mtime_ms).slice(0, 20);
      return sendJSON(res, 200, { success: true, lang, latest: sorted, count: sorted.length }, extra);
    }

    // ============================================================
    //  /render — рендер-конфиг для UI
    // ============================================================
    if (sub === '/render') {
      const stats = await computeStats();
      const tree = {};
      for (const l of LANGUAGES) {
        const files = await listHelpFiles(l.code);
        tree[l.code] = files.slice(0, 200).map(f => ({ name: f.name, size: f.size, mtime: f.mtime }));
      }
      return sendJSON(res, 200, { render: { type: 'tree', languages: LANGUAGES.map(l => l.code), tree, stats } }, extra);
    }

    // ============================================================
    //  Не найдено
    // ============================================================
    return sendJSON(res, 404, {
      success: false,
      error: 'endpoint_not_found',
      path: sub,
      available: ['/', '/status', '/stats', '/languages', '/list', '/pages', '/page/:name', '/meta/:name', '/categories', '/search', '/missing', '/orphans', '/latest', '/render'],
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = {
      success: false,
      error: status === 400 ? (e.message || 'bad_request') : 'handler_error',
      message: e.message,
    };
    if (e.lang) payload.lang = e.lang;
    if (e.name) payload.name = e.name;
    try {
      const body = JSON.stringify(payload);
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': String(Buffer.byteLength(body)) });
      res.end(body);
    } catch {}
  }
}
