#!/usr/bin/env node

// ============================================================
// ПОДКЛЮЧЕНИЕ ПАНЕЛЕЙ
// ============================================================

// Панель геополитики
import geopoliticalPanel from './panels/geopolitical-reports/index.mjs';

// Панель управления RSS
import rssManagerPanel from './panels/rss-manager/index.mjs';

// ============================================================
// РЕГИСТРАЦИЯ ПАНЕЛЕЙ
// ============================================================

export const panels = [];

// Регистрация панели геополитики
panels.push({
  id: geopoliticalPanel.id || 'geopolitical',
  name: geopoliticalPanel.name || 'Геополитика + AI',
  icon: geopoliticalPanel.icon || '🌍',
  category: geopoliticalPanel.category || 'Аналитика',
  priority: geopoliticalPanel.priority || 10,
  render: geopoliticalPanel.render || (() => '<div>Панель не загружена</div>'),
  onLoad: geopoliticalPanel.onLoad || (() => {}),
  onUnload: geopoliticalPanel.onUnload || (() => {})
});

// Регистрация панели управления RSS
panels.push({
  id: rssManagerPanel.id || 'rss-manager',
  name: rssManagerPanel.name || 'Управление RSS',
  icon: rssManagerPanel.icon || '📡',
  category: rssManagerPanel.category || 'Управление',
  priority: rssManagerPanel.priority || 10,
  render: rssManagerPanel.render || (() => '<div>Панель не загружена</div>'),
  onLoad: rssManagerPanel.onLoad || (() => {}),
  onUnload: rssManagerPanel.onUnload || (() => {})
});

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

// Получить панель по ID
export function getPanel(id) {
  return panels.find(p => p.id === id);
}

// Получить панели по категории
export function getPanelsByCategory(category) {
  return panels.filter(p => p.category === category);
}

// Получить все панели (сортировка по приоритету)
export function getAllPanels() {
  return panels.sort((a, b) => (a.priority || 0) - (b.priority || 0));
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  panels,
  getPanel,
  getPanelsByCategory,
  getAllPanels
};
