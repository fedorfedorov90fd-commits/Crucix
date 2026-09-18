// ============================================================
// collector-config-api.mjs — управление конфигурацией сборщиков
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const CONFIG_FILE = join(PROJECT_ROOT, 'data', 'config', 'collectors-config.json');

// Загрузка конфигурации
export async function getConfig() {
  try {
    const content = await fs.readFile(CONFIG_FILE, 'utf8');
    return JSON.parse(content);
  } catch {
    return { sources: {} };
  }
}

// Сохранение конфигурации
export async function saveConfig(config) {
  await fs.mkdir(join(PROJECT_ROOT, 'data', 'config'), { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// API: получить конфигурацию
export async function handleGetConfig(req, res) {
  try {
    const config = await getConfig();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: config }));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: e.message }));
  }
}

// API: обновить конфигурацию
export async function handleSetConfig(req, res) {
  try {
    const body = await new Promise((resolve) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => resolve(data));
    });
    const newConfig = JSON.parse(body);
    await saveConfig(newConfig);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: newConfig }));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: e.message }));
  }
}

// API: переключить источник (enabled true/false)
export async function handleToggleSource(req, res, url) {
  try {
    const category = url.searchParams.get('category');
    const name = url.searchParams.get('name');
    if (!category || !name) {
      throw new Error('category и name обязательны');
    }
    const config = await getConfig();
    if (!config.sources[category] || !config.sources[category][name]) {
      throw new Error(`Источник ${category}/${name} не найден`);
    }
    const current = config.sources[category][name].enabled;
    config.sources[category][name].enabled = !current;
    await saveConfig(config);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: { category, name, enabled: config.sources[category][name].enabled }
    }));
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: e.message }));
  }
}

// API: обновить ключ для источника
export async function handleSetKey(req, res) {
  try {
    const body = await new Promise((resolve) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => resolve(data));
    });
    const { category, name, key } = JSON.parse(body);
    if (!category || !name) throw new Error('category и name обязательны');
    const config = await getConfig();
    if (!config.sources[category] || !config.sources[category][name]) {
      throw new Error(`Источник ${category}/${name} не найден`);
    }
    config.sources[category][name].key = key || '';
    await saveConfig(config);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: e.message }));
  }
}
