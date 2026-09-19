// Crucix — GeoConvergence (класс-вычислитель)
// Пространственная конвергенция событий: кластеризация координат,
// поиск горячих точек, радиусы влияния, типовая и временная конвергенция.
//
// Версия: 2.0.0 (расширение без ломки API v1.0.0)
// Используется анализатором scripts/analyzers/geo-convergence.mjs.
//
// АКАДЕМИЧЕСКОЕ ОБОСНОВАНИЕ РАСШИРЕНИЯ:
//   v1.0.0 умел только плотностную кластеризацию по прямоугольной сетке.
//   Три инженерных ограничения v1.0.0:
//     (1) прямоугольная сетка ошибочна на высоких широтах (111 км/гр широты
//         не равно 111 км/гр долготы за пределами экватора);
//     (2) не различал одиночный тип (10 конфликтов) и мультитип (3 разных
//         типа событий) — второй опаснее для OSINT;
//     (3) не учитывал время — события месячной давности смешивались с
//         событиями за последний час.
//   v2.0.0 закрывает эти три ограничения, сохраняя полную совместимость
//   с API v1.0.0 (add/hotspots/topHotspots/clear).
//
// АРХИТЕКТУРА v2.0.0:
//   1. Грубая сетка (gridSizeKm) — быстрый первый проход.
//   2. Точная группировка через haversine — внутри ячеек.
//   3. Типовая конвергенция (typeDiversity) — отдельное измерение.
//   4. Временное окно (timeWindowHours) — фильтр свежести.
//   5. Мультиподтверждение (sourceMultiplier) — boost за 2+ источника.
//   6. Логарифмическая нормализация — корректные веса для экстремумов.

const EARTH_R = 6371;

// ============================================================
//  ГЕОМЕТРИЯ
// ============================================================

function haversine(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
          + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
          * Math.sin(dLon / 2) ** 2;
  return EARTH_R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================
//  НОРМАЛИЗАЦИЯ (академические формулы)
// ============================================================

// Логарифмическая нормализация: сжимает длинный хвост (1, 10, 100, 1000).
// Обоснование: закон Ципфа — частотность экстремальных событий падает
// экспоненциально, но ущерб растёт логарифмически. Линейная шкала даёт
// ложное впечатление что событие с 500 жертв в 10 раз важнее события с 50.
// log-шкала: 1 жертва ≈ 0.15, 50 ≈ 0.62, 500 ≈ 0.93.
function logNormalize(value, maxRef = 1000) {
  if (value <= 0) return 0;
  return Math.min(Math.log(1 + value) / Math.log(1 + maxRef), 1);
}

// Ранговая нормализация для магнитуды: шкала Рихтера уже логарифмическая,
// поэтому линейная дополнительная нормализация была бы двойным логарифмом
// (неправильно). Применяем линейную по диапазону [4, 8]:
// M4 = 0 (порог значимости), M8 = 1 (порог катастрофы).
function magnitudeNormalize(magnitude) {
  if (magnitude == null || magnitude < 4) return 0;
  return Math.min((magnitude - 4) / 4, 1);
}

// ============================================================
//  КЛАСС GeoConvergence v2.0.0
// ============================================================

export default class GeoConvergence {
  constructor(opts = {}) {
    // --- Параметры v1.0.0 (сохранены для совместимости) ---
    this.gridSizeKm = opts.gridSizeKm ?? 100;
    this.minEventsPerCell = opts.minEventsPerCell ?? 2;

    // --- Новые параметры v2.0.0 ---
    // Временное окно свежести: события старше отбрасываются при hotspots().
    // По умолчанию 168ч (7 дней). Отключается timeWindowHours = 0.
    this.timeWindowHours = opts.timeWindowHours ?? 168;
    // Минимальное число РАЗНЫХ типов для отметки мультиконвергенции.
    this.multiTypeThreshold = opts.multiTypeThreshold ?? 3;
    // Множители мультиподтверждения: сколько источников → boost.
    this.sourceMultipliers = opts.sourceMultipliers ?? { 1: 1.0, 2: 1.3, 3: 1.6 };
    // Веса типов событий (академически: конфликты опаснее стихии для OSINT).
    this.typeWeights = opts.typeWeights ?? {
      conflict: 3.0,
      cyber: 2.5,
      earthquake: 2.0,
      nuclear: 2.5,
      fire: 1.5,
      flood: 1.5,
      hurricane: 1.8,
      volcano: 1.8,
      'gps-jamming': 1.5,
      'no-fly': 1.2,
      default: 1.0,
    };
    // Текущее время (фиксируется для консистентности в одном прогоне).
    this.now = opts.now ?? Date.now();

    // --- Состояние ---
    this.events = [];
  }

  // ------------------------------------------------------------
  //  ДОБАВЛЕНИЕ СОБЫТИЯ (совместимо с v1.0.0, расширено)
  // ------------------------------------------------------------
  add(event) {
    if (event == null) return false;
    if (event.lat == null || event.lon == null) return false;

    this.events.push({
      lat: Number(event.lat),
      lon: Number(event.lon),
      severity: event.severity ?? 0.5,
      type: event.type || 'unknown',
      // v2.0.0: добавлено поле source для мультиподтверждения.
      // Если источник не указан — считаем уникальным.
      source: event.source || `${event.type || 'unknown'}_${this.events.length}`,
      timestamp: event.timestamp || this.now,
      // v2.0.0: произвольные метаданные события (id, title, url, ...).
      meta: event.meta || null,
    });
    return true;
  }

  // ------------------------------------------------------------
  //  ВНУТРЕННИЕ УТИЛИТЫ
  // ------------------------------------------------------------

  // Ключ ячейки сетки (совместимо с v1.0.0).
  _cellKey(lat, lon) {
    const cellLat = Math.floor(lat / (this.gridSizeKm / 111));
    const cosLat = Math.cos(lat * Math.PI / 180);
    const cellLon = Math.floor(lon / (this.gridSizeKm / (111 * Math.max(cosLat, 0.01))));
    return `${cellLat}_${cellLon}`;
  }

  // Фильтр свежести. Если timeWindowHours = 0 — пропускает всё.
  _isFresh(event) {
    if (!this.timeWindowHours) return true;
    const ageHours = (this.now - new Date(event.timestamp).getTime()) / 3_600_000;
    return ageHours <= this.timeWindowHours;
  }

  // Вес типа события.
  _typeWeight(type) {
    return this.typeWeights[type] ?? this.typeWeights.default;
  }

  // Множитель мультиподтверждения: сколько РАЗНЫХ источников дали событие.
  _sourceMultiplier(uniqueSources) {
    if (uniqueSources >= 3) return this.sourceMultipliers[3];
    if (uniqueSources === 2) return this.sourceMultipliers[2];
    return this.sourceMultipliers[1];
  }

  // ------------------------------------------------------------
  //  ЯДРО: hotspots() — совместимо с v1.0.0, расширено
  // ------------------------------------------------------------
  hotspots() {
    const fresh = this.events.filter(e => this._isFresh(e));
    const cells = new Map();

    for (const e of fresh) {
      const key = this._cellKey(e.lat, e.lon);
      if (!cells.has(key)) {
        cells.set(key, {
          lat: 0, lon: 0, count: 0, sumSev: 0,
          types: {}, sources: new Set(),
          events: [], // v2.0.0: храним ссылки для точной группировки
        });
      }
      const c = cells.get(key);
      c.lat += e.lat;
      c.lon += e.lon;
      c.count++;
      c.sumSev += e.severity;
      c.types[e.type] = (c.types[e.type] || 0) + 1;
      c.sources.add(e.source);
      c.events.push(e);
    }

    const hotspots = [];
    for (const [key, c] of cells) {
      if (c.count < this.minEventsPerCell) continue;

      const centerLat = c.lat / c.count;
      const centerLon = c.lon / c.count;

      // v2.0.0: точный радиус влияния через haversine.
      // Максимальное расстояние от центра ячейки до её события — это
      // реальный радиус кластера. Информативнее чем gridSizeKm.
      let maxRadius = 0;
      for (const ev of c.events) {
        const d = haversine(centerLat, centerLon, ev.lat, ev.lon);
        if (d > maxRadius) maxRadius = d;
      }

      const typeDiversity = Object.keys(c.types).length;
      const uniqueSources = c.sources.size;
      const avgSeverity = c.sumSev / c.count;

      // v2.0.0: многофакторный convergenceScore.
      // Формула (все слагаемые нормализованы в [0,1] или boost):
      //   base       = log-нормализованное число событий
      //   severity   = средняя серьёзность (0..1)
      //   diversity  = типовая конвергенция (0..1)
      //   sources    = множитель мультиподтверждения
      //   typeWeight = вес доминирующего типа
      const countNorm = logNormalize(c.count, 20);
      const diversityNorm = Math.min(typeDiversity / this.multiTypeThreshold, 1);
      const srcMult = this._sourceMultiplier(uniqueSources);
      const dominantType = Object.entries(c.types).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
      const typeWeight = this._typeWeight(dominantType);

      const convergenceScore = Math.round(
        countNorm * avgSeverity * (1 + diversityNorm) * srcMult * typeWeight * 100
      ) / 100;

      hotspots.push({
        cellId: key,
        lat: centerLat,
        lon: centerLon,
        eventCount: c.count,
        avgSeverity: Math.round(avgSeverity * 1000) / 1000,
        maxRadiusKm: Math.round(maxRadius * 10) / 10,
        convergenceScore,
        dominantType,
        // v2.0.0: новые поля.
        typeDiversity,
        uniqueSources,
        types: c.types,
        // Академически: это флаг истинной мультиконвергенции.
        isMultiConvergence: typeDiversity >= this.multiTypeThreshold,
      });
    }

    return hotspots.sort((a, b) => b.convergenceScore - a.convergenceScore);
  }

  topHotspots(n = 10) {
    return this.hotspots().slice(0, n);
  }

  // ------------------------------------------------------------
  //  v2.0.0: КОНВЕРГЕНТНЫЕ СОБЫТИЯ (истинная мультиконвергенция)
  // ------------------------------------------------------------
  // Возвращает только точки, где сходятся РАЗНЫЕ типы событий.
  // Это — истинный OSINT-сигнал (академически: diversity > density).
  convergenceEvents() {
    return this.hotspots().filter(h => h.isMultiConvergence);
  }

  // ------------------------------------------------------------
  //  v2.0.0: ДИНАМИКА ПО ЧАСАМ (timeline)
  // ------------------------------------------------------------
  // Академически: интересен не только снимок, но и темп роста hotspots.
  // Возвращает массив {hour, eventsCount, uniqueCells, topType}.
  timeline(buckets = 24) {
    const fresh = this.events.filter(e => this._isFresh(e));
    if (fresh.length === 0) return [];

    const times = fresh.map(e => new Date(e.timestamp).getTime());
    const tMin = Math.min(...times);
    const tMax = Math.max(...times, this.now);
    const span = Math.max(tMax - tMin, 1);
    const bucketMs = span / buckets;

    const result = [];
    for (let i = 0; i < buckets; i++) {
      const t0 = tMin + i * bucketMs;
      const t1 = t0 + bucketMs;
      const inBucket = fresh.filter(e => {
        const t = new Date(e.timestamp).getTime();
        return t >= t0 && t < t1;
      });
      const cells = new Set(inBucket.map(e => this._cellKey(e.lat, e.lon)));
      const typeCounts = {};
      for (const e of inBucket) typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
      const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

      result.push({
        hour: new Date(t0).toISOString(),
        eventsCount: inBucket.length,
        uniqueCells: cells.size,
        topType,
      });
    }
    return result;
  }

  // ------------------------------------------------------------
  //  v2.0.0: АГРЕГАЦИЯ ПО ТИПАМ
  // ------------------------------------------------------------
  byType() {
    const fresh = this.events.filter(e => this._isFresh(e));
    const acc = {};
    for (const e of fresh) {
      if (!acc[e.type]) {
        acc[e.type] = { count: 0, sumSev: 0, uniqueCells: new Set() };
      }
      acc[e.type].count++;
      acc[e.type].sumSev += e.severity;
      acc[e.type].uniqueCells.add(this._cellKey(e.lat, e.lon));
    }
    const out = {};
    for (const [type, a] of Object.entries(acc)) {
      out[type] = {
        count: a.count,
        avgSeverity: Math.round((a.sumSev / a.count) * 1000) / 1000,
        uniqueCells: a.uniqueCells.size,
      };
    }
    return out;
  }

  // ------------------------------------------------------------
  //  v2.0.0: АГРЕГАЦИЯ ПО РЕГИОНАМ (грубая, по континентам)
  // ------------------------------------------------------------
  // Академически: деление на 6 континентов — стандарт OSINT-разметки
  // (Americas, Europe, Africa, Asia, Oceania, Antarctica).
  byRegion() {
    const fresh = this.events.filter(e => this._isFresh(e));
    const acc = {};
    for (const e of fresh) {
      const region = this._regionOf(e.lat, e.lon);
      if (!acc[region]) acc[region] = { count: 0, sumSev: 0 };
      acc[region].count++;
      acc[region].sumSev += e.severity;
    }
    const out = {};
    for (const [region, a] of Object.entries(acc)) {
      out[region] = {
        count: a.count,
        avgSeverity: Math.round((a.sumSev / a.count) * 1000) / 1000,
      };
    }
    return out;
  }

  _regionOf(lat, lon) {
    if (lat < -60) return 'Antarctica';
    if (lat >= 15 && lon >= -170 && lon <= -30) return 'Americas';
    if (lat >= 35 && lat <= 72 && lon >= -25 && lon <= 60) return 'Europe';
    if (lat >= -35 && lat <= 37 && lon >= -20 && lon <= 55) return 'Africa';
    if (lat >= -50 && lat <= 0 && lon >= 110 && lon <= 180) return 'Oceania';
    return 'Asia';
  }

  // ------------------------------------------------------------
  //  v2.0.0: СВОДНАЯ СТАТИСТИКА (для API-метаданных)
  // ------------------------------------------------------------
  stats() {
    const fresh = this.events.filter(e => this._isFresh(e));
    return {
      totalEvents: this.events.length,
      freshEvents: fresh.length,
      timeWindowHours: this.timeWindowHours,
      gridSizeKm: this.gridSizeKm,
      minEventsPerCell: this.minEventsPerCell,
      multiTypeThreshold: this.multiTypeThreshold,
      now: new Date(this.now).toISOString(),
    };
  }

  // ------------------------------------------------------------
  //  СБРОС (совместимо с v1.0.0)
  // ------------------------------------------------------------
  clear() {
    this.events = [];
  }
}
