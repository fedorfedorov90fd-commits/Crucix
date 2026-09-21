#!/usr/bin/env node
/**
 * Crucix Collector: Celestrak satellites.
 * Версия 2.0.0. Принят 20.09.2026.
 *
 * Роль: загружает данные о спутниках с Celestrak.org (11 групп, без ключа)
 * и сдаёт на склад через collector-helper. Сборщик НЕ пишет в basket —
 * только в raw + накладную. Кладовщик managerbasket.mjs нормализует
 * и укладывает в basket.
 *
 * Источник: https://celestrak.org/NORAD/elements/gp.php
 * Группы: stations, visual, iridium, starlink, oneweb, gps-ops, glo-ops,
 *         galileo, beidou, intelsat, active.
 *
 * Формат ответа: { source, lastUpdated, groups, totalSatellites, satellites, note }.
 * Тип — points (снимок позиций спутников).
 */

import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const GROUPS = [
  'stations', 'visual', 'iridium', 'starlink', 'oneweb',
  'gps-ops', 'glo-ops', 'galileo', 'beidou', 'intelsat', 'active',
];

const MAX_PER_GROUP = 50;
const TIMEOUT_MS = 15000;

async function fetchGroup(group) {
  const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      return { group, error: `HTTP ${res.status}`, data: [] };
    }
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return { group, total: data.length, data: data.slice(0, MAX_PER_GROUP) };
    }
    return { group, total: 0, data: [] };
  } catch (e) {
    clearTimeout(timer);
    return { group, error: e.message, data: [] };
  }
}

function buildDemoFallback() {
  return {
    source: 'Celestrak',
    lastUpdated: new Date().toISOString(),
    groups: ['stations', 'starlink', 'gps-ops'],
    totalSatellites: 3,
    satellites: {
      stations: [{ name: 'ISS', id: '25544', group: 'stations' }],
      starlink: [{ name: 'Starlink-1000', id: '50000', group: 'starlink' }],
      'gps-ops': [{ name: 'GPS IIR-1', id: '24876', group: 'gps-ops' }],
    },
    note: 'Демо-данные (Celestrak API недоступен)',
  };
}

export async function collectCelestrak() {
  const start = Date.now();
  console.log('[Celestrak] Загрузка данных о спутниках...');

  const results = {};
  const errors = [];

  for (const group of GROUPS) {
    console.log(`[Celestrak] Загрузка группы: ${group}...`);
    const r = await fetchGroup(group);
    if (r.error) {
      console.log(`[Celestrak] ⚠️  Группа ${group}: ${r.error}`);
      errors.push({ group, error: r.error });
      continue;
    }
    if (r.data.length > 0) {
      results[group] = r.data;
      console.log(`[Celestrak] ✅ Группа ${group}: ${r.total} спутников (взято ${r.data.length})`);
    } else {
      console.log(`[Celestrak] ⚠️  Группа ${group}: 0 спутников`);
    }
  }

  let basketData;
  if (Object.keys(results).length === 0) {
    console.log('[Celestrak] Все группы недоступны, используется demo-fallback');
    basketData = buildDemoFallback();
  } else {
    basketData = {
      source: 'Celestrak',
      lastUpdated: new Date().toISOString(),
      groups: Object.keys(results),
      totalSatellites: Object.values(results).reduce((sum, arr) => sum + arr.length, 0),
      satellites: results,
      note: 'Данные загружены через Celestrak API (без ключа)',
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  const result = await saveRaw('celestrak', basketData, {
    collector: 'collect-celestrak.mjs',
    source: 'Celestrak (NORAD GP API)',
    source_url: 'https://celestrak.org/NORAD/elements/gp.php',
    license: 'public-domain',
    format_hint: 'points',
    value_type: 'count',
    value_unit: 'count',
    value_scale: null,
    granularity: 'snapshot',
    period: null,
    record_count: basketData.totalSatellites,
    notes: `${GROUPS.length} групп, лимит ${MAX_PER_GROUP} на группу, ошибок: ${errors.length}`,
    backwardCompat: true,
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[Celestrak] OK ${basketData.totalSatellites} спутников за ${elapsed}с → ${result.raw_file}`);
  console.log(`[Celestrak] Накладная: ${result.incoming_file}`);
  console.log(`[Celestrak] Группы: ${basketData.groups.join(', ')}`);

  return basketData;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectCelestrak().catch((e) => { console.error('[Celestrak] FATAL:', e); process.exit(1); });
}
