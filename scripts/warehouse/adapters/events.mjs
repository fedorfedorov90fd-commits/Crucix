/**
 * Адаптер events.
 * Версия 2.0.0. Принят 18.09.2026.
 *
 * Назначение: нормализация источников с новостными событиями
 * (GDELT, RSS, NewsAPI, feeds). Особенности:
 *   - дата может называться seendate, published_at, pubDate, date, timestamp
 *   - страна может быть alpha-2 (US, RU), alpha-3 (USA, RUS) или текстом
 *   - точки строятся через центроид страны (из единого справочника)
 *   - title, url, domain, language — в extra точки
 *
 * ВЕРСИЯ 2.0.0 использует ЕДИНЫЙ справочник data/reference/countries.json,
 * который собирает в себе country-characteristics, country-coords, country-aliases
 * и таблицу alpha-2. Одна карта by_alias_lower — для всех видов входных данных.
 *
 * Результат: объект crucix.basket.v1 с series + points + regions.
 *
 * Контракт: export async function normalize(rawData, meta) -> объект.
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {warmup as mapperWarmup, resolveRegionKeySync, getCountry, getCountrySync } from '../region-mapper.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');
const COUNTRIES_PATH = join(ROOT, 'data', 'reference', 'countries.json');


const DATE_FIELDS = ['seendate', 'published_at', 'pubDate', 'date', 'timestamp', 'time', 'datetime', 'ts', 'created_at'];
const REGION_FIELDS = ['sourcecountry', 'country', 'country_code', 'region', 'countryCode', 'sourceCountry'];
const TITLE_FIELDS = ['title', 'headline', 'name', 'summary', 'description'];
const URL_FIELDS = ['url', 'link', 'sourceurl', 'source_url'];
const DOMAIN_FIELDS = ['domain', 'source', 'publisher', 'site'];
const LANG_FIELDS = ['language', 'lang', 'sourcelanguage'];
const VALUE_FIELDS = ['value', 'count', 'score', 'weight', 'importance'];

function pickString(obj, fields) {
  for (const f of fields) {
    const v = obj[f];
    if (typeof v === 'string' && v.trim().length > 0) return v;
  }
  return null;
}

function pickNumeric(obj, fields) {
  for (const f of fields) {
    const v = obj[f];
    if (v === undefined || v === null) continue;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = Number(v.replace(/,/g, ''));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function normalizeDate(raw) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'string') {
    const gdelt = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
    if (gdelt) return `${gdelt[1]}-${gdelt[2]}-${gdelt[3]}`;
    if (raw.length === 10) return raw;
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (typeof raw === 'number') {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

export async function normalize(rawData, meta) {
  let arr = rawData;
  let outerExtra = {};
  if (!Array.isArray(rawData)) {
    if (rawData && typeof rawData === 'object') {
      const keys = ['articles', 'items', 'data', 'events', 'news', 'feed', 'results', 'entries', 'rows'];
      const found = keys.find(k => Array.isArray(rawData[k]));
      if (found) {
        arr = rawData[found];
        const metaKeys = ['source', 'lastUpdated', 'queries', 'count'];
        for (const k of metaKeys) if (rawData[k] !== undefined) outerExtra[k] = rawData[k];
        outerExtra.inner_array_key = found;
      } else {
        arr = [rawData];
        outerExtra.wrapped_single_object = true;
      }
    } else {
      throw new Error(`events.normalize: ожидается массив или объект, получено ${typeof rawData}`);
    }
  }

  const countries = await mapperWarmup();

  const seriesMap = new Map();
  const regionsMap = new Map();
  const points = [];
  const unmappedRegions = new Set();
  const dates = new Set();
  let totalEvents = 0;
  let skippedNoDate = 0;
  let pointsFromCentroids = 0;

  for (const row of arr) {
    if (!row || typeof row !== 'object') continue;

    const dateRaw = pickString(row, DATE_FIELDS);
    const date = normalizeDate(dateRaw);
    if (!date) { skippedNoDate++; continue; }

    const regionRaw = pickString(row, REGION_FIELDS);
    const regionKey = resolveRegionKeySync(regionRaw);
    const regionEntry = regionKey && getCountrySync(regionKey) ? getCountrySync(regionKey) : null;

    const value = pickNumeric(row, VALUE_FIELDS);
    const eventValue = value === null ? 1 : value;

    dates.add(date);
    totalEvents += 1;

    // Series — агрегат по дате
    if (!seriesMap.has(date)) seriesMap.set(date, { date, value: 0 });
    seriesMap.get(date).value += eventValue;

    // Regions — агрегат по региону
    const regionIso3 = regionKey || regionRaw || 'GLOBAL';
    if (!regionsMap.has(regionIso3)) regionsMap.set(regionIso3, { region: regionIso3, count: 0 });
    regionsMap.get(regionIso3).count += 1;

    if (!regionKey && regionRaw) unmappedRegions.add(regionRaw);

    // Points — центроид страны
    if (regionEntry && regionEntry.centroid && typeof regionEntry.centroid.lat === 'number' && typeof regionEntry.centroid.lon === 'number') {
      points.push({
        lat: regionEntry.centroid.lat,
        lon: regionEntry.centroid.lon,
        value: eventValue,
        label: pickString(row, TITLE_FIELDS) || null,
        region: regionIso3,
        timestamp: date + 'T00:00:00Z',
        extra: {
          url: pickString(row, URL_FIELDS) || null,
          domain: pickString(row, DOMAIN_FIELDS) || null,
          language: pickString(row, LANG_FIELDS) || null
        }
      });
      pointsFromCentroids += 1;
    }
  }

  const series = Array.from(seriesMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const regions = Array.from(regionsMap.values()).map(r => ({
    region: r.region,
    value: r.count,
    count: r.count,
    aggregation: 'count'
  }));

  const rawMeta = meta || {};
  return {
    schema: 'crucix.basket.v1',
    count: totalEvents,
    granularity: dates.size > 1 ? 'event' : 'snapshot',
    value_unit: rawMeta.value_unit || 'count',
    value_scale: rawMeta.value_scale || null,
    value_type: 'count',
    value_range: null,
    series,
    points,
    regions,
    extra: {
      adapter: 'events',
      adapter_version: '2.0.0',
      total_events: totalEvents,
      unique_dates: dates.size,
      skipped_no_date: skippedNoDate,
      points_from_centroids: pointsFromCentroids,
      unmapped_regions: Array.from(unmappedRegions),
      unmapped_count: unmappedRegions.size,
      ...outerExtra
    }
  };
}
