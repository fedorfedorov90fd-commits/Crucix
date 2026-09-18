/**
 * apis/sources/crucix-doctor-api.mjs — API-МОДУЛЬ: CRUCIX DOCTOR
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/specialist/crucix-doctor.json — { _meta, data: { issues:[{type,file,target,severity}], total, bySeverity:{critical,high,medium,low}, generated_at, tools?, commands?, health?, dashboard?, results? } }.
 * Анализатор: scripts/analyzers/crucix-doctor.mjs.
 *
 * Диагностика состояния проекта: проблемы модулей, инструменты, команды,
 * здоровье системы, показатели дашборда.
 *
 * ФОРМАТЫ: json, csv, series, stats, raw.
 * ФИЛЬТРЫ: ?severity=, ?type=, ?file=, ?limit=, ?search=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'specialist', 'crucix-doctor.json');

export const route  = '/api/layers/crucix-doctor';
export const method = 'GET';

export const meta = {
  category: 'specialist',
  icon: '🩺',
  color: '#22c55e',
  vizType: 'marker',
  source: 'analytics/specialist/crucix-doctor.json',
  collector: 'scripts/analyzers/crucix-doctor.mjs',
  cache: 60,
  description: 'Диагностика проекта Crucix: проблемы, инструменты, команды, здоровье',
  unit: 'report',
};

const SEVERITY_META = {
  critical: { color: '#dc2626', label: 'Критично' },
  high:     { color: '#f97316', label: 'Высокий' },
  medium:   { color: '#eab308', label: 'Средний' },
  low:      { color: '#22c55e', label: 'Низкий' },
  info:     { color: '#64748b', label: 'Информация' },
};

// ============================================================
//  ЗАГРУЗКА
// ============================================================

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/crucix-doctor.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json: ' + e.message); err.statusCode = 500; throw err; }
  if (!parsed || typeof parsed !== 'object') { const err = new Error('invalid_shape'); err.statusCode = 500; throw err; }
  return parsed;
}

// ============================================================
//  НОРМАЛИЗАЦИЯ ISSUES
// ============================================================

function normalizeIssues(doc) {
  const issues = doc.data?.issues || [];
  return issues.map((it, i) => {
    const sev = String(it.severity || 'info').toLowerCase();
    const def = SEVERITY_META[sev] || SEVERITY_META.info;
    return {
      id: it.id || `issue-${i}`,
      type: it.type || 'unknown',
      file: it.file || null,
      target: it.target || null,
      message: it.message || null,
      severity: sev,
      severityLabel: def.label,
      color: def.color,
    };
  });
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.type)     r = r.filter(x => x.type.toLowerCase().includes(String(query.type).toLowerCase()));
  if (query.file)     r = r.filter(x => (x.file || '').toLowerCase().includes(String(query.file).toLowerCase()));
  if (query.search)   r = r.filter(x => JSON.stringify(x).toLowerCase().includes(String(query.search).toLowerCase()));
  if (query.limit)    { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows, doc) {
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const byType = {};
  for (const r of rows) {
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    byType[r.type] = (byType[r.type] || 0) + 1;
  }
  return {
    count: rows.length,
    by_severity: bySeverity,
    by_type: byType,
    meta_severity: doc.data?.bySeverity || doc._meta?.stats?.bySeverity || null,
    total_in_meta: doc._meta?.stats?.total_issues ?? doc.data?.total ?? null,
    generated_at: doc.data?.generated_at || doc._meta?.updated_at || null,
    duration_ms: doc._meta?.duration_ms || null,
  };
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toFeatureCollection(rows) {
  // Issues не имеют координат — FC пустой, но стабильно возвращаем структуру.
  const features = [];
  return { type: 'FeatureCollection', features, meta: { count: rows.length } };
}

function toSeries(rows) {
  return rows.map(r => ({ id: r.id, type: r.type, severity: r.severity, file: r.file, target: r.target }));
}

function toCSV(rows) {
  const lines = ['id,type,severity,file,target,message'];
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  for (const r of rows) lines.push([r.id, r.type, r.severity, r.file, r.target, r.message].map(esc).join(','));
  return lines.join('\n') + '\n';
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/crucix-doctor/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const doc = await loadData();
    const allIssues = normalizeIssues(doc);
    const extra = {
      'X-Module': 'crucix-doctor-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    // Специализированные подэндпоинты (без пагинации — они часть документа)
    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(allIssues, doc), meta: doc._meta || null }, extra);
    }
    if (sub === '/issues') {
      const rows = applyFilters(allIssues, query);
      return sendJSON(res, 200, { issues: rows, total: rows.length }, extra);
    }
    if (sub === '/tools')     return sendJSON(res, 200, { tools: doc.data?.tools || [] }, extra);
    if (sub === '/commands')  return sendJSON(res, 200, { commands: doc.data?.commands || [] }, extra);
    if (sub === '/health')    return sendJSON(res, 200, { health: doc.data?.health || null }, extra);
    if (sub === '/dashboard') return sendJSON(res, 200, { dashboard: doc.data?.dashboard || null }, extra);
    if (sub === '/run')       return sendJSON(res, 200, { results: doc.data?.results || [] }, extra);

    const rows = applyFilters(allIssues, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: doc, meta: { issues_returned: rows.length } }, extra);

    // JSON (по умолчанию) — полный отчёт
    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source,
        category: meta.category,
        unit: meta.unit,
        total_issues: allIssues.length,
        returned_issues: rows.length,
        generated_at: new Date().toISOString(),
        source_updated_at: doc._meta?.updated_at || null,
      },
      legend: Object.entries(SEVERITY_META).map(([key, def]) => ({ key, ...def })),
      features: fc.features,
      series: toSeries(rows),
      stats: computeStats(rows, doc),
      issues: rows,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
