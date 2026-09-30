/**
 * event-deduplicator-api.mjs — дедупликация событий
 * Версия 2.0.0 (20.09.2026). Оптимизация O(N²) → O(N·k) через блокировку по времени и source.
 * Зависимости: ноль. Портабельно.
 *
 * Что изменилось относительно v1.0.0:
 *   - Индекс guid: точное совпадение за O(1) вместо прохода по всему seen.
 *   - Сортировка по времени + sliding window по окну TIME_WINDOW_HOURS:
 *     внутренний цикл прерывается, как только dt > windowH.
 *   - Группировка по source: similarity считается только внутри группы источников.
 *   - Формат ответа, пороги, формулы, similarity() — БЕЗ ИЗМЕНЕНИЙ.
 */

const THRESHOLD = 0.72;
const TIME_WINDOW_HOURS = 48;

function normalizeTitle(s) {
  return (s || '').toLowerCase()
    .replace(/[«»""'']/g, '')
    .replace(/[^\p{L}\p{N}\s\-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length, n = b.length;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function similarity(a, b) {
  const na = normalizeTitle(a), nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.length > 60 || nb.length > 60) {
    const sa = new Set(na.split(' ').filter(w => w.length > 2));
    const sb = new Set(nb.split(' ').filter(w => w.length > 2));
    if (sa.size === 0 || sb.size === 0) return 0;
    const inter = [...sa].filter(w => sb.has(w)).length;
    const uni = new Set([...sa, ...sb]).size;
    return inter / uni;
  }
  const maxLen = Math.max(na.length, nb.length);
  return 1 - (levenshtein(na, nb) / maxLen);
}

function parseTime(s) {
  if (!s) return NaN;
  const t = new Date(s).getTime();
  return isNaN(t) ? NaN : t;
}

function timeDeltaHours(a, b) {
  const ta = parseTime(a), tb = parseTime(b);
  if (isNaN(ta) || isNaN(tb)) return Infinity;
  return Math.abs(ta - tb) / (1000 * 60 * 60);
}

function extractGuid(ev) {
  return ev.guid || ev.id || ev.link || '';
}

function extractTime(ev) {
  return ev.pubDate || ev.date || ev.isoDate || ev.collectedAt || '';
}

function extractSource(ev) {
  return (ev.source || ev.author || ev.feed || '').toString().toLowerCase().trim();
}

export function deduplicate(events, opts = {}) {
  const threshold = opts.threshold || THRESHOLD;
  const windowH = opts.timeWindowHours || TIME_WINDOW_HOURS;

  // Шаг 1: сортировка по времени (элементы без даты идут первыми, с датой — по возрастанию).
  // Сортировка не меняет состав, только порядок обхода.
  const sorted = events.map((ev, idx) => ({ ev, idx, t: parseTime(extractTime(ev)) }))
    .sort((x, y) => {
      const tx = isNaN(x.t) ? -Infinity : x.t;
      const ty = isNaN(y.t) ? -Infinity : y.t;
      if (tx !== ty) return tx - ty;
      return x.idx - y.idx;
    })
    .map(x => x.ev);

  // Шаг 2: индексы для быстрого поиска.
  const guidIndex = new Map();       // guid → { guid, title, date }
  const bySource = new Map();        // source → массив { guid, title, date, t }
  const noSource = [];               // элементы без source — сравниваются между собой

  const unique = [];
  const duplicates = [];

  for (const ev of sorted) {
    const evGuid = extractGuid(ev);
    const evTitle = ev.title || '';
    const evDate = extractTime(ev);
    const evT = parseTime(evDate);
    const evSource = extractSource(ev);

    let isDup = false;
    let dupOf = null;
    let dupSim = 0;

    // Проверка 1: точное совпадение по guid за O(1).
    if (evGuid && guidIndex.has(evGuid)) {
      isDup = true;
      dupOf = guidIndex.get(evGuid);
      dupSim = 1;
    }

    // Проверка 2: similarity внутри группы того же source в пределах окна.
    if (!isDup) {
      const pool = evSource
        ? (bySource.get(evSource) || [])
        : noSource;

      for (let k = pool.length - 1; k >= 0; k--) {
        const s = pool[k];
        // Скользящее окно: pool отсортирован по времени.
        // Если элемент без даты — проверяем без окна (совместимость с v1).
        if (!isNaN(evT) && !isNaN(s.t)) {
          const dtH = Math.abs(evT - s.t) / (1000 * 60 * 60);
          if (dtH > windowH) break; // все следующие (более старые) тоже вне окна
        }
        const sim = similarity(evTitle, s.title);
        if (sim >= threshold) {
          isDup = true;
          dupOf = s;
          dupSim = sim;
          break;
        }
      }
    }

    if (isDup) {
      duplicates.push({
        item: ev,
        duplicateOf: dupOf.guid || dupOf.title,
        similarity: Math.round(dupSim * 100) / 100,
      });
    } else {
      const record = { guid: evGuid, title: evTitle, date: evDate, t: evT, original: ev };
      unique.push(ev);
      if (evGuid) guidIndex.set(evGuid, record);
      if (evSource) {
        if (!bySource.has(evSource)) bySource.set(evSource, []);
        bySource.get(evSource).push(record);
      } else {
        noSource.push(record);
      }
    }
  }

  return {
    unique,
    duplicates,
    stats: {
      input: events.length,
      unique: unique.length,
      duplicates: duplicates.length,
      dedupRate: events.length > 0 ? (duplicates.length / events.length) : 0,
      sourcesIndexed: bySource.size,
      guidIndexed: guidIndex.size,
    },
  };
}

export default { deduplicate };
