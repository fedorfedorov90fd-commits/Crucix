// Crucix — Action: Report (генерация отчётов)
// Собирает данные из data/analytics/ и корзины в отчёт.
// Форматы: markdown, json, csv, html.
//
// Версия: 1.0.0
// Категория: document.
//
// АКАДЕМИЧЕСКОЕ ОБОСНОВАНИЕ:
//   Отчёт — это документ, а не дамп данных. Он должен иметь: заголовок,
//   временную метку, период, источники, ключевые находки, приложения.
//   Без структуры отчёт превращается в нечитаемый лог. Реализуется через
//   шаблонизатор с секциями: summary → findings → details → sources.

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getActionsRegistry, ACTION_CATEGORIES } from './_registry.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_DIR = join(PROJECT_ROOT, 'data', 'analytics');
const REPORTS_DIR = join(PROJECT_ROOT, 'data', 'reports');

const FORMATS = Object.freeze({
  MARKDOWN: 'markdown',
  JSON:     'json',
  CSV:      'csv',
  HTML:     'html',
});

const SECTION_TYPES = Object.freeze({
  SUMMARY:  'summary',
  FINDINGS: 'findings',
  DETAILS:  'details',
  SOURCES:  'sources',
});

// ============================================================
//  ЗАГРУЗКА ИСТОЧНИКОВ ОТЧЁТА
// ============================================================

async function loadAnalytics(categories) {
  const result = {};
  for (const cat of categories) {
    const dir = join(ANALYTICS_DIR, cat);
    try {
      const files = await import('fs/promises').then(fs => fs.readdir(dir));
      result[cat] = {};
      for (const f of files) {
        if (!f.endsWith('.json')) continue;
        try {
          const raw = await readFile(join(dir, f), 'utf-8');
          result[cat][f.replace('.json', '')] = JSON.parse(raw);
        } catch {}
      }
    } catch {
      result[cat] = {};
    }
  }
  return result;
}

// ============================================================
//  ФОРМИРОВАНИЕ СЕКЦИЙ
// ============================================================

function buildSummary(analytics) {
  const summary = {
    categories: Object.keys(analytics).length,
    totalModules: 0,
    byCategory: {},
  };
  for (const [cat, mods] of Object.entries(analytics)) {
    const count = Object.keys(mods).length;
    summary.byCategory[cat] = count;
    summary.totalModules += count;
  }
  return summary;
}

function buildFindings(analytics) {
  const findings = [];
  for (const [cat, mods] of Object.entries(analytics)) {
    for (const [mod, data] of Object.entries(mods)) {
      if (!data || !data._meta) continue;
      const stats = data._meta.stats || {};
      // Ищем модули с ненулевыми сигналами.
      const signals = stats.checks || stats.drifts || stats.anomalies || stats.clusters || 0;
      if (signals > 0) {
        findings.push({
          category: cat,
          module: mod,
          version: data._meta.version,
          signals,
          updatedAt: data._meta.updated_at,
        });
      }
    }
  }
  return findings.sort((a, b) => b.signals - a.signals);
}

function buildDetails(analytics) {
  const details = {};
  for (const [cat, mods] of Object.entries(analytics)) {
    details[cat] = {};
    for (const [mod, data] of Object.entries(mods)) {
      if (!data) continue;
      details[cat][mod] = {
        version: data._meta?.version,
        updatedAt: data._meta?.updated_at,
        stats: data._meta?.stats,
        description: data._meta?.description,
      };
    }
  }
  return details;
}

// ============================================================
//  ФОРМАТТЕРЫ
// ============================================================

function renderMarkdown(report) {
  const lines = [];
  lines.push(`# ${report.title}`);
  lines.push('');
  lines.push(`**Период:** ${report.period}`);
  lines.push(`**Сгенерирован:** ${report.generatedAt}`);
  lines.push(`**Категорий:** ${report.summary.categories}`);
  lines.push(`**Модулей:** ${report.summary.totalModules}`);
  lines.push('');
  lines.push('## Сводка');
  lines.push('');
  for (const [cat, count] of Object.entries(report.summary.byCategory)) {
    lines.push(`- **${cat}**: ${count}`);
  }
  lines.push('');
  if (report.findings.length > 0) {
    lines.push('## Ключевые находки');
    lines.push('');
    for (const f of report.findings) {
      lines.push(`- **${f.category}/${f.module}** — сигналов: ${f.signals} (v${f.version})`);
    }
    lines.push('');
  }
  if (report.sections.includes('details')) {
    lines.push('## Детали');
    lines.push('');
    for (const [cat, mods] of Object.entries(report.details)) {
      lines.push(`### ${cat}`);
      lines.push('');
      for (const [mod, info] of Object.entries(mods)) {
        lines.push(`- \`${mod}\` v${info.version || '?'} — ${info.description || 'без описания'}`);
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

function renderJson(report) {
  return JSON.stringify(report, null, 2);
}

function renderCsv(report) {
  const lines = ['category,module,version,signals,updated_at'];
  for (const f of report.findings) {
    const safe = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
    lines.push([safe(f.category), safe(f.module), safe(f.version), f.signals, safe(f.updatedAt)].join(','));
  }
  return lines.join('\n');
}

function renderHtml(report) {
  const esc = (s) => String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const parts = [];
  parts.push('<!DOCTYPE html>');
  parts.push('<html><head><meta charset="utf-8">');
  parts.push(`<title>${esc(report.title)}</title>`);
  parts.push('<style>body{font-family:sans-serif;max-width:960px;margin:2em auto;padding:0 1em;line-height:1.5}h1{color:#a21caf}h2{color:#dc2626;border-bottom:1px solid #ccc}code{background:#eee;padding:0 0.3em}</style>');
  parts.push('</head><body>');
  parts.push(`<h1>${esc(report.title)}</h1>`);
  parts.push(`<p><strong>Период:</strong> ${esc(report.period)}<br>`);
  parts.push(`<strong>Сгенерирован:</strong> ${esc(report.generatedAt)}<br>`);
  parts.push(`<strong>Модулей:</strong> ${report.summary.totalModules}</p>`);
  parts.push('<h2>Сводка</h2><ul>');
  for (const [cat, count] of Object.entries(report.summary.byCategory)) {
    parts.push(`<li><strong>${esc(cat)}</strong>: ${count}</li>`);
  }
  parts.push('</ul>');
  if (report.findings.length > 0) {
    parts.push('<h2>Ключевые находки</h2><ul>');
    for (const f of report.findings) {
      parts.push(`<li><strong>${esc(f.category)}/${esc(f.module)}</strong> — сигналов: ${f.signals} (v${esc(f.version)})</li>`);
    }
    parts.push('</ul>');
  }
  parts.push('</body></html>');
  return parts.join('\n');
}

// ============================================================
//  ОСНОВНОЙ ОБРАБОТЧИК
// ============================================================

async function handler(args) {
  const {
    title = 'Crucix Report',
    period = 'latest',
    format = FORMATS.MARKDOWN,
    categories = ['detector', 'specialist', 'flow', 'semantic', 'market', 'forecast', 'index', 'space'],
    sections = [SECTION_TYPES.SUMMARY, SECTION_TYPES.FINDINGS, SECTION_TYPES.DETAILS],
    saveToFile = true,
  } = args || {};

  if (!Object.values(FORMATS).includes(format)) {
    throw new Error(`format must be one of ${Object.values(FORMATS).join(', ')}`);
  }

  const analytics = await loadAnalytics(categories);
  const report = {
    title,
    period,
    generatedAt: new Date().toISOString(),
    format,
    sections,
    summary: buildSummary(analytics),
    findings: sections.includes(SECTION_TYPES.FINDINGS) ? buildFindings(analytics) : [],
    details: sections.includes(SECTION_TYPES.DETAILS) ? buildDetails(analytics) : {},
  };

  let content;
  let ext;
  if (format === FORMATS.MARKDOWN) { content = renderMarkdown(report); ext = 'md'; }
  else if (format === FORMATS.JSON) { content = renderJson(report); ext = 'json'; }
  else if (format === FORMATS.CSV) { content = renderCsv(report); ext = 'csv'; }
  else { content = renderHtml(report); ext = 'html'; }

  let filePath = null;
  if (saveToFile) {
    await mkdir(REPORTS_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    filePath = join(REPORTS_DIR, `${ts}.${ext}`);
    await writeFile(filePath, content, 'utf-8');
  }

  return {
    report: {
      title,
      period,
      format,
      sections,
      summary: report.summary,
      findingsCount: report.findings.length,
    },
    filePath,
    size: content.length,
  };
}

// ============================================================
//  РЕГИСТРАЦИЯ
// ============================================================

export function registerReportAction(registry = getActionsRegistry()) {
  registry.register({
    id: 'generate_report',
    category: ACTION_CATEGORIES.DOCUMENT,
    description: 'Сгенерировать отчёт из data/analytics/ в формате markdown/json/csv/html',
    argsSchema: {
      title: 'string',
      period: 'string',
      format: 'string',
      categories: 'array',
      sections: 'array',
      saveToFile: 'boolean',
    },
    requiredArgs: [],
    cache: 0,
    idempotent: true,
    handler,
  });
  return true;
}

export { FORMATS, SECTION_TYPES, handler as reportHandler };
