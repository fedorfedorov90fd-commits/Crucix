/**
 * cross-stream-correlation-api.mjs — кросс-стримовая корреляция событий
 * Версия 3.0.0 (20.09.2026). Правило "минимум два ненулевых компонента" + штраф за страну.
 * Зависимости: ноль. Портабельно.
 *
 * Что изменилось относительно v2.0.0:
 *   - Правило значимости: корреляция засчитывается только если минимум ДВА
 *     из трёх компонентов (time, geo, entity) строго больше нуля.
 *     Это отсекает ложные "geo-only" пары (обе статьи про Китай → geo=1, time=0, entity=0).
 *   - Штраф за matchType: 'country'. Если гео-привязка элемента — на уровне страны,
 *     geoScore умножается на 0.5. Совпадение по стране — не то же самое, что по городу.
 *   - Формат ответа, веса, пороги уровней — БЕЗ ИЗМЕНЕНИЙ.
 */

const TIME_WEIGHT = 0.4;
const GEO_WEIGHT = 0.4;
const ENTITY_WEIGHT = 0.2;
const TIME_WINDOW_HOURS = 6;
const GEO_WINDOW_KM = 500;
const COUNTRY_PENALTY = 0.5;
const MIN_NONZERO_COMPONENTS = 2;

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function parseTime(s) {
  if (!s) return NaN;
  const t = new Date(s).getTime();
  return isNaN(t) ? NaN : t;
}

function timeScore(a, b) {
  const ta = parseTime(a), tb = parseTime(b);
  if (isNaN(ta) || isNaN(tb)) return 0;
  const diffH = Math.abs(ta - tb) / (1000 * 60 * 60);
  if (diffH > TIME_WINDOW_HOURS * 4) return 0;
  return Math.max(0, 1 - diffH / TIME_WINDOW_HOURS);
}

function geoScore(a, b) {
  if (!a?.lat || !b?.lat) return 0;
  const km = haversine(a.lat, a.lon, b.lat, b.lon);
  if (km > GEO_WINDOW_KM * 2) return 0;
  const base = Math.max(0, 1 - km / GEO_WINDOW_KM);
  // Штраф, если хотя бы одна привязка — на уровне страны.
  const aCountry = a.matchType === 'country';
  const bCountry = b.matchType === 'country';
  const penalty = (aCountry || bCountry) ? COUNTRY_PENALTY : 1;
  return base * penalty;
}

function fastGeoReject(a, b) {
  if (!a?.lat || !b?.lat) return false;
  const km = haversine(a.lat, a.lon, b.lat, b.lon);
  return km > GEO_WINDOW_KM * 2;
}

function entityOverlap(a, b) {
  if (!a || !b) return 0;
  const sa = new Set([
    ...(a.persons || []).map(s => s.toLowerCase()),
    ...(a.organizations || []).map(s => s.toLowerCase()),
    ...(a.locations || []).map(s => s.toLowerCase()),
  ].filter(Boolean));
  const sb = new Set([
    ...(b.persons || []).map(s => s.toLowerCase()),
    ...(b.organizations || []).map(s => s.toLowerCase()),
    ...(b.locations || []).map(s => s.toLowerCase()),
  ].filter(Boolean));
  if (sa.size === 0 || sb.size === 0) return 0;
  const inter = [...sa].filter(x => sb.has(x)).length;
  return inter / Math.min(sa.size, sb.size);
}

export function findCorrelations(events, opts = {}) {
  const timeW = opts.timeWeight || TIME_WEIGHT;
  const geoW = opts.geoWeight || GEO_WEIGHT;
  const entW = opts.entityWeight || ENTITY_WEIGHT;
  const timeWindowH = opts.timeWindowHours || TIME_WINDOW_HOURS;
  const minNonzero = opts.minNonzeroComponents || MIN_NONZERO_COMPONENTS;

  const prepared = events.map((ev, idx) => ({
    ev,
    idx,
    t: parseTime(ev.date || ev.pubDate || ev.isoDate || ev.collectedAt),
    geo: ev.geo || ev.location || null,
  }));

  prepared.sort((x, y) => {
    const tx = isNaN(x.t) ? -Infinity : x.t;
    const ty = isNaN(y.t) ? -Infinity : y.t;
    if (tx !== ty) return tx - ty;
    return x.idx - y.idx;
  });

  const correlations = [];
  const maxTimeGap = timeWindowH * 4 * 60 * 60 * 1000;

  for (let i = 0; i < prepared.length; i++) {
    const A = prepared[i];
    const a = A.ev;

    for (let j = i + 1; j < prepared.length; j++) {
      const B = prepared[j];
      const b = B.ev;

      if (!isNaN(A.t) && !isNaN(B.t)) {
        const gap = Math.abs(B.t - A.t);
        if (gap > maxTimeGap) break;
      }

      if (a.stream && b.stream && a.stream === b.stream) continue;
      if (fastGeoReject(A.geo, B.geo)) continue;

      const ts = timeScore(a.date || a.pubDate, b.date || b.pubDate);
      const gs = geoScore(A.geo, B.geo);
      const es = entityOverlap(a.entities, b.entities);

      // ПРАВИЛО: корреляция засчитывается только если минимум ДВА компонента ненулевые.
      const nonzeroCount = [ts > 0, gs > 0, es > 0].filter(Boolean).length;
      if (nonzeroCount < minNonzero) continue;

      const score = ts * timeW + gs * geoW + es * entW;
      if (score >= 0.35) {
        let level;
        if (score >= 0.7) level = 'high';
        else if (score >= 0.5) level = 'medium';
        else level = 'low';

        correlations.push({
          eventA: { id: a.id || a.guid || a.title, stream: a.stream, title: a.title },
          eventB: { id: b.id || b.guid || b.title, stream: b.stream, title: b.title },
          score: Math.round(score * 100) / 100,
          level,
          components: {
            time: Math.round(ts * 100) / 100,
            geo: Math.round(gs * 100) / 100,
            entity: Math.round(es * 100) / 100,
          },
          nonzeroComponents: nonzeroCount,
        });
      }
    }
  }

  correlations.sort((a, b) => b.score - a.score);

  return {
    correlations,
    stats: {
      totalPairs: events.length * (events.length - 1) / 2,
      found: correlations.length,
      high: correlations.filter(c => c.level === 'high').length,
      medium: correlations.filter(c => c.level === 'medium').length,
      low: correlations.filter(c => c.level === 'low').length,
    },
  };
}

export default { findCorrelations };
