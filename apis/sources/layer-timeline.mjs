/**
 * layer-timeline.mjs — Временная шкала для слоёв карты
 *
 * Показывает изменения данных по времени, анимация изменений
 */

import { getLayerData } from './layer-manager.mjs';

/**
 * Получение временной шкалы с агрегацией
 */
export function getTimeline(layerId, interval = 'day') {
  const result = getLayerData(layerId);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  const items = result.data || [];
  const timeline = [];

  for (const item of items) {
    const date = new Date(item.date || item.timestamp || item.time);
    if (isNaN(date.getTime())) continue;

    let key;
    switch (interval) {
      case 'hour': key = date.toISOString().slice(0, 13); break;
      case 'day': key = date.toISOString().slice(0, 10); break;
      case 'week':
        const week = Math.floor((date - new Date(date.getFullYear(), 0, 1)) / 604800000);
        key = `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
        break;
      case 'month': key = date.toISOString().slice(0, 7); break;
      case 'year': key = date.toISOString().slice(0, 4); break;
      default: key = date.toISOString().slice(0, 10);
    }

    const existing = timeline.find(t => t.period === key);
    if (existing) {
      existing.count++;
    } else {
      timeline.push({ period: key, count: 1 });
    }
  }

  timeline.sort((a, b) => a.period.localeCompare(b.period));
  return { success: true, layerId, interval, timeline };
}

/**
 * Получение анимационных кадров для слоя
 */
export function getTimelineFrames(layerId, steps = 10) {
  const timeline = getTimeline(layerId);
  if (!timeline.success) return timeline;

  const data = timeline.timeline;
  if (data.length === 0) {
    return { success: false, error: 'Нет данных для анимации' };
  }

  // Разбиваем на кадры
  const chunkSize = Math.max(1, Math.ceil(data.length / steps));
  const frames = [];

  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    frames.push({
      frame: frames.length,
      periods: chunk.map(c => c.period),
      count: chunk.reduce((sum, c) => sum + c.count, 0),
      from: chunk[0]?.period || '',
      to: chunk[chunk.length - 1]?.period || ''
    });
  }

  return { success: true, layerId, frames, totalFrames: frames.length };
}

// ============================================================
// API-ЭНДПОИНТЫ
// ============================================================

export const endpoints = [
  { path: '/api/timeline/:layerId', method: 'GET', handler: getTimeline },
  { path: '/api/timeline/frames/:layerId', method: 'GET', handler: getTimelineFrames }
];

export default {
  getTimeline,
  getTimelineFrames,
  endpoints
};
