#!/usr/bin/env node

// ============================================================
// INJECT.MJS — Регистрация всех панелей интерфейса Crucix
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PANELS_DIR = join(__dirname, 'panels');

export const panels = [];

// ============================================================
// 1. ИМПОРТ ПАНЕЛЕЙ
// ============================================================

// Панель "Геополитика + AI"
import geopoliticalPanel from './panels/geopolitical-reports/index.mjs';
panels.push(geopoliticalPanel);

// Панель управления RSS
import rssManagerPanel from './panels/rss-manager/index.mjs';
panels.push(rssManagerPanel);

// Панель планировщика задач (Модуль №24)
import schedulerPanel from './panels/scheduler/index.mjs';
panels.push(schedulerPanel);

// Панель доверия к источникам (Модуль №25)
import trustPanel from './panels/trust/index.mjs';
panels.push(trustPanel);

// ============================================================
// 2. ФУНКЦИИ ДЛЯ РАБОТЫ С ПАНЕЛЯМИ
// ============================================================

export function getPanels() {
  return panels;
}

export function getPanel(id) {
  return panels.find(p => p.id === id);
}

export function getPanelsByCategory(category) {
  return panels.filter(p => p.category === category);
}

export function getCategories() {
  const cats = new Set();
  for (const panel of panels) {
    if (panel.category) cats.add(panel.category);
  }
  return Array.from(cats);
}

// ============================================================
// 3. РЕНДЕРИНГ ВСЕХ ПАНЕЛЕЙ
// ============================================================

export async function renderAllPanels() {
  let html = '';

  const sorted = [...panels].sort((a, b) => (a.priority || 999) - (b.priority || 999));

  for (const panel of sorted) {
    try {
      if (typeof panel.render === 'function') {
        const content = await panel.render();
        html += `
          <div class="panel-wrapper" data-panel-id="${panel.id}" data-category="${panel.category || 'Общее'}">
            <div class="panel-header" data-panel-id="${panel.id}">
              <span class="panel-icon">${panel.icon || '📄'}</span>
              <span class="panel-name">${panel.name || panel.id}</span>
              <span class="panel-toggle">▼</span>
            </div>
            <div class="panel-body" data-panel-id="${panel.id}">
              ${content}
            </div>
          </div>
        `;
      }
    } catch (e) {
      console.error(`[Inject] Ошибка рендеринга панели ${panel.id}:`, e);
      html += `
        <div class="panel-wrapper" data-panel-id="${panel.id}">
          <div class="panel-header" data-panel-id="${panel.id}">
            <span class="panel-icon">❌</span>
            <span class="panel-name">${panel.name || panel.id}</span>
          </div>
          <div class="panel-body" style="color:#f44336;padding:16px;">
            Ошибка загрузки панели: ${e.message}
          </div>
        </div>
      `;
    }
  }

  return html;
}

// ============================================================
// 4. ЗАГРУЗКА ПАНЕЛЕЙ (onLoad)
// ============================================================

export async function loadAllPanels() {
  for (const panel of panels) {
    try {
      if (typeof panel.onLoad === 'function') {
        await panel.onLoad();
      }
    } catch (e) {
      console.error(`[Inject] Ошибка загрузки панели ${panel.id}:`, e);
    }
  }
}

// ============================================================
// 5. ДИНАМИЧЕСКАЯ ЗАГРУЗКА ПАНЕЛЕЙ
// ============================================================

export async function autoDiscoverPanels() {
  try {
    const entries = await fs.readdir(PANELS_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const panelPath = join(PANELS_DIR, entry.name, 'index.mjs');
        try {
          await fs.access(panelPath);
          const module = await import(`file://${panelPath}`);
          if (module.panel || module.default) {
            const panel = module.panel || module.default;
            if (panel.id && !panels.find(p => p.id === panel.id)) {
              panels.push(panel);
              console.log(`[Inject] Автообнаружена панель: ${panel.id}`);
            }
          }
        } catch (e) {
          // Папка без index.mjs — пропускаем
        }
      }
    }
  } catch (e) {
    console.error('[Inject] Ошибка автообнаружения панелей:', e);
  }
}

// ============================================================
// 6. ЭКСПОРТ
// ============================================================

export default {
  panels,
  getPanels,
  getPanel,
  getPanelsByCategory,
  getCategories,
  renderAllPanels,
  loadAllPanels,
  autoDiscoverPanels
};
