#!/usr/bin/env node
/**
 * Crucix Collector: infrastructure.
 * Версия 2.0.0. Принят 18.09.2026.
 *
 * Роль: читает data/infrastructure/objects.json (справочник объектов),
 * нормализует координаты и уязвимость, сдаёт на склад через collector-helper.
 * Сборщик НЕ пишет в basket напрямую — только raw + накладная.
 *
 * Формат входа: {objects: [...]} | [...] | {features: [...]}.
 * Координаты: coordinates.{lat,lng} | geometry.coordinates | плоские lat/lon.
 * Уязвимость: vulnerability 0-10 → severity 0-1.
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { saveRaw } from './lib/collector-helper.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const SRC = join(ROOT, 'data', 'infrastructure', 'objects.json');

function normVulnerability(v) {
  if (v == null) return 0.5;
  const n = Number(v);
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(Math.max(n / 10, 0), 1);
}

function coordsFrom(o) {
  if (o.coordinates && typeof o.coordinates === 'object') {
    const lat = o.coordinates.lat ?? o.coordinates.latitude;
    const lon = o.coordinates.lng ?? o.coordinates.lon ?? o.coordinates.longitude;
    if (lat != null && lon != null) return { lat: Number(lat), lon: Number(lon) };
  }
  if (o.geometry && Array.isArray(o.geometry.coordinates)) {
    const [lon, lat] = o.geometry.coordinates;
    if (lat != null && lon != null) return { lat: Number(lat), lon: Number(lon) };
  }
  const lat = o.lat ?? o.latitude;
  const lon = o.lon ?? o.lng ?? o.longitude;
  if (lat != null && lon != null) return { lat: Number(lat), lon: Number(lon) };
  return null;
}

function normalizeObject(o) {
  const c = coordsFrom(o);
  if (!c) return null;
  return {
    id: o.id || null,
    name: o.name || (o.properties && o.properties.name) || null,
    type: o.type || (o.properties && o.properties.type) || null,
    layer: o.layer || null,
    country: o.country || (o.properties && o.properties.country) || null,
    lat: c.lat,
    lon: c.lon,
    severity: normVulnerability(o.vulnerability),
    vulnerability: o.vulnerability ?? null,
    status: o.status || null,
    statusReason: o.statusReason || null,
    capacity: o.capacity ?? null,
    unit: o.unit || null,
    owner: o.owner || null,
    operational: o.operational ?? null,
    risks: o.risks || [],
    cascade: o.cascade || [],
    timestamp: new Date().toISOString()
  };
}

export async function collectInfrastructure() {
  let src;
  try {
    src = JSON.parse(await readFile(SRC, 'utf-8'));
  } catch (e) {
    throw new Error(`Ошибка чтения ${SRC}: ${e.message}`);
  }

  const objs = Array.isArray(src) ? src : (src.objects || src.features || []);
  const out = [];
  let skipped = 0;

  for (const o of objs) {
    const n = normalizeObject(o);
    if (!n) { skipped++; continue; }
    out.push(n);
  }

  const result = await saveRaw('infrastructure', out, {
    collector: 'collect-infrastructure.mjs',
    source: 'Crucix infrastructure objects',
    source_url: 'local://data/infrastructure/objects.json',
    license: 'proprietary',
    format_hint: 'points',
    value_unit: 'severity_0_1',
    value_scale: '0-1',
    granularity: 'snapshot',
    record_count: out.length,
    notes: `Пропущено ${skipped} без координат`,
    backwardCompat: true
  });

  console.log(`[INFRA] OK ${out.length} объектов (пропущено ${skipped}) → ${result.raw_file}`);
  console.log(`[INFRA] Накладная: ${result.incoming_file}`);
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectInfrastructure().catch((e) => { console.error('[INFRA] FAIL:', e); process.exit(1); });
}
