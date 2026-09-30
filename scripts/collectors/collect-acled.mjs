#!/usr/bin/env node
/**
 * Crucix Collector: ACLED (Armed Conflict Location & Event Data).
 * Версия 2.0.0. Принят 18.09.2026.
 *
 * Роль: собирает события конфликтов с координатами, сдаёт через saveRaw.
 * Сборщик НЕ пишет в basket напрямую — только raw + накладная.
 *
 * API: https://acleddata.com/api/acled/read
 * Аутентификация: OAuth (password grant).
 * Учётные данные: переменные окружения ACLED_EMAIL/ACLED_PASSWORD
 *   с fallback на data/secrets/acled.json (вне git).
 *
 * Формат данных ACLED: массив объектов с полями event_date, latitude,
 * longitude, country, event_type, sub_event_type, fatalities, notes.
 * Это points-тип (есть координаты и дата).
 */

import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const SECRETS_PATH = join(ROOT, 'data', 'secrets', 'acled.json');

async function loadCredentials() {
  if (process.env.ACLED_EMAIL && process.env.ACLED_PASSWORD) {
    return { email: process.env.ACLED_EMAIL, password: process.env.ACLED_PASSWORD };
  }
  try {
    const raw = await readFile(SECRETS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.email && parsed.password) return parsed;
  } catch (e) {
    // файла секретов нет
  }
  throw new Error('ACLED credentials not found: задайте ACLED_EMAIL и ACLED_PASSWORD или создайте data/secrets/acled.json');
}

async function getAccessToken(creds) {
  const tokenUrl = 'https://acleddata.com/oauth/token';
  const params = new URLSearchParams({
    username: creds.email,
    password: creds.password,
    grant_type: 'password',
    client_id: 'acled',
    scope: 'authenticated'
  });
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  if (!response.ok) {
    throw new Error(`OAuth: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  if (!data.access_token) throw new Error('Токен не получен');
  return data.access_token;
}

async function fetchACLEDData(token) {
  const baseUrl = 'https://acleddata.com/api/acled/read';
  const params = new URLSearchParams({
    _format: 'json',
    country: 'Ukraine',
    year: String(new Date().getFullYear()),
    fields: 'event_id_cnty,event_date,year,time_precision,disorder_type,event_type,sub_event_type,actor1,actor2,inter1,inter2,interaction,civilian_targeting,iso,region,country,admin1,admin2,location,latitude,longitude,geo_precision,source,source_scale,notes,fatalities,tags',
    limit: '1000'
  });
  const url = `${baseUrl}?${params.toString()}`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  });
  if (!response.ok) {
    throw new Error(`ACLED read: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  if (Array.isArray(data)) return data;
  if (data.data && Array.isArray(data.data)) return data.data;
  throw new Error('ACLED: неожиданный формат ответа (ни массив, ни data[])');
}

function normalizeAcledEvent(e) {
  return {
    date: e.event_date || null,
    latitude: Number(e.latitude),
    longitude: Number(e.longitude),
    country: e.country || null,
    region: e.region || null,
    admin1: e.admin1 || null,
    location: e.location || null,
    event_type: e.event_type || null,
    sub_event_type: e.sub_event_type || null,
    actor1: e.actor1 || null,
    actor2: e.actor2 || null,
    fatalities: Number(e.fatalities) || 0,
    notes: e.notes || null,
    source: e.source || null,
    event_id: e.event_id_cnty || null
  };
}

export async function collectACLED() {
  const t0 = Date.now();
  const creds = await loadCredentials();
  const token = await getAccessToken(creds);
  const rawEvents = await fetchACLEDData(token);
  const events = rawEvents.map(normalizeAcledEvent).filter(e =>
    Number.isFinite(e.latitude) && Number.isFinite(e.longitude) &&
    e.latitude >= -90 && e.latitude <= 90 &&
    e.longitude >= -180 && e.longitude <= 180
  );

  const result = await saveRaw('acled', events, {
    collector: 'collect-acled.mjs',
    source: 'ACLED Armed Conflict Location & Event Data',
    source_url: 'https://acleddata.com/api/acled/read',
    license: 'proprietary',
    format_hint: 'points',
    value_unit: 'count',
    granularity: 'event',
    record_count: events.length,
    notes: `Ukraine ${new Date().getFullYear()}, всего получено ${rawEvents.length}, валидных ${events.length}`,
    backwardCompat: true
  });

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[ACLED] OK ${events.length} событий за ${elapsed}с → ${result.raw_file}`);
  console.log(`[ACLED] Накладная: ${result.incoming_file}`);
  return events;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectACLED().catch((e) => { console.error('[ACLED] FATAL:', e.message); process.exit(1); });
}
