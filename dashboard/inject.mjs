#!/usr/bin/env node
// Crucix Dashboard Data Synthesizer

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import config from '../crucix.config.mjs';
import { createLLMProvider } from '../lib/llm/index.mjs';
import { generateLLMIdeas } from '../lib/llm/ideas.mjs';

// === ИМПОРТ ТВОЕЙ ПАНЕЛИ ===
import geopoliticalReports from '../apis/sources/geopolitical-reports.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// === Панели ===
export const PANELS = {
  'news': {
    id: 'news',
    label: '📰 Новости',
    defaultActive: true
  },
  'map': {
    id: 'map',
    label: '🗺️ Карта',
    defaultActive: true
  },
  'sources': {
    id: 'sources',
    label: '📡 Источники',
    defaultActive: true
  },
  'geopolitical-reports': {
    id: 'geopolitical-reports',
    label: '🌍 Геополитика + AI',
    component: geopoliticalReports,
    defaultActive: true
  }
};

export async function generateIdeas(data, llmProvider) {
  if (!llmProvider || !data || !data.news || data.news.length === 0) {
    return [];
  }
  try {
    return await generateLLMIdeas(data.news, llmProvider) || [];
  } catch (error) {
    console.warn('[Inject] Ошибка генерации идей:', error.message);
    return [];
  }
}

export async function fetchAllNews() {
  return [];
}

export async function synthesize(data) {
  console.log('[Inject] Синтез данных для дашборда...');
  
  // БЕЗОПАСНАЯ ПРОВЕРКА: если data нет или невалидна, создаём пустую структуру
  if (!data || typeof data !== 'object') {
    console.warn('[Inject] Нет данных для синтеза, создаём пустую структуру');
    return {
      news: [],
      ideas: [],
      sources: {},
      sourcesOk: 0,
      sourcesFailed: 0,
      timestamp: new Date().toISOString()
    };
  }
  
  // БЕЗОПАСНОЕ ИЗВЛЕЧЕНИЕ с дефолтными значениями
  const safeData = {
    news: Array.isArray(data.news) ? data.news : [],
    sources: data.sources && typeof data.sources === 'object' ? data.sources : {},
    sourcesOk: typeof data.sourcesOk === 'number' ? data.sourcesOk : 0,
    sourcesFailed: typeof data.sourcesFailed === 'number' ? data.sourcesFailed : 0,
    llmProvider: data.llmProvider || null
  };
  
  let ideas = [];
  if (safeData.llmProvider && safeData.news.length > 0) {
    try {
      ideas = await generateLLMIdeas(safeData.news, safeData.llmProvider);
    } catch (error) {
      console.warn('[Inject] Ошибка генерации идей:', error.message);
    }
  }
  
  return {
    news: safeData.news,
    ideas: ideas || [],
    sources: safeData.sources,
    sourcesOk: safeData.sourcesOk,
    sourcesFailed: safeData.sourcesFailed,
    timestamp: new Date().toISOString()
  };
}

export default {
  PANELS,
  synthesize,
  generateIdeas,
  fetchAllNews
};
