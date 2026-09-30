/**
 * Адаптер events.
 * Версия 2.2.0. Принят 20.09.2026.
 *
 * Назначение: нормализация источников с новостными событиями
 * (GDELT, RSS, NewsAPI, feeds). Особенности:
 *   - дата может называться seendate, published_at, pubDate, date, timestamp
 *   - страна может быть alpha-2 (US, RU), alpha-3 (USA, RUS) или текстом
 *   - точки строятся через центроид страны (из единого справочника)
 *   - title, url, domain, language — в extra точки
 *   - documents[] — по одной записи на каждую новость (для NLP и нарратив-анализа)
 *
 * ВЕРСИЯ 2.0.0 использует ЕДИНЫЙ справочник data/reference/countries.json,
 * который собирает в себе country-characteristics, country-coords, country-aliases
 * и таблицу alpha-2. Одна карта by_alias_lower — для всех видов входных данных.
 *
 * Результат: объект crucix.basket.v1 с series + points + regions + documents.
 *
 * Изменение 2.1.0: passThroughV1Object для готовых v1-объектов {points, series,
 *   regions, documents}. Универсальный принцип: адаптер НЕ теряет данные.
 *
 * Изменение 2.2.0: формирование documents[] из каждой строки-события.
 *   Обязательные поля: id, text. Опциональные: title, url, lang, timestamp, region,
 *   source, category, extra. Правило: одна новость → один документ.
 *   Если у строки нет ни title, ни description — документ не создаётся.
 *
 * Контракт: export async function normalize(rawData, meta) -> объект.
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import {warmup as mapperWarmup, resolveRegionKeySync, getCountry, getCountrySync } from '../region-mapper.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');
const COUNTRIES_PATH = join(ROOT, 'data', 'reference', 'countries.json');


const DATE_FIELDS = ['seendate', 'published_at', 'pubDate', 'pubDate', 'date', 'timestamp', 'time', 'datetime', 'ts', 'created_at'];
const REGION_FIELDS = ['sourcecountry', 'country', 'country_code', 'region', 'countryCode', 'sourceCountry'];
const TITLE_FIELDS = ['title', 'headline', 'name', 'summary', 'description'];
const DESCRIPTION_FIELDS = ['description', 'summary', 'content', 'text', 'body', 'abstract'];
const URL_FIELDS = ['url', 'link', 'sourceurl', 'source_url'];
const DOMAIN_FIELDS = ['domain', 'source', 'publisher', 'site'];
const LANG_FIELDS = ['language', 'lang', 'sourcelanguage'];
const VALUE_FIELDS = ['value', 'count', 'score', 'weight', 'importance'];
const CATEGORY_FIELDS = ['category', 'section', 'topic'];

function pickString(obj, fields) {
  for (const f of fields) {
    const v = obj[f];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
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

function normalizeTimestamp(raw) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'string') {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  if (typeof raw === 'number') {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function makeDocId(row, index) {
  const url = pickString(row, URL_FIELDS);
  if (url) return createHash('md5').update(url).digest('hex').slice(0, 16);
  const title = pickString(row, TITLE_FIELDS);
  if (title) return createHash('md5').update(title).digest('hex').slice(0, 16);
  return 'evt-' + index + '-' + Date.now();
}

// v2.1.0: pass-through готового v1-объекта.
function passThroughV1Object(rawData, rawMeta) {
  const points = Array.isArray(rawData.points) ? rawData.points : [];
  const series = Array.isArray(rawData.series) ? rawData.series : [];
  const regions = Array.isArray(rawData.regions) ? rawData.regions : [];
  const documents = Array.isArray(rawData.documents) ? rawData.documents : [];
  const graph = rawData.graph && typeof rawData.graph === 'object' ? rawData.graph : null;
  const count = points.length + series.length + regions.length + documents.length;
  const valueUnit = rawMeta.value_unit || rawData.value_unit || 'count';
  const valueType = rawMeta.value_type || rawData.value_type || 'count';
  const granularity = rawMeta.granularity || rawData.granularity || 'event';
  const result = {
    schema: 'crucix.basket.v1',
    count, granularity,
    value_unit: valueUnit,
    value_scale: rawMeta.value_scale || rawData.value_scale || null,
    value_type: valueType,
    value_range: rawMeta.value_range !== undefined ? rawMeta.value_range : (rawData.value_range || null),
    series, points,
    regions: regions.map(r => ({ ...r, aggregation: r.aggregation || 'count' })),
    extra: {
      adapter: 'events',
      adapter_version: '2.2.0',
      passthrough_v1: true,
      series_count: series.length,
      points_count: points.length,
      regions_count: regions.length,
      documents_count: documents.length
    }
  };
  if (documents.length > 0) result.documents = documents;
  if (graph) result.graph = graph;
  if (rawData.extra && typeof rawData.extra === 'object') Object.assign(result.extra, rawData.extra);
  return result;
}

export async function normalize(rawData, meta) {
  const rawMeta = meta || {};

  // v2.1.0: ГОТОВЫЙ v1-объект — используем напрямую
  if (rawData && !Array.isArray(rawData) && typeof rawData === 'object'
      && (Array.isArray(rawData.points) || Array.isArray(rawData.series) || Array.isArray(rawData.regions))) {
    return passThroughV1Object(rawData, rawMeta);
  }

  let arr = rawData;
  let outerExtra = {};
  if (!Array.isArray(rawData)) {
    if (rawData && typeof rawData === 'object') {
      const keys = ['articles', 'items', 'data', 'events', 'news', 'feed', 'results', 'entries', 'rows'];
      const found = keys.find(k => Array.isArray(rawData[k]));
      if (found) {
        arr = rawData[found];
        const metaKeys = ['source', 'lastUpdated', 'queries', 'count', 'collectedAt', 'mode', 'totalSources', 'successCount', 'failCount', 'totalItems'];
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
  const documents = [];
  const unmappedRegions = new Set();
  const dates = new Set();
  let totalEvents = 0;
  let skippedNoDate = 0;
  let skippedNoText = 0;
  let pointsFromCentroids = 0;

  for (let i = 0; i < arr.length; i++) {
    const row = arr[i];
    if (!row || typeof row !== 'object') continue;

    const dateRaw = pickString(row, DATE_FIELDS) || row.pubDate || row.published_at;
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

    // Documents — по одной записи на каждую новость (v2.2.0)
    const title = pickString(row, TITLE_FIELDS);
    const description = pickString(row, DESCRIPTION_FIELDS);
    const text = description || title;
    if (!text) { skippedNoText++; continue; }

    const url = pickString(row, URL_FIELDS);
    const lang = pickString(row, LANG_FIELDS);
    const source = pickString(row, DOMAIN_FIELDS);
    const category = pickString(row, CATEGORY_FIELDS);
    const timestamp = normalizeTimestamp(dateRaw) || (date + 'T00:00:00Z');

    const doc = {
      id: makeDocId(row, i),
      text: text
    };
    if (title && title !== text) doc.title = title;
    if (url) doc.url = url;
    if (lang) doc.lang = lang;
    if (timestamp) doc.timestamp = timestamp;
    if (regionIso3 && regionIso3 !== 'GLOBAL') doc.region = regionIso3;
    doc.extra = {};
    if (source) doc.extra.source = source;
    if (category) doc.extra.category = category;
    if (Object.keys(doc.extra).length === 0) delete doc.extra;

    documents.push(doc);
  }

  const series = Array.from(seriesMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const regions = Array.from(regionsMap.values()).map(r => ({
    region: r.region,
    value: r.count,
    count: r.count,
    aggregation: 'count'
  }));

  const result = {
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
      adapter_version: '2.2.0',
      total_events: totalEvents,
      unique_dates: dates.size,
      skipped_no_date: skippedNoDate,
      skipped_no_text: skippedNoText,
      points_from_centroids: pointsFromCentroids,
      documents_count: documents.length,
      unmapped_regions: Array.from(unmappedRegions),
      unmapped_count: unmappedRegions.size,
      ...outerExtra
    }
  };

  if (documents.length > 0) result.documents = documents;

  return result;
}
