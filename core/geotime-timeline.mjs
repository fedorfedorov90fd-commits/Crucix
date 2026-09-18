// ═══════════════════════════════════════════════════════════════
//  CRUCIX GEOTIME TIMELINE v1.0.0
//  Единая временная шкала наблюдений.
//  Треки объектов, детекция остановок, срезы состояния, анимация.
//  Работает поверх EntityGraph. Без fetch().
// ═══════════════════════════════════════════════════════════════

import { EventEmitter } from 'node:events';

// ─── Утилиты геометрии ────────────────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) *
            Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function toMs(ts) {
  if (typeof ts === 'number') return ts;
  const t = Date.parse(ts);
  return Number.isFinite(t) ? t : null;
}

// ─── Главный класс ────────────────────────────────────────────
export class GeoTimeTimeline extends EventEmitter {
  /**
   * @param {EntityGraph} graph — источник наблюдений (через node.observations)
   * @param {Object} options
   * @param {number} options.stopThresholdMeters — порог остановки (по умолчанию 500 м)
   * @param {number} options.stopMinDurationMs   — минимальная длительность остановки (5 мин)
   * @param {number} options.defaultSpeedKmh     — скорость по умолчанию для интерполяции (60 км/ч)
   */
  constructor(graph, options = {}) {
    super();
    if (!graph) throw new Error('GeoTimeTimeline требует EntityGraph');
    this.graph = graph;
    this.stopThresholdMeters = Number.isFinite(options.stopThresholdMeters) ? options.stopThresholdMeters : 500;
    this.stopMinDurationMs = Number.isFinite(options.stopMinDurationMs) ? options.stopMinDurationMs : 300000;
    this.defaultSpeedKmh = Number.isFinite(options.defaultSpeedKmh) ? options.defaultSpeedKmh : 60;

    this._playTimer = null;
    this._playState = null;
  }

  // ── Трек одного узла ───────────────────────────────────────
  buildTrack(nodeId) {
    const node = this.graph.getNode(nodeId);
    if (!node) return null;

    const points = [];
    // Наблюдения с координатами
    for (const obs of (node.observations || [])) {
      const ms = toMs(obs.timestamp);
      if (!Number.isFinite(obs.lat) || !Number.isFinite(obs.lon) || ms === null) continue;
      points.push({
        timestamp: ms,
        iso: new Date(ms).toISOString(),
        lat: obs.lat,
        lon: obs.lon,
        source: obs.source || 'unknown',
        type: obs.type || 'observation',
      });
    }

    // Если у самого узла есть координаты — добавляем как точку "текущая позиция"
    if (Number.isFinite(node.lat) && Number.isFinite(node.lon)) {
      const ms = toMs(node.updatedAt) || Date.now();
      points.push({
        timestamp: ms,
        iso: new Date(ms).toISOString(),
        lat: node.lat,
        lon: node.lon,
        source: 'node.current',
        type: 'current',
      });
    }

    if (points.length === 0) return null;
    points.sort((a, b) => a.timestamp - b.timestamp);
    // Убираем дубликаты по timestamp+lat+lon
    const dedup = [];
    for (const p of points) {
      const last = dedup[dedup.length - 1];
      if (last && last.timestamp === p.timestamp && last.lat === p.lat && last.lon === p.lon) continue;
      dedup.push(p);
    }

    // Вычисляем расстояния и скорости между последовательными точками
    for (let i = 0; i < dedup.length; i++) {
      if (i === 0) {
        dedup[i].distanceFromPrev = 0;
        dedup[i].speedKmh = 0;
      } else {
        const prev = dedup[i - 1];
        const cur = dedup[i];
        const dist = haversineKm(prev.lat, prev.lon, cur.lat, cur.lon);
        const dtH = Math.max(0.0001, (cur.timestamp - prev.timestamp) / 3600000);
        dedup[i].distanceFromPrev = dist;
        dedup[i].speedKmh = dist / dtH;
      }
    }

    const startTime = dedup[0].timestamp;
    const endTime = dedup[dedup.length - 1].timestamp;
    const totalKm = dedup.reduce((s, p) => s + p.distanceFromPrev, 0);

    return {
      nodeId,
      label: node.label,
      type: node.type,
      country: node.country,
      points: dedup,
      startTime,
      endTime,
      durationMs: endTime - startTime,
      totalKm,
      avgSpeedKmh: this._avgSpeed(dedup),
      maxSpeedKmh: Math.max(...dedup.map(p => p.speedKmh || 0)),
      stops: this.detectStops(dedup),
    };
  }

  _avgSpeed(points) {
    if (points.length < 2) return 0;
    const totalKm = points.reduce((s, p) => s + p.distanceFromPrev, 0);
    const dtH = (points[points.length - 1].timestamp - points[0].timestamp) / 3600000;
    if (dtH <= 0) return 0;
    return totalKm / dtH;
  }

  // ── Детекция остановок ─────────────────────────────────────
  detectStops(points, opts = {}) {
    const thresholdM = Number.isFinite(opts.thresholdMeters) ? opts.thresholdMeters : this.stopThresholdMeters;
    const minDurMs = Number.isFinite(opts.minDurationMs) ? opts.minDurationMs : this.stopMinDurationMs;
    const thresholdKm = thresholdM / 1000;

    const stops = [];
    let i = 0;
    while (i < points.length) {
      let j = i + 1;
      let clusterStart = i;
      let clusterEnd = i;
      let clusterCenter = { lat: points[i].lat, lon: points[i].lon };

      while (j < points.length) {
        const d = haversineKm(clusterCenter.lat, clusterCenter.lon, points[j].lat, points[j].lon);
        if (d <= thresholdKm) {
          clusterEnd = j;
          j++;
        } else {
          break;
        }
      }

      const dur = points[clusterEnd].timestamp - points[clusterStart].timestamp;
      if (clusterEnd > clusterStart && dur >= minDurMs) {
        stops.push({
          startTime: points[clusterStart].timestamp,
          endTime: points[clusterEnd].timestamp,
          durationMs: dur,
          lat: clusterCenter.lat,
          lon: clusterCenter.lon,
          pointsCount: clusterEnd - clusterStart + 1,
          sources: [...new Set(points.slice(clusterStart, clusterEnd + 1).map(p => p.source))],
        });
      }
      i = clusterEnd > i ? clusterEnd + 1 : i + 1;
    }

    return stops;
  }

  // ── Срез состояния на момент времени ──────────────────────
  snapshotAt(timeInput) {
    const ts = toMs(timeInput);
    if (ts === null) return null;
    const result = {
      timestamp: ts,
      iso: new Date(ts).toISOString(),
      nodes: [],
    };
    for (const node of this.graph.nodes.values()) {
      const track = this.buildTrack(node.id);
      if (!track || track.points.length === 0) continue;
      if (ts < track.startTime) continue;

      // Ищем точку, ближайшую к ts слева
      let best = null;
      for (const p of track.points) {
        if (p.timestamp <= ts) best = p;
        else break;
      }
      if (best) {
        result.nodes.push({
          nodeId: node.id,
          label: node.label,
          type: node.type,
          lat: best.lat,
          lon: best.lon,
          atTime: best.timestamp,
          ageMs: ts - best.timestamp,
        });
      }
    }
    return result;
  }

  // ── Диапазон времени по всем наблюдениям ──────────────────
  getTimeRange() {
    let minT = Infinity, maxT = -Infinity;
    for (const node of this.graph.nodes.values()) {
      for (const obs of (node.observations || [])) {
        const ms = toMs(obs.timestamp);
        if (ms === null) continue;
        if (ms < minT) minT = ms;
        if (ms > maxT) maxT = ms;
      }
      const ms = toMs(node.updatedAt);
      if (ms !== null) {
        if (ms < minT) minT = ms;
        if (ms > maxT) maxT = ms;
      }
    }
    if (!Number.isFinite(minT)) return { start: null, end: null, durationMs: 0 };
    return {
      start: minT,
      startIso: new Date(minT).toISOString(),
      end: maxT,
      endIso: new Date(maxT).toISOString(),
      durationMs: maxT - minT,
    };
  }

  // ── Анимация (play/pause/seek/setSpeed) ───────────────────
  // Возвращает handle. Движение симулируется: при каждом шаге испускает
  // событие 'tick' с текущим snapshotAt(currentTime). Клиент рисует.
  play({ fromMs = null, toMs = null, stepMs = 1000, realStepMs = 1000 } = {}) {
    this.stop();

    const range = this.getTimeRange();
    if (!range.start) return null;

    const startT = fromMs ?? range.start;
    const endT = toMs(toMs) === null ? (toMs ?? range.end) : range.end;
    const duration = endT - startT;

    this._playState = {
      currentTime: startT,
      startT,
      endT,
      stepMs,
      realStepMs,
      playing: true,
    };

    this._playTimer = setInterval(() => {
      if (!this._playState || !this._playState.playing) return;
      this._playState.currentTime += this._playState.stepMs;
      if (this._playState.currentTime >= endT) {
        this._playState.currentTime = endT;
        this._playState.playing = false;
        this.emit('tick', this.snapshotAt(endT));
        this.emit('end', { at: endT });
        this.stop();
        return;
      }
      this.emit('tick', this.snapshotAt(this._playState.currentTime));
    }, realStepMs);

    if (typeof this._playTimer.unref === 'function') this._playTimer.unref();

    this.emit('play', { from: startT, to: endT, stepMs });
    return {
      pause: () => this.pause(),
      seekTo: (t) => this.seekTo(t),
      setSpeed: (mult) => this.setSpeed(mult),
    };
  }

  pause() {
    if (this._playState) this._playState.playing = false;
    this.emit('pause', { at: this._playState?.currentTime ?? null });
  }

  resume() {
    if (this._playState) {
      this._playState.playing = true;
      this.emit('resume', { at: this._playState.currentTime });
    }
  }

  seekTo(timeInput) {
    const ts = toMs(timeInput);
    if (ts === null || !this._playState) return null;
    this._playState.currentTime = ts;
    const snap = this.snapshotAt(ts);
    this.emit('seek', { at: ts });
    this.emit('tick', snap);
    return snap;
  }

  setSpeed(multiplier) {
    if (!this._playState) return null;
    const m = Math.max(0.1, Math.min(100, Number(multiplier) || 1));
    this._playState.realStepMs = Math.max(16, Math.round(1000 / m));
    this.emit('speed', { multiplier: m, realStepMs: this._playState.realStepMs });
    return this._playState.realStepMs;
  }

  stop() {
    if (this._playTimer) {
      clearInterval(this._playTimer);
      this._playTimer = null;
    }
    if (this._playState) {
      this._playState.playing = false;
    }
    this.emit('stop');
  }

  getPlayState() {
    return this._playState ? { ...this._playState } : null;
  }

  // ── Экспорт для LLM ────────────────────────────────────────
  toAIContext(nodeId) {
    if (nodeId) {
      const track = this.buildTrack(nodeId);
      if (!track) return null;
      return {
        nodeId: track.nodeId,
        label: track.label,
        type: track.type,
        points: track.points.length,
        start: track.startTime ? new Date(track.startTime).toISOString() : null,
        end: track.endTime ? new Date(track.endTime).toISOString() : null,
        durationHours: (track.durationMs / 3600000).toFixed(2),
        totalKm: Number(track.totalKm.toFixed(2)),
        avgSpeedKmh: Number(track.avgSpeedKmh.toFixed(1)),
        maxSpeedKmh: Number(track.maxSpeedKmh.toFixed(1)),
        stops: track.stops.map(s => ({
          from: new Date(s.startTime).toISOString(),
          to: new Date(s.endTime).toISOString(),
          durationMin: Math.round(s.durationMs / 60000),
          lat: Number(s.lat.toFixed(4)),
          lon: Number(s.lon.toFixed(4)),
        })),
      };
    }
    // Общий обзор
    const range = this.getTimeRange();
    let tracks = 0, points = 0, stops = 0;
    for (const node of this.graph.nodes.values()) {
      const t = this.buildTrack(node.id);
      if (t) {
        tracks++;
        points += t.points.length;
        stops += t.stops.length;
      }
    }
    return {
      range: range.start ? {
        start: range.startIso,
        end: range.endIso,
        durationHours: (range.durationMs / 3600000).toFixed(2),
      } : null,
      tracks,
      points,
      stops,
    };
  }

  // ── Экспорт трека в GeoJSON LineString ─────────────────────
  toGeoJSON(nodeId) {
    const track = this.buildTrack(nodeId);
    if (!track) return null;
    return {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: track.points.map(p => [p.lon, p.lat]),
      },
      properties: {
        nodeId: track.nodeId,
        label: track.label,
        type: track.type,
        points: track.points.length,
        totalKm: Number(track.totalKm.toFixed(3)),
        start: track.startTime ? new Date(track.startTime).toISOString() : null,
        end: track.endTime ? new Date(track.endTime).toISOString() : null,
        stopsCount: track.stops.length,
      },
    };
  }

  // ── Статистика ────────────────────────────────────────────
  getStats() {
    const range = this.getTimeRange();
    let tracks = 0, points = 0, stops = 0, totalKm = 0;
    for (const node of this.graph.nodes.values()) {
      const t = this.buildTrack(node.id);
      if (t) {
        tracks++;
        points += t.points.length;
        stops += t.stops.length;
        totalKm += t.totalKm;
      }
    }
    return {
      nodes: this.graph.nodes.size,
      tracksWithPoints: tracks,
      points,
      stops,
      totalKm: Number(totalKm.toFixed(2)),
      range: range.start ? {
        start: range.startIso,
        end: range.endIso,
        durationHours: Number((range.durationMs / 3600000).toFixed(2)),
      } : null,
      stopThresholdMeters: this.stopThresholdMeters,
      stopMinDurationMs: this.stopMinDurationMs,
    };
  }
}

// ─── Фабрика ───────────────────────────────────────────────────
let _instance = null;

export function getGeoTimeTimeline(graph, options) {
  if (!_instance) {
    if (!graph) throw new Error('Первый вызов getGeoTimeTimeline требует EntityGraph');
    _instance = new GeoTimeTimeline(graph, options);
  }
  return _instance;
}

export function resetGeoTimeTimeline() {
  if (_instance) _instance.stop();
  _instance = null;
}
