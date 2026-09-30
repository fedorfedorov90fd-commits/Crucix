/**
 * scripts/warehouse/region-mapper.mjs
 * Маппинг текстового региона на ISO 3166-1 alpha-3.
 *
 * 7-шаговый алгоритм (по плану Алисы):
 * 1. Точное совпадение по alpha-2 (если вход — 2 заглавные буквы).
 * 2. Точное совпадение по numeric (если вход — 3 цифры).
 * 3. Точное совпадение по by_alias_lower.
 * 4. Если 2+ совпадения в by_alias_lower → ambiguous.
 * 5. Поиск в by_name_lower из subdivisions.json (Калифорния → US-CA → US).
 * 6. Fuzzy matching (Levenshtein ≤2 для ≥5 символов; ≤1 для 3-4 символа).
 * 7. Не найдено → region: UNK, оригинал в unmapped.
 *
 * Контракт: export function resolveRegion(text) -> {iso3, subdivision, unmapped, original, source}
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const COUNTRIES_PATH = join(ROOT, 'data', 'reference', 'countries.json');
const SUBDIVISIONS_PATH = join(ROOT, 'data', 'reference', 'subdivisions.json');

let _countries = null;
let _subdivisions = null;

async function loadCountries() {
  if (_countries) return _countries;
  try {
    _countries = JSON.parse(await readFile(COUNTRIES_PATH, 'utf-8'));
  } catch (e) {
    _countries = { countries: {}, indexes: { by_alias_lower: {}, by_alpha2: {}, by_numeric: {} } };
  }
  return _countries;
}

async function loadSubdivisions() {
  if (_subdivisions) return _subdivisions;
  try {
    _subdivisions = JSON.parse(await readFile(SUBDIVISIONS_PATH, 'utf-8'));
  } catch (e) {
    _subdivisions = { subdivisions: {}, indexes: { by_name_lower: {} } };
  }
  return _subdivisions;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + cost);
    }
  }
  return d[m][n];
}

export async function resolveRegion(text) {
  const raw = text == null ? null : String(text).trim();
  if (!raw) return { iso3: null, subdivision: null, unmapped: false, original: null, source: 'empty' };

  const countries = await loadCountries();
  const subdivisions = await loadSubdivisions();

  // Шаг 0: прямой поиск по коду subdivision (XX-YY)
  if (/^[A-Z]{2}-[A-Z0-9]{1,3}$/.test(raw)) {
    const sub = subdivisions.subdivisions?.[raw];
    if (sub) {
      const iso3 = sub.country ? countries.indexes.by_alpha2?.[sub.country] : null;
      return { iso3: iso3 || null, subdivision: raw, unmapped: false, original: raw, source: 'subdivision_code' };
    }
  }

  // Шаг 1: alpha-2
  if (/^[A-Z]{2}$/.test(raw)) {
    const iso3 = countries.indexes.by_alpha2?.[raw];
    if (iso3) return { iso3, subdivision: null, unmapped: false, original: raw, source: 'alpha2' };
  }

  // Шаг 2: numeric
  if (/^\d{3}$/.test(raw)) {
    const iso3 = countries.indexes.by_numeric?.[raw];
    if (iso3) return { iso3, subdivision: null, unmapped: false, original: raw, source: 'numeric' };
  }

  // Шаг 3: by_alias_lower
  const key = raw.toLowerCase();
  const aliasHit = countries.indexes.by_alias_lower?.[key];
  if (aliasHit) {
    if (typeof aliasHit === 'string') {
      return { iso3: aliasHit, subdivision: null, unmapped: false, original: raw, source: 'alias' };
    }
    // Шаг 4: ambiguous
    if (aliasHit && aliasHit._ambiguous) {
      return { iso3: null, subdivision: null, unmapped: true, ambiguous: aliasHit._ambiguous, original: raw, source: 'ambiguous' };
    }
  }

  // Шаг 5: subdivisions по имени
  const subHit = subdivisions.indexes?.by_name_lower?.[key];
  if (subHit && subdivisions.subdivisions?.[subHit]) {
    const sub = subdivisions.subdivisions[subHit];
    const iso3 = sub.country ? countries.indexes.by_alpha2?.[sub.country] : null;
    return { iso3: iso3 || null, subdivision: subHit, unmapped: false, original: raw, source: 'subdivision' };
  }

  // Шаг 6: fuzzy
  if (raw.length >= 3) {
    const maxDist = raw.length >= 5 ? 2 : 1;
    const candidates = [];
    for (const [aliasKey, value] of Object.entries(countries.indexes.by_alias_lower || {})) {
      if (typeof value !== 'string') continue;
      if (Math.abs(aliasKey.length - key.length) > maxDist) continue;
      const dist = levenshtein(key, aliasKey);
      if (dist <= maxDist) candidates.push({ iso3: value, dist, alias: aliasKey });
    }
    // Оставляем только минимальную дистанцию
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.dist - b.dist);
      const best = candidates.filter(c => c.dist === candidates[0].dist);
      if (best.length === 1) {
        return { iso3: best[0].iso3, subdivision: null, unmapped: false, original: raw, source: 'fuzzy', distance: best[0].dist };
      }
    }
  }

  // Шаг 7: не найдено
  return { iso3: null, subdivision: null, unmapped: true, original: raw, source: 'unmapped' };
}

export async function resolveRegionIso3(text) {
  const r = await resolveRegion(text);
  return r.iso3 || null;
}

export const __internal = { levenshtein };

/**
 * Синхронная версия: требует предварительного вызова loadCountries() и loadSubdivisions().
 * Используется в адаптерах, где цикл синхронный.
 */
export async function warmup() {
  await loadCountries();
  await loadSubdivisions();
}

export function resolveRegionKeySync(text) {
  if (!_countries || !_subdivisions) {
    throw new Error('region-mapper: вызовите warmup() перед resolveRegionKeySync()');
  }
  const raw = text == null ? null : String(text).trim();
  if (!raw) return null;

  const countries = _countries;
  const subdivisions = _subdivisions;

  // Шаг 0: код subdivision XX-YY
  if (/^[A-Z]{2}-[A-Z0-9]{1,3}$/.test(raw)) {
    const sub = subdivisions.subdivisions?.[raw];
    if (sub && sub.country) {
      const iso3 = countries.indexes.by_alpha2?.[sub.country];
      if (iso3) return iso3;
    }
  }

  // Шаг 1: alpha-2
  if (/^[A-Z]{2}$/.test(raw)) {
    const iso3 = countries.indexes.by_alpha2?.[raw];
    if (iso3) return iso3;
  }

  // Шаг 2: numeric
  if (/^\d{3}$/.test(raw)) {
    const iso3 = countries.indexes.by_numeric?.[raw];
    if (iso3) return iso3;
  }

  // Шаг 3: alias (только строковый hit, не _ambiguous)
  const key = raw.toLowerCase();
  const aliasHit = countries.indexes.by_alias_lower?.[key];
  if (typeof aliasHit === 'string') return aliasHit;

  // Шаг 5: subdivisions по имени
  const subHit = subdivisions.indexes?.by_name_lower?.[key];
  if (subHit && subdivisions.subdivisions?.[subHit]) {
    const sub = subdivisions.subdivisions[subHit];
    if (sub.country) {
      const iso3 = countries.indexes.by_alpha2?.[sub.country];
      if (iso3) return iso3;
    }
  }

  // Шаг 6: fuzzy
  if (raw.length >= 3) {
    const maxDist = raw.length >= 5 ? 2 : 1;
    const candidates = [];
    for (const [aliasKey, value] of Object.entries(countries.indexes.by_alias_lower || {})) {
      if (typeof value !== 'string') continue;
      if (Math.abs(aliasKey.length - key.length) > maxDist) continue;
      const dist = levenshtein(key, aliasKey);
      if (dist <= maxDist) candidates.push({ iso3: value, dist });
    }
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.dist - b.dist);
      const best = candidates.filter(c => c.dist === candidates[0].dist);
      if (best.length === 1) return best[0].iso3;
    }
  }

  // Шаг 7: не найдено
  return null;
}

export async function getCountry(iso3) {
  const countries = await loadCountries();
  return countries.countries?.[iso3] || null;
}

/**
 * Синхронная версия getCountry: требует warmup().
 */
export function getCountrySync(iso3) {
  if (!_countries) {
    throw new Error('region-mapper: вызовите warmup() перед getCountrySync()');
  }
  return _countries.countries?.[iso3] || null;
}
