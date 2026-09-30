/**
 * layer-popup.mjs — Всплывающие окна для слоёв карты
 *
 * Генерация HTML-содержимого для popup-окон при клике на карте
 */

import { getLayerData } from './layer-manager.mjs';

/**
 * Генерация popup для точки на карте
 */
export function generatePopup(layerId, item) {
  if (!item) {
    return {
      title: 'Нет данных',
      content: '<p>Информация отсутствует</p>'
    };
  }

  const title = item.title || item.name || item.id || 'Точка';
  const description = item.description || item.summary || '';
  const date = item.date || item.timestamp || item.time || 'Дата неизвестна';
  const location = item.location || item.region || item.country || '';

  // Определяем тип
  const type = item.type || item.category || 'unknown';
  const typeLabels = {
    conflict: '⚔️ Конфликт',
    attack: '💥 Атака',
    protest: '✊ Протест',
    diplomatic: '🤝 Дипломатия',
    military: '🎖️ Военный',
    economic: '💰 Экономика',
    natural: '🌪️ Природное',
    cyber: '💻 Кибер',
    unknown: '📌 Объект'
  };

  // Генерация HTML
  const content = `
    <div class="popup-container">
      <h3>${title}</h3>
      <div class="popup-meta">
        <span class="popup-type">${typeLabels[type] || type}</span>
        <span class="popup-date">${new Date(date).toLocaleDateString('ru-RU')}</span>
      </div>
      ${description ? `<p class="popup-desc">${description}</p>` : ''}
      ${location ? `<p class="popup-location">📍 ${location}</p>` : ''}
      <div class="popup-actions">
        <button onclick="window.open('/layer/${layerId}')">📊 Подробнее</button>
        <button onclick="window.open('/geo-map?layer=${layerId}')">🗺️ Показать на карте</button>
      </div>
    </div>
    <style>
      .popup-container { font-family: Arial, sans-serif; max-width: 300px; padding: 8px; }
      .popup-container h3 { margin: 0 0 8px 0; font-size: 16px; color: #4d6bfe; }
      .popup-meta { display: flex; gap: 10px; font-size: 12px; color: #8892b0; margin-bottom: 8px; }
      .popup-type { background: #2d2d5e; padding: 2px 8px; border-radius: 12px; }
      .popup-desc { font-size: 14px; color: #e0e0e0; margin: 8px 0; }
      .popup-location { font-size: 13px; color: #8892b0; }
      .popup-actions { display: flex; gap: 8px; margin-top: 12px; }
      .popup-actions button {
        background: #4d6bfe; color: white; border: none;
        padding: 4px 12px; border-radius: 4px; cursor: pointer;
        font-size: 12px; transition: opacity 0.2s;
      }
      .popup-actions button:hover { opacity: 0.8; }
    </style>
  `;

  return { title, content };
}

/**
 * Генерация popup для нескольких точек (кластер)
 */
export function generateClusterPopup(layerId, items) {
  if (!items || items.length === 0) {
    return generatePopup(layerId, null);
  }

  const count = items.length;
  const types = {};
  const titles = [];

  for (const item of items) {
    const type = item.type || 'unknown';
    types[type] = (types[type] || 0) + 1;
    titles.push(item.title || item.name || '');
  }

  const typeSummary = Object.entries(types)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');

  const content = `
    <div class="popup-container">
      <h3>📊 Кластер (${count} объектов)</h3>
      <div class="popup-meta">
        <span>Типы: ${typeSummary}</span>
      </div>
      <ul style="margin: 8px 0; padding-left: 20px; font-size: 13px; color: #e0e0e0;">
        ${titles.slice(0, 5).map(t => `<li>${t || 'Без названия'}</li>`).join('')}
        ${titles.length > 5 ? `<li>... и ещё ${titles.length - 5}</li>` : ''}
      </ul>
      <div class="popup-actions">
        <button onclick="window.open('/geo-map?cluster=${layerId}')">🗺️ Показать все</button>
      </div>
    </div>
  `;

  return { title: `Кластер (${count})`, content };
}

/**
 * Получение данных для popup по координатам
 */
export function getPopupData(layerId, lat, lng, radius = 0.1) {
  const result = getLayerData(layerId);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  const items = result.data || [];
  const nearby = items.filter(item => {
    const itemLat = parseFloat(item.lat || item.latitude || 0);
    const itemLng = parseFloat(item.lng || item.longitude || 0);
    if (isNaN(itemLat) || isNaN(itemLng)) return false;
    return Math.abs(itemLat - lat) < radius && Math.abs(itemLng - lng) < radius;
  });

  if (nearby.length === 0) {
    return { success: false, error: 'Ничего не найдено рядом' };
  }

  if (nearby.length === 1) {
    return { success: true, popup: generatePopup(layerId, nearby[0]) };
  }

  return { success: true, popup: generateClusterPopup(layerId, nearby) };
}

// ============================================================
// API-ЭНДПОИНТЫ
// ============================================================

export const endpoints = [
  { path: '/api/popup/generate', method: 'POST', handler: generatePopup },
  { path: '/api/popup/cluster', method: 'POST', handler: generateClusterPopup },
  { path: '/api/popup/nearby', method: 'GET', handler: getPopupData }
];

export default {
  generatePopup,
  generateClusterPopup,
  getPopupData,
  endpoints
};
