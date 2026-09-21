// news-pipeline.mjs — оркестратор конвейера обработки новостей
// Версия: 3.4.1 (исправлена опечатка medium/med в phaseCorrelate)
// Портабельный: все пути через import.meta.url

import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const ROOT       = resolve(__dirname, '..', '..');

// ─── Конфиг ───
const DIR = {
  incoming:     resolve(ROOT, 'data/warehouse/incoming'),
  documents:    resolve(ROOT, 'data/warehouse/documents'),
  points:       resolve(ROOT, 'data/warehouse/points'),
  processed:    resolve(ROOT, 'data/warehouse/processed'),
  correlations: resolve(ROOT, 'data/warehouse/correlations'),
  raw:          resolve(ROOT, 'data/raw'),
};

const DRY_RUN = process.argv.includes('--dry-run');
const DATE_ARG = process.argv.find(a => a.startsWith('--date='))?.slice(7) || 'all';

// ─── Утилиты ───
function stripCDATA(s) {
  const openTag = '<' + '![' + 'CDATA[';
  const closeTag = ']' + ']' + '>';
  let out = s;
  while (true) {
    const i = out.indexOf(openTag);
    if (i === -1) break;
    const j = out.indexOf(closeTag, i + openTag.length);
    if (j === -1) break;
    const inner = out.slice(i + openTag.length, j);
    out = out.slice(0, i) + inner + out.slice(j + closeTag.length);
  }
  return out;
}

function cleanText(s) {
  if (s == null) return '';
  if (typeof s !== 'string') s = String(s);
  let out = stripCDATA(s);
  out = out
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return out;
}

function safeText(s) {
  if (s == null) return '';
  return typeof s === 'string' ? s : String(s);
}

function ts() { return new Date().toISOString(); }

function ensureDirs() {
  for (const d of Object.values(DIR)) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
  }
}

// ─── Адаптеры ───
let entityExtract, threatClass, deduplicator, crossStream, regionMapper;

async function loadAdapters() {
  const tryImport = async (name, path) => {
    try {
      return await import(path);
    } catch (e) {
      console.log(`  [adapter] ${name}: недоступен (${e.message})`);
      return null;
    }
  };

  const e = await tryImport('entity-extraction', resolve(ROOT, 'apis/entity-extraction-api.mjs'));
  const t = await tryImport('threat-classification', resolve(ROOT, 'apis/threat-classification-api.mjs'));
  const d = await tryImport('event-deduplicator', resolve(ROOT, 'apis/event-deduplicator-api.mjs'));
  const c = await tryImport('cross-stream-correlation', resolve(ROOT, 'apis/cross-stream-correlation-api.mjs'));
  const r = await tryImport('region-mapper', resolve(ROOT, 'scripts/adapters/region-mapper.mjs'));

  entityExtract = e ? (e.extractFromBatch || e.extractEntities || e.default) : null;
  threatClass   = t ? (t.classifyThreat || t.classify || t.default) : null;
  deduplicator  = d ? (d.deduplicate || d.default) : null;
  crossStream   = c ? (c.findCorrelations || c.correlate || c.default) : null;
  regionMapper  = r ? (r.mapRegion || r.map || r.default) : null;

  const names = [];
  if (e) names.push('entityExtract');
  if (t) names.push('threatClass');
  if (d) names.push('deduplicator');
  if (c) names.push('crossStream');
  if (r) names.push('regionMapper');
  console.log(`  Адаптеры: ${names.join(', ')}`);
}

// ─── Inline-fallback дедупликации ───
function inlineDedup(items) {
  const seen = new Set();
  const unique = [];
  let dupCount = 0;
  for (const item of items) {
    const guid = item.guid || item.id || '';
    const titleHash = safeText(item.title).toLowerCase().slice(0, 80);
    const key = guid || titleHash;
    if (key && seen.has(key)) { dupCount++; continue; }
    if (key) seen.add(key);
    unique.push(item);
  }
  return { unique, duplicates: dupCount, stats: { total: items.length, unique: unique.length, duplicates: dupCount } };
}

// ─── Валидация точки ───
function isValidPoint(p) {
  if (!p.id || !p.geo) return false;
  const lat = p.geo.lat;
  const lon = p.geo.lon;
  if (typeof lat !== 'number' || typeof lon !== 'number') return false;
  if (isNaN(lat) || isNaN(lon)) return false;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
  return true;
}

// ─── Фаза 1: загрузка pending + раскрытие raw ───
function loadPending() {
  const items = [];
  const files = existsSync(DIR.incoming) ? readdirSync(DIR.incoming).filter(f => f.endsWith('.json')) : [];

  for (const fname of files) {
    const fpath = join(DIR.incoming, fname);
    let manifest;
    try { manifest = JSON.parse(readFileSync(fpath, 'utf8')); } catch { continue; }

    const dateStr = fname.replace('.json', '');
    if (DATE_ARG !== 'all' && dateStr !== DATE_ARG) continue;

    for (const m of (manifest.items || [])) {
      if (m.status !== 'pending') continue;

      const rawPath = m.raw_file ? resolve(ROOT, m.raw_file) : null;
      let rawItems = [];

      if (rawPath && existsSync(rawPath)) {
        try {
          const raw = JSON.parse(readFileSync(rawPath, 'utf8'));
          const arr = raw.items || raw.data || (Array.isArray(raw) ? raw : []);
          if (Array.isArray(arr)) {
            rawItems = arr.map(r => {
              const title = cleanText(r.title || '');
              let desc = cleanText(r.description || r.summary || r.content || '');
              if (!desc) {
                const src = r.source || r.author || r.feed || m.source || 'unknown';
                desc = title + '. Источник: ' + src;
              }
              return {
                id:          r.id || r.guid || '',
                guid:        r.guid || r.id || '',
                title:       title,
                description: desc,
                link:        cleanText(r.link || r.url || ''),
                pubDate:     r.pubDate || r.published || r.updated || '',
                source:      r.source || r.author || r.feed || m.source || 'unknown',
                category:    r.category || m.format_hint || 'news',
                stream:      m.collector ? m.collector.replace('.mjs', '').replace('collect-', '') : 'rsshub',
                collectedAt: r.collectedAt || m.fetched_at || '',
              };
            });
          }
        } catch (e) {
          console.log('  [raw] ошибка чтения ' + rawPath + ': ' + e.message);
        }
      }

      if (rawItems.length === 0) {
        rawItems = [{
          id:          m.id || '0',
          guid:        m.id || '',
          title:       cleanText(m.source || ''),
          description: cleanText(m.notes || ''),
          link:        m.source_url || '',
          pubDate:     m.fetched_at || '',
          source:      m.source || 'unknown',
          category:    m.format_hint || 'news',
          stream:      m.collector ? m.collector.replace('.mjs', '').replace('collect-', '') : 'unknown',
          collectedAt: m.fetched_at || '',
        }];
      }

      items.push(...rawItems);
    }
  }

  return items;
}

// ─── Фаза 2: entity extraction ───
async function phaseEntity(items) {
  if (!entityExtract) {
    console.log('  [entity] адаптер недоступен, пропуск');
    return items;
  }

  try {
    const isBatch = entityExtract.name === 'extractFromBatch';
    if (isBatch) {
      const textMap = {};
      items.forEach((item, i) => {
        const text = safeText(item.title) + '. ' + safeText(item.description);
        textMap[item.id || String(i)] = text;
      });
      const results = await entityExtract(textMap);
      items.forEach((item, i) => {
        const key = item.id || String(i);
        item.entities = results[key] || results[item.id] || null;
      });
    } else {
      for (const item of items) {
        try {
          const text = safeText(item.title) + '. ' + safeText(item.description);
          item.entities = entityExtract(text);
        } catch { /* skip */ }
      }
    }
    console.log('  [entity] ✓ ' + items.length + ' элементов обработано');
  } catch (e) {
    console.log('  [entity] ошибка: ' + e.message);
  }
  return items;
}

// ─── Фаза 3: geotagging ───
async function phaseGeo(items) {
  let geoCount = 0;
  if (regionMapper) {
    for (const item of items) {
      try {
        const locs = (item.entities && item.entities.locations) ? item.entities.locations.join(' ') : '';
        const text = safeText(item.title) + ' ' + safeText(item.description) + ' ' + safeText(locs);
        if (!text.trim()) continue;
        const geo = regionMapper(text);
        if (geo && geo.lat != null) {
          item.geo = geo;
          geoCount++;
        }
      } catch { /* skip */ }
    }
  }
  console.log('  [geo] ✓ ' + geoCount + ' локаций определено');
  return items;
}

// ─── Фаза 4: threat classification ───
async function phaseThreat(items) {
  let alertCount = 0;
  if (threatClass) {
    for (const item of items) {
      try {
        const text = safeText(item.title) + '. ' + safeText(item.description);
        const entities = item.entities || undefined;
        const result = threatClass(text, entities);
        item.threat = result;
        if (result && (result.level === 'high' || result.level === 'critical')) alertCount++;
      } catch { /* skip */ }
    }
  }
  console.log('  [threat] ✓ ' + items.length + ' оценено, ' + alertCount + ' алертов');
  return items;
}

// ─── Фаза 5: deduplication ───
async function phaseDedup(items) {
  let result;
  if (deduplicator) {
    try {
      result = await deduplicator(items);
      if (result.unique) items = result.unique;
      else if (Array.isArray(result)) items = result;
    } catch {
      result = inlineDedup(items);
      items = result.unique;
    }
  } else {
    result = inlineDedup(items);
    items = result.unique;
  }
  const dups = typeof result.duplicates === 'number'
    ? result.duplicates
    : (Array.isArray(result.duplicates) ? result.duplicates.length : (result.stats && result.stats.duplicates) || 0);
  console.log('  [dedup] ✓ ' + items.length + ' уникальных, ' + dups + ' дубликатов');
  return items;
}

// ─── Фаза 6: write documents/points ───
function phaseWrite(items) {
  if (DRY_RUN) {
    console.log('  [write] dry-run, пропуск записи');
    return { docPath: null, ptPath: null, ptCount: 0, docCount: 0 };
  }
  const now = ts().replace(/[:.]/g, '-').slice(0, -1);

  const allPoints = items.filter(i => i.geo && i.geo.lat != null);
  const validPoints = allPoints.filter(isValidPoint);
  const invalidCount = allPoints.length - validPoints.length;
  if (invalidCount > 0) {
    console.log('  [write] ⚠️ ' + invalidCount + ' точек отброшено (невалидные координаты)');
  }

  let docPath = null, ptPath = null;

  if (items.length > 0) {
    docPath = join(DIR.documents, 'news-' + now + '.json');
    writeFileSync(docPath, JSON.stringify(items, null, 2));
    console.log('  [write] ✓ ' + items.length + ' документов → ' + docPath);
  } else {
    console.log('  [write] ✓ 0 документов');
  }

  if (validPoints.length > 0) {
    ptPath = join(DIR.points, 'points-' + now + '.json');
    writeFileSync(ptPath, JSON.stringify(validPoints, null, 2));
    console.log('  [write] ✓ ' + validPoints.length + ' точек → ' + ptPath);
  } else {
    console.log('  [write] ✓ 0 точек');
  }

  return { docPath, ptPath, ptCount: validPoints.length, docCount: items.length };
}

// ─── Фаза 7: cross-stream correlation ───
async function phaseCorrelate(items) {
  if (!crossStream || items.length < 2) {
    console.log('  [correlate] ✓ 0 корреляций (недостаточно данных или адаптер недоступен)');
    return { correlations: [], stats: { found: 0, high: 0, medium: 0, low: 0 } };
  }
  try {
    const result = await crossStream(items);
    const corrs = result.correlations || result || [];
    const s = result.stats || {};
    const high = s.high != null ? s.high : corrs.filter(c => typeof c.score === 'number' && c.score >= 0.7).length;
    const med  = s.medium != null ? s.medium : corrs.filter(c => typeof c.score === 'number' && c.score >= 0.5 && c.score < 0.7).length;
    const low  = s.low != null ? s.low : corrs.filter(c => typeof c.score === 'number' && c.score < 0.5).length;
    console.log('  [correlate] ✓ ' + corrs.length + ' корреляций (high: ' + high + ', medium: ' + med + ', low: ' + low + ')');
    return { correlations: corrs, stats: { found: corrs.length, high, medium: med, low } };
  } catch (e) {
    console.log('  [correlate] ошибка: ' + e.message);
    return { correlations: [], stats: { found: 0, high: 0, medium: 0, low: 0 } };
  }
}

// ─── Фаза 6.5: write correlations ───
function phaseWriteCorrelations(correlationResult, docPath, ptPath, sourceStats) {
  if (DRY_RUN) {
    console.log('  [correlations] dry-run, пропуск записи');
    return null;
  }
  const corrs = correlationResult.correlations || [];
  if (corrs.length === 0) {
    console.log('  [correlations] 0 корреляций, запись не требуется');
    return null;
  }

  const now = ts().replace(/[:.]/g, '-').slice(0, -1);
  const corrPath = join(DIR.correlations, 'correlations-' + now + '.json');

  const payload = {
    generatedAt: ts(),
    sourceDocuments: docPath ? docPath.split('/').slice(-1)[0] : null,
    sourcePoints: ptPath ? ptPath.split('/').slice(-1)[0] : null,
    stats: correlationResult.stats,
    sourceStats: sourceStats || null,
    correlations: corrs,
  };

  writeFileSync(corrPath, JSON.stringify(payload, null, 2));
  console.log('  [correlations] ✓ ' + corrs.length + ' корреляций → ' + corrPath);
  return corrPath;
}

// ─── Фаза 8: mark processed ───
function phaseMark() {
  if (DRY_RUN) {
    console.log('  [mark] dry-run, пропуск');
    return;
  }
  const files = readdirSync(DIR.incoming).filter(f => f.endsWith('.json'));
  let marked = 0;
  for (const fname of files) {
    const fpath = join(DIR.incoming, fname);
    let manifest;
    try { manifest = JSON.parse(readFileSync(fpath, 'utf8')); } catch { continue; }
    let changed = false;
    for (const m of (manifest.items || [])) {
      if (m.status === 'pending') {
        m.status = 'processed';
        m.processed_at = ts();
        m.processed_to = 'data/warehouse/documents/';
        changed = true;
        marked++;
      }
    }
    if (changed) writeFileSync(fpath, JSON.stringify(manifest, null, 2));
  }
  console.log('  [mark] ✓ ' + marked + ' накладных обновлены');
}

// ─── Main ───
async function main() {
  ensureDirs();
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  Crucix News Pipeline v3.4.1 — запуск            ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('  Дата: ' + DATE_ARG + '  |  dry-run: ' + DRY_RUN);
  console.log('  ROOT: ' + ROOT);
  console.log('');
  console.log('  Загрузка адаптеров...');
  await loadAdapters();
  console.log('');

  console.log('▸ Фаза 1: загрузка pending + раскрытие raw');
  const items = loadPending();
  console.log('  ✓ загружено ' + items.length + ' элементов');
  console.log('');
  if (items.length === 0) { console.log('  Нет данных. Выход.'); return; }

  console.log('▸ Фаза 2: entity extraction');
  await phaseEntity(items);
  console.log('');

  console.log('▸ Фаза 3: geotagging');
  await phaseGeo(items);
  console.log('');

  console.log('▸ Фаза 4: threat classification');
  await phaseThreat(items);
  console.log('');

  console.log('▸ Фаза 5: deduplication');
  const unique = await phaseDedup(items);
  console.log('');

  console.log('▸ Фаза 6: write documents/points');
  const writeResult = phaseWrite(unique);
  console.log('');

  console.log('▸ Фаза 7: cross-stream correlation');
  const correlationResult = await phaseCorrelate(unique);
  console.log('');

  console.log('▸ Фаза 6.5: write correlations');
  const sourceStats = {
    totalInput: items.length,
    unique: unique.length,
    duplicates: items.length - unique.length,
    geoCount: unique.filter(i => i.geo && i.geo.lat != null).length,
    alertCount: unique.filter(i => i.threat && (i.threat.level === 'high' || i.threat.level === 'critical')).length,
  };
  phaseWriteCorrelations(correlationResult, writeResult.docPath, writeResult.ptPath, sourceStats);
  console.log('');

  console.log('▸ Фаза 8: mark processed');
  phaseMark();
  console.log('');

  const geoCount = sourceStats.geoCount;
  const alertCount = sourceStats.alertCount;
  const docCount = unique.length;
  const ptCount = unique.filter(isValidPoint).length;

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  ИТОГ                                            ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  Входных элементов:  ' + String(items.length).padEnd(28) + '║');
  console.log('║  Уникальных:         ' + String(unique.length).padEnd(28) + '║');
  console.log('║  Дубликатов:          ' + String(items.length - unique.length).padEnd(28) + '║');
  console.log('║  Геолокаций:         ' + String(geoCount).padEnd(28) + '║');
  console.log('║  Алертов:            ' + String(alertCount).padEnd(28) + '║');
  console.log('║  Документов:         ' + String(docCount).padEnd(28) + '║');
  console.log('║  Точек:              ' + String(ptCount).padEnd(28) + '║');
  console.log('║  Корреляций:         ' + String(correlationResult.stats.found).padEnd(28) + '║');
  console.log('╚══════════════════════════════════════════════════╝');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
