// Crucix — Action: Watchlist (список наблюдения)
// CRUD по объектам наблюдения: страны, регионы, сущности, темы.
//
// Версия: 1.0.0
// Категория: state.
//
// АКАДЕМИЧЕСКОЕ ОБОСНОВАНИЕ:
//   Оператор не может держать в голове 200 стран. Watchlist — это
//   приоритизация: 5-20 объектов, за которыми следим активно.
//   Каждый объект имеет: ключ (страна ISO3 / регион / сущность),
//   причину наблюдения, приоритет, теги, дату добавления.
//   Хранение — плоский JSON, чтобы легко бэкапить и синхронизировать.

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getActionsRegistry, ACTION_CATEGORIES } from './_registry.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const STATE_DIR = join(PROJECT_ROOT, 'data', 'persist', 'actions');
const WATCHLIST_FILE = join(STATE_DIR, 'watchlist.json');

const PRIORITIES = Object.freeze({
  LOW:    'low',
  NORMAL: 'normal',
  HIGH:   'high',
  URGENT: 'urgent',
});

const PRIORITY_ORDER = { urgent: 0, high: 1, normal: 2, low: 3 };

// ============================================================
//  ХРАНИЛИЩЕ
// ============================================================

async function load() {
  try {
    const raw = await readFile(WATCHLIST_FILE, 'utf-8');
    const d = JSON.parse(raw);
    return Array.isArray(d) ? d : [];
  } catch {
    return [];
  }
}

async function save(items) {
  await mkdir(STATE_DIR, { recursive: true });
  await writeFile(WATCHLIST_FILE, JSON.stringify(items, null, 2), 'utf-8');
}

function normalizeKey(key) {
  return String(key || '').toUpperCase().trim();
}

// ============================================================
//  ОПЕРАЦИИ
// ============================================================

async function addItem({ key, reason = '', priority = PRIORITIES.NORMAL, tags = [], meta = null }) {
  if (!key) throw new Error('key required');
  if (!Object.values(PRIORITIES).includes(priority)) {
    throw new Error(`priority must be one of ${Object.values(PRIORITIES).join(', ')}`);
  }

  const items = await load();
  const k = normalizeKey(key);
  const existing = items.find(i => i.key === k);
  if (existing) {
    return { added: false, reason: 'already_exists', item: existing };
  }

  const item = {
    key: k,
    reason,
    priority,
    tags: Array.isArray(tags) ? tags : [],
    meta,
    addedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  items.push(item);
  await save(items);
  return { added: true, item };
}

async function removeItem({ key }) {
  if (!key) throw new Error('key required');
  const items = await load();
  const k = normalizeKey(key);
  const before = items.length;
  const filtered = items.filter(i => i.key !== k);
  await save(filtered);
  return { removed: before - filtered.length, remaining: filtered.length };
}

async function updateItem({ key, reason, priority, tags, meta }) {
  if (!key) throw new Error('key required');
  const items = await load();
  const k = normalizeKey(key);
  const item = items.find(i => i.key === k);
  if (!item) return { updated: false, reason: 'not_found' };

  if (reason != null) item.reason = reason;
  if (priority != null) {
    if (!Object.values(PRIORITIES).includes(priority)) {
      throw new Error(`priority must be one of ${Object.values(PRIORITIES).join(', ')}`);
    }
    item.priority = priority;
  }
  if (tags != null) item.tags = Array.isArray(tags) ? tags : [];
  if (meta != null) item.meta = meta;
  item.updatedAt = new Date().toISOString();

  await save(items);
  return { updated: true, item };
}

async function listItems({ priority, tag, limit } = {}) {
  let items = await load();
  if (priority) items = items.filter(i => i.priority === priority);
  if (tag) items = items.filter(i => i.tags.includes(tag));
  items.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 99;
    const pb = PRIORITY_ORDER[b.priority] ?? 99;
    if (pa !== pb) return pa - pb;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
  if (limit) items = items.slice(0, limit);
  return items;
}

async function stats() {
  const items = await load();
  const byPriority = {};
  const byTag = {};
  for (const i of items) {
    byPriority[i.priority] = (byPriority[i.priority] || 0) + 1;
    for (const t of i.tags) byTag[t] = (byTag[t] || 0) + 1;
  }
  return { total: items.length, byPriority, byTag };
}

// ============================================================
//  ОБРАБОТЧИКИ ДЕЙСТВИЙ (по одной функции на операцию)
// ============================================================

async function handlerAdd(args) { return addItem(args); }
async function handlerRemove(args) { return removeItem(args); }
async function handlerUpdate(args) { return updateItem(args); }
async function handlerList(args) { return { items: await listItems(args) }; }

// ============================================================
//  РЕГИСТРАЦИЯ
// ============================================================

export function registerWatchlistActions(registry = getActionsRegistry()) {
  registry.register({
    id: 'watchlist_add',
    category: ACTION_CATEGORIES.STATE,
    description: 'Добавить объект в watchlist (ключ, причина, приоритет, теги)',
    argsSchema: { key: 'string', reason: 'string', priority: 'string', tags: 'array' },
    requiredArgs: ['key'],
    cache: 0,
    idempotent: false,
    handler: handlerAdd,
  });
  registry.register({
    id: 'watchlist_remove',
    category: ACTION_CATEGORIES.STATE,
    description: 'Удалить объект из watchlist по ключу',
    argsSchema: { key: 'string' },
    requiredArgs: ['key'],
    cache: 0,
    idempotent: true,
    handler: handlerRemove,
  });
  registry.register({
    id: 'watchlist_update',
    category: ACTION_CATEGORIES.STATE,
    description: 'Обновить объект watchlist (причина, приоритет, теги)',
    argsSchema: { key: 'string', reason: 'string', priority: 'string', tags: 'array' },
    requiredArgs: ['key'],
    cache: 0,
    idempotent: true,
    handler: handlerUpdate,
  });
  registry.register({
    id: 'watchlist_list',
    category: ACTION_CATEGORIES.STATE,
    description: 'Список watchlist с фильтрами по приоритету и тегу',
    argsSchema: { priority: 'string', tag: 'string', limit: 'number' },
    requiredArgs: [],
    cache: 5,
    idempotent: true,
    handler: handlerList,
  });
  return 4;
}

export { PRIORITIES, listItems, stats, addItem, removeItem, updateItem };
