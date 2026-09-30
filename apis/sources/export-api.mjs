/**
 * apis/sources/export-api.mjs — SERVICE-МОДУЛЬ: ЭКСПОРТ ДАННЫХ И ОТЧЁТОВ
 *
 * КОНТРАКТ CRUCIX v2 (SERVICE).
 * ИСТОЧНИК: сохраняет в data/exports/YYYY-MM-DD/<filename>.
 *
 * Универсальный сервис экспорта: принимает произвольные данные через POST
 * и возвращает в одном из 7 форматов (json, csv, html, docx, markdown, xml, txt).
 * Сохраняет копии в data/exports/ с разбивкой по датам.
 * Ведёт историю экспортов, поддерживает скачивание, массовый экспорт,
 * очистку старых файлов по возрасту.
 *
 * ПУБЛИЧНЫЕ ЭНДПОИНТЫ:
 *   GET  /                    — корень (описание эндпоинтов)
 *   GET  /status              — health-check
 *   GET  /formats             — список доступных форматов
 *   GET  /stats               — статистика по data/exports/
 *   GET  /history             — список сохранённых файлов (с пагинацией)
 *   GET  /history/:filename   — скачать конкретный файл
 *   GET  /latest              — последние 20 экспортов
 *   GET  /render              — рендер-конфиг для UI
 *   POST /                    — принять данные и вернуть в указанном формате
 *   POST /bulk                — массовый экспорт (массив до 50 записей)
 *   POST /cleanup             — очистка по возрасту (confirm: true)
 *   DELETE /history/:filename — удалить конкретный файл (confirm: true)
 *
 * ТЕЛО POST /:
 *   { format: 'json', content: <any>, filename?: 'export', title?: 'Отчёт' }
 *
 * ТЕЛО POST /bulk:
 *   { items: [ {format, content, filename, title}, ... ] }
 *
 * ТЕЛО POST /cleanup:
 *   { confirm: true, older_than_days: 30 }
 *
 * ФОРМАТЫ: json, csv, html, docx, markdown, xml, txt.
 * ОГРАНИЧЕНИЯ: 10 MB на один экспорт, 50 в bulk.
 */

import { promises as fs } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const EXPORT_DIR = join(PROJECT_ROOT, 'data', 'exports');

export const route = '/api/services/export';
export const methods = ['GET', 'POST', 'DELETE'];

export const meta = {
  service: true,
  description: 'Экспорт данных: json / csv / html / docx / markdown / xml / txt. Сохранение в data/exports/ с историей и очисткой.',
  cache: 0,
  version: '2.0.0',
};

// ============================================================
//  КОНСТАНТЫ
// ============================================================

const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_BULK_ITEMS = 50;
const DEFAULT_CACHE_MS = 0;

const FORMATS = [
  { id: 'json',     name: 'JSON',     mime: 'application/json; charset=utf-8',           ext: 'json',     binary: false },
  { id: 'csv',      name: 'CSV',      mime: 'text/csv; charset=utf-8',                   ext: 'csv',      binary: false },
  { id: 'html',     name: 'HTML',     mime: 'text/html; charset=utf-8',                  ext: 'html',     binary: false },
  { id: 'docx',     name: 'DOCX',     mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx', binary: true },
  { id: 'markdown', name: 'Markdown', mime: 'text/markdown; charset=utf-8',              ext: 'md',       binary: false },
  { id: 'xml',      name: 'XML',      mime: 'application/xml; charset=utf-8',            ext: 'xml',      binary: false },
  { id: 'txt',      name: 'Text',     mime: 'text/plain; charset=utf-8',                 ext: 'txt',      binary: false },
];

const FORMAT_INDEX = new Map(FORMATS.map(f => [f.id, f]));

// ============================================================
//  УТИЛИТЫ
// ============================================================

function nowISO() { return new Date().toISOString(); }

function todayDir() {
  return new Date().toISOString().slice(0, 10);
}

function safeFilename(name, fallbackExt = 'txt') {
  const cleaned = String(name || 'export')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120);
  const base = cleaned || 'export';
  return extname(base) ? base : `${base}.${fallbackExt}`;
}

function timestampedFilename(prefix, ext) {
  const d = new Date();
  const date = d.toISOString().slice(0, 10);
  const time = d.toISOString().slice(11, 19).replace(/:/g, '-');
  return `${prefix}_${date}_${time}.${ext}`;
}

function formatBytes(n) {
  if (!Number.isFinite(n) || n < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0, v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

function readBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', c => {
      total += c.length;
      if (total > maxBytes) {
        req.destroy();
        const err = new Error('body_too_large'); err.statusCode = 413; reject(err); return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      const raw = Buffer.concat(chunks).toString('utf8');
      try { resolve(JSON.parse(raw)); }
      catch (e) { const err = new Error('invalid_json_body: ' + e.message); err.statusCode = 400; reject(err); }
    });
    req.on('error', reject);
  });
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

function sendBuffer(res, status, buffer, contentType, extra = {}) {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': String(buffer.length),
    ...extra,
  });
  res.end(buffer);
}

async function ensureDir(dir) {
  try { await fs.mkdir(dir, { recursive: true }); } catch {}
}

async function fileExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function listDirWithStats(dir) {
  const out = [];
  let names;
  try { names = await fs.readdir(dir, { withFileTypes: true }); }
  catch { return out; }
  for (const entry of names) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await listDirWithStats(full);
      out.push(...nested);
    } else if (entry.isFile()) {
      try {
        const st = await fs.stat(full);
        out.push({
          filename: entry.name,
          path: full,
          size: st.size,
          mtime: st.mtime.toISOString(),
          mtime_ms: st.mtime.getTime(),
        });
      } catch {}
    }
  }
  return out;
}

// ============================================================
//  ЭКСПОРТЁРЫ
// ============================================================

function toJSONString(data) {
  try { return JSON.stringify(data, null, 2); }
  catch (e) { return JSON.stringify({ error: 'serialize_failed', message: e.message }, null, 2); }
}

function toCSVString(input) {
  // Принимает: массив объектов, массив массивов, одиночный объект, примитив
  let rows = [];
  if (Array.isArray(input)) rows = input;
  else if (input && typeof input === 'object') rows = [input];
  else rows = [{ value: input }];

  if (rows.length === 0) return '';

  // Если массив массивов — уже таблица
  if (Array.isArray(rows[0])) {
    return rows.map(r => r.map(csvCell).join(',')).join('\n') + '\n';
  }

  // Иначе — массив объектов, собираем объединённые ключи
  const keys = new Set();
  for (const r of rows) {
    if (r && typeof r === 'object') for (const k of Object.keys(r)) keys.add(k);
  }
  const cols = [...keys];
  if (cols.length === 0) return '';

  const header = cols.map(csvCell).join(',');
  const body = rows.map(r => cols.map(c => csvCell(normalizeCSVValue(r?.[c]))).join(',')).join('\n');
  return header + '\n' + body + '\n';
}

function normalizeCSVValue(v) {
  if (v == null) return '';
  if (typeof v === 'object') {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return v;
}

function csvCell(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toHTMLString(data, title = 'Отчёт Crucix') {
  const safeTitle = escapeHTML(title);
  const stats = computeDataStats(data);
  const table = renderHTMLTable(data);
  const json = toJSONString(data);
  const dateStr = new Date().toLocaleString('ru-RU');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}</title>
<style>
  :root {
    --bg: #0a0e17;
    --panel: #111a24;
    --panel-2: #1a2a3a;
    --accent: #4ecdc4;
    --text: #e0e0e0;
    --muted: #8899aa;
    --border: #1a2a3a;
  }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: var(--bg); color: var(--text); padding: 24px; margin: 0; line-height: 1.5; }
  h1 { color: var(--accent); margin: 0 0 8px 0; font-size: 22px; }
  h2 { color: var(--accent); font-size: 16px; margin-top: 32px; }
  .meta { color: var(--muted); font-size: 13px; margin-bottom: 20px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 20px 0; }
  .stat-card { background: var(--panel); padding: 16px; border-radius: 8px; text-align: center; border: 1px solid var(--border); }
  .stat-value { font-size: 22px; font-weight: 700; color: var(--accent); }
  .stat-label { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; background: var(--panel); border-radius: 8px; overflow: hidden; }
  th { background: var(--panel-2); color: var(--accent); padding: 10px 12px; text-align: left; font-weight: 600; border-bottom: 1px solid var(--border); }
  td { padding: 8px 12px; border-bottom: 1px solid var(--border); vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  pre { background: var(--panel); padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 12px; border: 1px solid var(--border); max-height: 600px; }
  code { font-family: 'SF Mono', Consolas, Menlo, monospace; }
</style>
</head>
<body>
  <h1>${safeTitle}</h1>
  <div class="meta">Сгенерировано: ${dateStr}</div>
  <div class="stats">
    ${stats.cards.map(c => `<div class="stat-card"><div class="stat-value">${escapeHTML(c.value)}</div><div class="stat-label">${escapeHTML(c.label)}</div></div>`).join('')}
  </div>
  <h2>Таблица</h2>
  ${table}
  <h2>Исходные данные (JSON)</h2>
  <pre><code>${escapeHTML(json)}</code></pre>
</body>
</html>`;
}

function escapeHTML(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function computeDataStats(data) {
  const cards = [];
  if (Array.isArray(data)) {
    cards.push({ label: 'Записей', value: String(data.length) });
    if (data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
      const cols = new Set();
      for (const r of data) if (r && typeof r === 'object') for (const k of Object.keys(r)) cols.add(k);
      cards.push({ label: 'Колонок', value: String(cols.size) });
    }
  } else if (data && typeof data === 'object') {
    cards.push({ label: 'Ключей', value: String(Object.keys(data).length) });
  } else {
    cards.push({ label: 'Тип', value: typeof data });
  }
  return { cards };
}

function renderHTMLTable(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return '<p style="color:#8899aa">Нет табличных данных.</p>';
  }
  if (Array.isArray(data[0])) {
    return `<table><tbody>${data.map(row => `<tr>${row.map(c => `<td>${escapeHTML(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  const cols = new Set();
  for (const r of data) if (r && typeof r === 'object') for (const k of Object.keys(r)) cols.add(k);
  const columnList = [...cols];
  if (columnList.length === 0) return '<p style="color:#8899aa">Нет колонок.</p>';
  const head = `<thead><tr>${columnList.map(c => `<th>${escapeHTML(c)}</th>`).join('')}</tr></thead>`;
  const body = data.map(r => `<tr>${columnList.map(c => {
    const v = r?.[c];
    const display = v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
    return `<td>${escapeHTML(display)}</td>`;
  }).join('')}</tr>`).join('');
  return `<table>${head}<tbody>${body}</tbody></table>`;
}

function toMarkdownString(data, title = 'Отчёт Crucix') {
  const lines = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`_Сгенерировано: ${new Date().toISOString()}_`);
  lines.push('');

  if (Array.isArray(data)) {
    lines.push(`**Записей:** ${data.length}`);
    lines.push('');
    if (data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
      const cols = new Set();
      for (const r of data) if (r && typeof r === 'object') for (const k of Object.keys(r)) cols.add(k);
      const columnList = [...cols];
      lines.push('| ' + columnList.join(' | ') + ' |');
      lines.push('| ' + columnList.map(() => '---').join(' | ') + ' |');
      for (const r of data) {
        lines.push('| ' + columnList.map(c => {
          const v = r?.[c];
          const s = v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
          return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
        }).join(' | ') + ' |');
      }
    }
  } else if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) {
      const val = (typeof v === 'object' && v !== null) ? JSON.stringify(v) : String(v);
      lines.push(`- **${k}:** ${val}`);
    }
  } else {
    lines.push(String(data));
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## JSON');
  lines.push('');
  lines.push('```json');
  lines.push(toJSONString(data));
  lines.push('```');

  return lines.join('\n');
}

function toXMLString(data, rootName = 'data') {
  const safeRoot = /^[A-Za-z_][\w.-]*$/.test(rootName) ? rootName : 'data';
  return `<?xml version="1.0" encoding="UTF-8"?>\n${xmlNode(safeRoot, data)}\n`;
}

function xmlNode(name, value) {
  const safe = /^[A-Za-z_][\w.-]*$/.test(name) ? name : 'item';
  if (value == null) return `<${safe}/>`;
  if (Array.isArray(value)) {
    return `<${safe}>${value.map(v => xmlNode('item', v)).join('')}</${safe}>`;
  }
  if (typeof value === 'object') {
    const inner = Object.entries(value).map(([k, v]) => xmlNode(k, v)).join('');
    return `<${safe}>${inner}</${safe}>`;
  }
  return `<${safe}>${escapeXML(String(value))}</${safe}>`;
}

function escapeXML(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function toTXTString(data, title = 'Отчёт Crucix') {
  const lines = [];
  lines.push('='.repeat(72));
  lines.push(title);
  lines.push('='.repeat(72));
  lines.push(`Сгенерировано: ${new Date().toISOString()}`);
  lines.push('');
  if (Array.isArray(data)) {
    lines.push(`Записей: ${data.length}`);
    lines.push('');
    data.slice(0, 500).forEach((r, i) => {
      lines.push(`#${i + 1}`);
      if (r && typeof r === 'object') {
        for (const [k, v] of Object.entries(r)) {
          const s = (typeof v === 'object' && v !== null) ? JSON.stringify(v) : String(v);
          lines.push(`  ${k}: ${s}`);
        }
      } else {
        lines.push(`  ${String(r)}`);
      }
      lines.push('');
    });
    if (data.length > 500) lines.push(`... ещё ${data.length - 500} записей (обрезано)\n`);
  } else if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) {
      const s = (typeof v === 'object' && v !== null) ? JSON.stringify(v, null, 2) : String(v);
      lines.push(`${k}: ${s}`);
    }
  } else {
    lines.push(String(data));
  }
  lines.push('');
  lines.push('='.repeat(72));
  return lines.join('\n');
}

async function toDOCXBuffer(data, title = 'Отчёт Crucix') {
  try {
    const docx = await import('docx');
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } = docx;

    const children = [];
    children.push(new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }));
    children.push(new Paragraph({
      children: [new TextRun({ text: `Сгенерировано: ${new Date().toLocaleString('ru-RU')}`, italics: true, color: '666666' })],
      spacing: { after: 400 },
    }));

    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
      const cols = new Set();
      for (const r of data) if (r && typeof r === 'object') for (const k of Object.keys(r)) cols.add(k);
      const columnList = [...cols];

      if (columnList.length > 0) {
        const headerRow = new TableRow({
          tableHeader: true,
          children: columnList.map(c => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: c, bold: true })] })],
          })),
        });
        const rows = data.slice(0, 200).map(r => new TableRow({
          children: columnList.map(c => {
            const v = r?.[c];
            const s = v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
            return new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: s })] })] });
          }),
        }));
        children.push(new Table({ rows: [headerRow, ...rows], width: { size: 100, type: WidthType.PERCENTAGE } }));
        if (data.length > 200) {
          children.push(new Paragraph({
            children: [new TextRun({ text: `... ещё ${data.length - 200} записей (обрезано)`, italics: true, color: '888888' })],
          }));
        }
      }
    } else {
      children.push(new Paragraph({ text: toJSONString(data), spacing: { after: 200 } }));
    }

    const doc = new Document({ sections: [{ properties: {}, children }] });
    return await Packer.toBuffer(doc);
  } catch (e) {
    // Fallback: если docx библиотека недоступна — сохраняем как plain text
    const fallback = toTXTString(data, title);
    return Buffer.from(fallback, 'utf8');
  }
}

async function renderInFormat(format, content, title) {
  const fmt = FORMAT_INDEX.get(format);
  if (!fmt) throw Object.assign(new Error('unsupported_format'), { statusCode: 400, format });

  switch (format) {
    case 'json':     return { buffer: Buffer.from(toJSONString(content), 'utf8'), mime: fmt.mime, ext: fmt.ext };
    case 'csv':      return { buffer: Buffer.from(toCSVString(content), 'utf8'),  mime: fmt.mime, ext: fmt.ext };
    case 'html':     return { buffer: Buffer.from(toHTMLString(content, title), 'utf8'), mime: fmt.mime, ext: fmt.ext };
    case 'markdown': return { buffer: Buffer.from(toMarkdownString(content, title), 'utf8'), mime: fmt.mime, ext: fmt.ext };
    case 'xml':      return { buffer: Buffer.from(toXMLString(content), 'utf8'), mime: fmt.mime, ext: fmt.ext };
    case 'txt':      return { buffer: Buffer.from(toTXTString(content, title), 'utf8'), mime: fmt.mime, ext: fmt.ext };
    case 'docx':     return { buffer: await toDOCXBuffer(content, title), mime: fmt.mime, ext: fmt.ext };
    default:         throw Object.assign(new Error('unsupported_format'), { statusCode: 400, format });
  }
}

// ============================================================
//  ИСТОРИЯ
// ============================================================

async function listExports({ since, until, format, limit, sort } = {}) {
  if (!(await fileExists(EXPORT_DIR))) return [];
  const all = await listDirWithStats(EXPORT_DIR);
  let rows = all.map(r => ({
    filename: r.filename,
    relPath: r.path.replace(EXPORT_DIR + '/', ''),
    size: r.size,
    sizeFormatted: formatBytes(r.size),
    mtime: r.mtime,
    mtime_ms: r.mtime_ms,
    format: extname(r.filename).replace('.', '').toLowerCase() || 'unknown',
  }));

  if (since) { const t = new Date(since).getTime(); if (Number.isFinite(t)) rows = rows.filter(r => r.mtime_ms >= t); }
  if (until) { const t = new Date(until).getTime(); if (Number.isFinite(t)) rows = rows.filter(r => r.mtime_ms <= t); }
  if (format) rows = rows.filter(r => r.format === format);

  const sortKey = sort || 'mtime-desc';
  if (sortKey === 'mtime-desc') rows.sort((a, b) => b.mtime_ms - a.mtime_ms);
  else if (sortKey === 'mtime-asc') rows.sort((a, b) => a.mtime_ms - b.mtime_ms);
  else if (sortKey === 'size-desc') rows.sort((a, b) => b.size - a.size);
  else if (sortKey === 'size-asc') rows.sort((a, b) => a.size - b.size);
  else if (sortKey === 'name') rows.sort((a, b) => a.filename.localeCompare(b.filename));

  if (limit) { const n = parseInt(limit, 10); if (Number.isFinite(n) && n > 0) rows = rows.slice(0, n); }

  return rows;
}

async function saveExport(filename, buffer) {
  const dayDir = join(EXPORT_DIR, todayDir());
  await ensureDir(dayDir);
  const fullPath = join(dayDir, filename);
  await fs.writeFile(fullPath, buffer);
  const st = await fs.stat(fullPath);
  return {
    filename,
    relPath: `${todayDir()}/${filename}`,
    fullPath,
    size: st.size,
    sizeFormatted: formatBytes(st.size),
    mtime: st.mtime.toISOString(),
  };
}

async function resolveExportPath(filename) {
  // Файлы ищем в подпапках по датам: data/exports/YYYY-MM-DD/<filename>
  // и в корне exports/ (для обратной совместимости)
  const safe = basename(filename);
  const candidates = [];

  const direct = join(EXPORT_DIR, safe);
  candidates.push(direct);

  try {
    const days = await fs.readdir(EXPORT_DIR, { withFileTypes: true });
    for (const d of days) {
      if (d.isDirectory()) candidates.push(join(EXPORT_DIR, d.name, safe));
    }
  } catch {}

  for (const c of candidates) {
    if (await fileExists(c)) {
      const st = await fs.stat(c);
      if (st.isFile()) return c;
    }
  }
  return null;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

async function computeExportStats() {
  const rows = await listExports({});
  const byFormat = {};
  const byDay = {};
  let totalSize = 0;
  for (const r of rows) {
    byFormat[r.format] = (byFormat[r.format] || 0) + 1;
    const day = String(r.mtime).slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
    totalSize += r.size;
  }
  const dates = Object.keys(byDay).sort();
  return {
    total_files: rows.length,
    total_size: totalSize,
    total_size_formatted: formatBytes(totalSize),
    by_format: byFormat,
    by_day: byDay,
    earliest: dates[0] || null,
    latest: dates[dates.length - 1] || null,
    export_dir: EXPORT_DIR,
  };
}

// ============================================================
//  ОЧИСТКА
// ============================================================

async function cleanupOldExports(olderThanDays) {
  const threshold = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
  const rows = await listExports({});
  const toDelete = rows.filter(r => r.mtime_ms < threshold);
  const deleted = [];
  for (const r of toDelete) {
    const fullPath = await resolveExportPath(r.filename);
    if (fullPath) {
      try { await fs.unlink(fullPath); deleted.push(r.filename); } catch {}
    }
  }
  return { deleted, count: deleted.length, olderThanDays };
}

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const sub = url.pathname.replace(/^\/api\/services\/export/, '') || '/';
  const query = Object.fromEntries(url.searchParams.entries());

  // CORS + OPTIONS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const extra = {
    'X-Service': 'export',
    'X-Service-Version': meta.version,
    'Cache-Control': `public, max-age=${meta.cache}`,
  };

  try {
    // ============================================================
    //  GET-ЭНДПОИНТЫ
    // ============================================================
    if (req.method === 'GET') {
      if (sub === '/' || sub === '') {
        return sendJSON(res, 200, {
          service: 'export',
          version: meta.version,
          description: meta.description,
          endpoints: {
            'GET /status': 'health-check',
            'GET /formats': 'список форматов',
            'GET /stats': 'статистика по data/exports/',
            'GET /history': 'история (фильтры: since, until, format, limit, sort)',
            'GET /history/:filename': 'скачать конкретный файл',
            'GET /latest': 'последние 20 экспортов',
            'GET /render': 'рендер-конфиг для UI',
            'POST /': 'принять данные и сохранить в указанном формате',
            'POST /bulk': 'массовый экспорт',
            'POST /cleanup': 'очистка по возрасту (confirm: true)',
            'DELETE /history/:filename': 'удалить файл (confirm: true)',
          },
          formats: FORMATS.map(f => f.id),
        }, extra);
      }

      if (sub === '/status') {
        return sendJSON(res, 200, {
          service: 'export',
          status: 'online',
          export_dir_exists: await fileExists(EXPORT_DIR),
          formats_count: FORMATS.length,
          max_body_mb: MAX_BODY_BYTES / 1024 / 1024,
          max_bulk_items: MAX_BULK_ITEMS,
          timestamp: nowISO(),
        }, extra);
      }

      if (sub === '/formats') {
        return sendJSON(res, 200, {
          success: true,
          formats: FORMATS.map(f => ({ id: f.id, name: f.name, mime: f.mime, ext: f.ext, binary: f.binary })),
          count: FORMATS.length,
          timestamp: nowISO(),
        }, extra);
      }

      if (sub === '/stats') {
        const stats = await computeExportStats();
        return sendJSON(res, 200, { success: true, stats }, extra);
      }

      if (sub === '/history') {
        const rows = await listExports({
          since: query.since,
          until: query.until,
          format: query.format,
          limit: query.limit,
          sort: query.sort,
        });
        return sendJSON(res, 200, { success: true, count: rows.length, history: rows }, extra);
      }

      if (sub.startsWith('/history/')) {
        const filename = decodeURIComponent(sub.slice('/history/'.length));
        const fullPath = await resolveExportPath(filename);
        if (!fullPath) return sendJSON(res, 404, { success: false, error: 'not_found', filename }, extra);
        const buf = await fs.readFile(fullPath);
        const ext = extname(filename).replace('.', '').toLowerCase();
        const fmt = FORMATS.find(f => f.ext === ext) || FORMATS.find(f => f.id === ext);
        const mime = fmt ? fmt.mime : 'application/octet-stream';
        return sendBuffer(res, 200, buf, mime, {
          ...extra,
          'Content-Disposition': `attachment; filename="${basename(filename)}"`,
        });
      }

      if (sub === '/latest') {
        const rows = await listExports({ limit: 20, sort: 'mtime-desc' });
        return sendJSON(res, 200, { success: true, count: rows.length, latest: rows }, extra);
      }

      if (sub === '/render') {
        const rows = await listExports({ limit: 100, sort: 'mtime-desc' });
        const stats = await computeExportStats();
        return sendJSON(res, 200, {
          render: {
            type: 'table',
            columns: ['filename', 'format', 'sizeFormatted', 'mtime'],
            rows,
            stats,
          },
          formats: FORMATS.map(f => ({ id: f.id, name: f.name, mime: f.mime, ext: f.ext })),
        }, extra);
      }

      return sendJSON(res, 404, { success: false, error: 'endpoint_not_found', path: sub }, extra);
    }

    // ============================================================
    //  POST-ЭНДПОИНТЫ
    // ============================================================
    if (req.method === 'POST') {
      if (sub === '/' || sub === '') {
        let body;
        try { body = await readBody(req); }
        catch (e) { return sendJSON(res, e.statusCode || 400, { success: false, error: e.message }, extra); }

        const format = String(body.format || 'json').toLowerCase();
        const title = String(body.title || 'Отчёт Crucix');
        const filenamePrefix = String(body.filename || 'export').replace(/\.[^.]+$/, '') || 'export';

        const content = body.content !== undefined
          ? body.content
          : (body.data !== undefined ? body.data : { message: 'Нет данных' });

        let rendered;
        try { rendered = await renderInFormat(format, content, title); }
        catch (e) { return sendJSON(res, e.statusCode || 500, { success: false, error: e.message, format }, extra); }

        // Если запрошено сохранение на диск
        const saveToDisk = body.save !== false;
        let saved = null;
        if (saveToDisk) {
          const fname = safeFilename(filenamePrefix, rendered.ext).replace(/\.[^.]+$/, '') + '.' + rendered.ext;
          const tsName = timestampedFilename(filenamePrefix, rendered.ext);
          try { saved = await saveExport(tsName, rendered.buffer); } catch (e) { saved = { error: e.message }; }
        }

        // Ответ — файл, а не JSON
        return sendBuffer(res, 200, rendered.buffer, rendered.mime, {
          ...extra,
          'Content-Disposition': `attachment; filename="${timestampedFilename(filenamePrefix, rendered.ext)}"`,
          'X-Export-Format': format,
          'X-Export-Saved': saved && saved.filename ? saved.filename : '',
        });
      }

      if (sub === '/bulk') {
        let body;
        try { body = await readBody(req); }
        catch (e) { return sendJSON(res, e.statusCode || 400, { success: false, error: e.message }, extra); }

        const items = Array.isArray(body.items) ? body.items : [];
        if (items.length === 0) return sendJSON(res, 400, { success: false, error: 'items_required' }, extra);
        if (items.length > MAX_BULK_ITEMS) return sendJSON(res, 400, { success: false, error: 'too_many_items', max: MAX_BULK_ITEMS, got: items.length }, extra);

        const results = [];
        for (const item of items) {
          try {
            const format = String(item.format || 'json').toLowerCase();
            const title = String(item.title || 'Отчёт Crucix');
            const filenamePrefix = String(item.filename || 'export').replace(/\.[^.]+$/, '') || 'export';
            const content = item.content !== undefined ? item.content : (item.data !== undefined ? item.data : {});

            const rendered = await renderInFormat(format, content, title);
            const tsName = timestampedFilename(filenamePrefix, rendered.ext);
            const saved = await saveExport(tsName, rendered.buffer);
            results.push({ ok: true, filename: saved.filename, format, size: saved.size, sizeFormatted: saved.sizeFormatted });
          } catch (e) {
            results.push({ ok: false, error: e.message, format: item.format });
          }
        }
        const okCount = results.filter(r => r.ok).length;
        return sendJSON(res, 200, { success: true, total: results.length, ok: okCount, failed: results.length - okCount, results }, extra);
      }

      if (sub === '/cleanup') {
        let body;
        try { body = await readBody(req); }
        catch (e) { return sendJSON(res, e.statusCode || 400, { success: false, error: e.message }, extra); }

        if (body.confirm !== true) return sendJSON(res, 400, { success: false, error: 'confirmation_required', hint: 'send {"confirm": true, "older_than_days": 30}' }, extra);

        const days = Number(body.older_than_days);
        if (!Number.isFinite(days) || days < 1) return sendJSON(res, 400, { success: false, error: 'invalid_older_than_days' }, extra);

        const result = await cleanupOldExports(days);
        return sendJSON(res, 200, { success: true, ...result }, extra);
      }

      return sendJSON(res, 404, { success: false, error: 'post_endpoint_not_found', path: sub }, extra);
    }

    // ============================================================
    //  DELETE-ЭНДПОИНТЫ
    // ============================================================
    if (req.method === 'DELETE') {
      if (sub.startsWith('/history/')) {
        let body;
        try { body = await readBody(req); }
        catch (e) { return sendJSON(res, e.statusCode || 400, { success: false, error: e.message }, extra); }

        if (body.confirm !== true) return sendJSON(res, 400, { success: false, error: 'confirmation_required', hint: 'send {"confirm": true}' }, extra);

        const filename = decodeURIComponent(sub.slice('/history/'.length));
        const fullPath = await resolveExportPath(filename);
        if (!fullPath) return sendJSON(res, 404, { success: false, error: 'not_found', filename }, extra);

        try {
          await fs.unlink(fullPath);
          return sendJSON(res, 200, { success: true, deleted: basename(filename) }, extra);
        } catch (e) {
          return sendJSON(res, 500, { success: false, error: 'delete_failed', message: e.message }, extra);
        }
      }
      return sendJSON(res, 404, { success: false, error: 'delete_endpoint_not_found', path: sub }, extra);
    }

    return sendJSON(res, 405, { success: false, error: 'method_not_allowed', allowed: ['GET', 'POST', 'DELETE', 'OPTIONS'] }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    try {
      sendJSON(res, status, {
        success: false,
        error: status === 500 ? 'internal_error' : (e.message || 'error'),
        message: e.message,
      }, extra);
    } catch {}
  }
}
