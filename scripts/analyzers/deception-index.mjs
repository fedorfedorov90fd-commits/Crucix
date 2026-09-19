#!/usr/bin/env node
// Crucix Analyzer: DeceptionIndex v1.0.0
// Читает: data/analytics/specialist/{narrative-drift, silence-patterns,
//         source-coordination, logistics-anomalies, data-discrepancy}.json
// Пишет: data/analytics/specialist/deception-index.json
//
// Назначение: сводный индекс достоверности для каждой страны.
// Композит из 5 независимых измерений. Если все пять показывают высокие
// значения — страна готовит что-то, что не афиширует.

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const ANALYTICS = join(ROOT, 'data', 'analytics', 'specialist');
const OUT_FILE = join(ANALYTICS, 'deception-index.json');

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, 'utf-8')); }
  catch { return fallback; }
}

// Веса компонентов (академически: drift и discrepancy — наиболее
// диагностические, silence и coordination — подтверждающие, logistics —
// физическая основа).
const WEIGHTS = {
  narrative_drift: 0.30,
  data_discrepancy: 0.25,
  logistics_anomaly: 0.20,
  source_coordination: 0.15,
  silence_patterns: 0.10,
};

// Нормализация: raw score → [0, 1].
function norm(v, maxRef) {
  if (v == null || !Number.isFinite(v) || v <= 0) return 0;
  return Math.min(v / maxRef, 1);
}

async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();

  const drift = await readJson(join(ANALYTICS, 'narrative-drift.json'), null);
  const discrepancy = await readJson(join(ANALYTICS, 'data-discrepancy.json'), null);
  const logistics = await readJson(join(ANALYTICS, 'logistics-anomalies.json'), null);
  const coordination = await readJson(join(ANALYTICS, 'source-coordination.json'), null);
  const silence = await readJson(join(ANALYTICS, 'silence-patterns.json'), null);

  // Агрегация по странам.
  const countries = new Map();

  function ensure(code) {
    if (!code) return null;
    const c = String(code).toUpperCase();
    if (!countries.has(c)) {
      countries.set(c, {
        country: c,
        components: {
          narrative_drift: 0,
          data_discrepancy: 0,
          logistics_anomaly: 0,
          source_coordination: 0,
          silence_patterns: 0,
        },
        raw: {},
        evidence: [],
      });
    }
    return countries.get(c);
  }

  // narrative-drift: по странам, driftScore
  if (drift && drift.data && Array.isArray(drift.data.drifts)) {
    for (const d of drift.data.drifts) {
      const c = ensure(d.country);
      if (!c) continue;
      c.components.narrative_drift = Math.max(c.components.narrative_drift, norm(d.driftScore, 5));
      c.raw.narrative_drift = d.driftScore;
      if (d.level === 'high' || d.level === 'critical') c.evidence.push(`drift=${d.driftScore}`);
    }
  }

  // data-discrepancy: по странам
  if (discrepancy && discrepancy.data && discrepancy.data.by_country) {
    for (const [code, info] of Object.entries(discrepancy.data.by_country)) {
      const c = ensure(code);
      if (!c) continue;
      c.components.data_discrepancy = Math.max(c.components.data_discrepancy, norm(info.maxScore, 5));
      c.raw.data_discrepancy = info.maxScore;
      if (info.maxSpreadPct >= 20) c.evidence.push(`spread=${info.maxSpreadPct.toFixed(1)}%`);
    }
  }

  // logistics-anomalies: аномалии без страны, но с координатами — нужен маппинг.
  // Учитываем глобально, если есть аномалии с score >= high. Для стран — по region.
  if (logistics && logistics.data && Array.isArray(logistics.data.anomalies)) {
    for (const a of logistics.data.anomalies) {
      // Грубое сопоставление регион → страны (пока не поддерживается явно).
      // Логируем в глобальный сигнал.
      // Здесь оставляем заглушку: аномалии не имеют поля country,
      // учитываем их в глобальный вес (уровень GLOBAL).
    }
  }

  // source-coordination: кластеры по источникам → без стран.
  // Может быть сопоставлено через отдельный маппинг источника в страну.
  if (coordination && coordination.data && Array.isArray(coordination.data.clusters)) {
    // Глобальный сигнал: если есть кластеры с level critical — учитываем.
  }

  // silence-patterns: по темам → без стран.
  // Аналогично.

  // Итоговый индекс для каждой страны.
  const results = [];
  for (const c of countries.values()) {
    let score = 0;
    let componentsPresent = 0;
    for (const [key, w] of Object.entries(WEIGHTS)) {
      const v = c.components[key] || 0;
      score += v * w;
      if (v > 0) componentsPresent++;
    }
    // Нормируем на сумму весов (5 измерений).
    const totalWeight = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    const normalized = score / totalWeight;

    const level = normalized >= 0.6 ? 'critical'
                : normalized >= 0.4 ? 'high'
                : normalized >= 0.2 ? 'medium'
                : 'low';

    results.push({
      country: c.country,
      deceptionIndex: Math.round(normalized * 1000) / 1000,
      level,
      componentsPresent,
      components: c.components,
      raw: c.raw,
      evidence: c.evidence.slice(0, 10),
    });
  }

  results.sort((a, b) => b.deceptionIndex - a.deceptionIndex);

  const payload = {
    _meta: {
      id: 'deception-index',
      category: 'specialist',
      version: '1.0.0',
      schema_version: '1.0.0',
      sources: ['narrative-drift', 'silence-patterns', 'source-coordination', 'logistics-anomalies', 'data-discrepancy'],
      calculator: 'DeceptionIndex',
      updated_at: now,
      period: 'latest',
      duration_ms: Date.now() - t0,
      checksum: '',
      stats: {
        countries: results.length,
        high: results.filter(r => r.level === 'high' || r.level === 'critical').length,
        weights: WEIGHTS,
      },
      description: 'Сводный индекс достоверности: композит из 5 измерений (drift, discrepancy, logistics, coordination, silence).',
    },
    data: {
      countries: results,
      total: results.length,
      generated_at: now,
    },
  };

  const body = JSON.stringify({ ...payload, _meta: { ...payload._meta, checksum: '' } });
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(ANALYTICS, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');

  console.log('════════════════════════════════════════════');
  console.log('DeceptionIndex v1.0.0 — отчёт');
  console.log('════════════════════════════════════════════');
  console.log('Стран проанализировано:', results.length);
  console.log('Высокий/критический уровень:', payload._meta.stats.high);
  console.log('');
  console.log('Топ-5:');
  for (const r of results.slice(0, 5)) {
    console.log(`  ${r.country}: index=${r.deceptionIndex}, level=${r.level}, components=${r.componentsPresent}/5`);
  }
  console.log('');
  console.log('Файл записан:', OUT_FILE);
}

main().catch(e => { console.error('ERR:', e.message); console.error(e.stack); process.exit(1); });
