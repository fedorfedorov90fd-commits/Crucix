/**
 * scripts/collectors/lib/collector-helper.mjs — HELPER FOR COLLECTORS
 *
 * НЕ сборщик. Утилита. Используется файлами scripts/collectors/collect-*.mjs.
 *
 * Назначение: единый паттерн сдачи товара на склад. Сборщик вызывает одну
 * функцию saveRaw(), а хелпер делает всё остальное:
 *   1. Сохраняет сырьё в data/raw/<id>-<timestamp>.json (атомарно).
 *   2. Считает sha256 и bytes автоматически.
 *   3. Дописывает накладную в data/warehouse/incoming/<today>.json
 *      со status=pending (атомарно, без race condition между сборщиками).
 *   4. Опционально — обратная совместимость: пока basket-loader читает
 *      старые форматы, хелпер может ДОПОЛНИТЕЛЬНО писать в data/basket/<id>.json.
 *      Это включается флагом backwardCompat (по умолчанию true).
 *      Когда все 233 сборщика переведены — флаг выключается одним изменением.
 *
 * Контракт: export async function saveRaw(id, data, options) -> объект
 *
 * Зависимости: только fs, path, crypto, url. Никаких внешних пакетов.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');
const RAW_DIR = join(ROOT, 'data', 'raw');
const BASKET_DIR = join(ROOT, 'data', 'basket');
const INCOMING_DIR = join(ROOT, 'data', 'warehouse', 'incoming');

function timestampSuffix() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}-${pad(d.getUTCMinutes())}-${pad(d.getUTCSeconds())}Z`;
}

function todayKey() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function nowIso() {
  return new Date().toISOString();
}

function sha256Buffer(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

async function atomicWrite(targetPath, content) {
  const tmp = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, content, 'utf8');
  await fs.rename(tmp, targetPath);
}

async function ensureDirs() {
  await fs.mkdir(RAW_DIR, { recursive: true });
  await fs.mkdir(BASKET_DIR, { recursive: true });
  await fs.mkdir(INCOMING_DIR, { recursive: true });
}

// Очередь на файл накладной: параллельные сборщики не пересекутся.
const incomingChains = new Map();

function withIncomingLock(key, fn) {
  const prev = incomingChains.get(key) || Promise.resolve();
  const next = prev.then(fn, fn);
  incomingChains.set(key, next.catch(() => {}));
  return next;
}

async function readIncomingOrDefault(filePath, date) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.items)) {
      return { date: parsed.date || date, items: parsed.items };
    }
    return { date, items: [] };
  } catch (e) {
    return { date, items: [] };
  }
}

function upsertItem(items, newItem) {
  const filtered = items.filter(it => !(it.id === newItem.id && it.status === 'pending'));
  filtered.push(newItem);
  return filtered;
}

async function appendToIncoming(item) {
  const date = todayKey();
  const filePath = join(INCOMING_DIR, `${date}.json`);

  return withIncomingLock(filePath, async () => {
    const incoming = await readIncomingOrDefault(filePath, date);
    incoming.items = upsertItem(incoming.items, item);
    const output = {
      date,
      updated_at: nowIso(),
      items: incoming.items
    };
    await atomicWrite(filePath, JSON.stringify(output, null, 2));
    return filePath;
  });
}

/**
 * Сохранить сырьё сборщика и зарегистрировать его в накладной.
 *
 * @param {string} id — идентификатор товара (например 'usgs', 'infrastructure').
 *   Обязательное. Латиница, цифры, дефис.
 * @param {any} data — сырые данные (массив или объект). Сериализуется в JSON.
 * @param {object} [options]
 * @param {string} [options.collector]      — имя сборщика (по умолчанию collect-<id>.mjs).
 * @param {string} [options.source]         — название источника.
 * @param {string} [options.source_url]     — точный URL запроса.
 * @param {string} [options.license]        — лицензия (public-domain, cc-by, ...).
 * @param {string} [options.format_hint]    — подсказка формата (timeseries|points|regions|events|hierarchical).
 * @param {string} [options.value_unit]     — единица измерения (magnitude, severity_0_1, ...).
 * @param {string} [options.value_scale]    — шкала (richter, 0-1, 0-10, 0-100).
 * @param {string} [options.period]         — период ISO 8601 duration (P730D).
 * @param {string} [options.granularity]    — гранулярность (event, daily, snapshot).
 * @param {number} [options.record_count]   — ожидаемое число записей (для проверки).
 * @param {boolean} [options.backwardCompat=true] — писать ли в basket/<id>.json тоже.
 * @param {string} [options.notes]          — свободное поле.
 * @returns {Promise<{raw_file, incoming_file, basket_file, checksum, bytes, id}>}
 */
export async function saveRaw(id, data, options = {}) {
  if (!id || typeof id !== 'string') throw new Error('saveRaw: id обязателен');
  if (data === undefined || data === null) throw new Error('saveRaw: data обязателен');

  await ensureDirs();

  const body = JSON.stringify(data, null, 2);
  const buf = Buffer.from(body, 'utf8');
  const bytes = buf.length;
  const checksum = sha256Buffer(buf);
  const ts = timestampSuffix();
  const rawFileName = `${id}-${ts}.json`;
  const rawFilePath = join(RAW_DIR, rawFileName);

  await atomicWrite(rawFilePath, body);

  const backwardCompat = options.backwardCompat !== false;
  let basketFilePath = null;
  if (backwardCompat) {
    basketFilePath = join(BASKET_DIR, `${id}.json`);
    await atomicWrite(basketFilePath, body);
  }

  const item = {
    id,
    collector: options.collector || `collect-${id}.mjs`,
    source: options.source || id,
    source_url: options.source_url || '',
    fetched_at: nowIso(),
    raw_file: `data/raw/${rawFileName}`,
    format_hint: options.format_hint || 'unknown',
    expected_schema: 'crucix.basket.v1',
    checksum_sha256: checksum,
    bytes,
    record_count_hint: options.record_count || (Array.isArray(data) ? data.length : 0),
    license: options.license || 'unknown',
    value_unit: options.value_unit || 'unknown',
    value_scale: options.value_scale || null,
    period: options.period || null,
    granularity: options.granularity || 'event',
    notes: options.notes || null,
    status: 'pending'
  };

  const incomingFile = await appendToIncoming(item);

  return {
    id,
    raw_file: rawFilePath,
    incoming_file: incomingFile,
    basket_file: basketFilePath,
    checksum,
    bytes
  };
}

export const __internal = {
  timestampSuffix,
  todayKey,
  sha256Buffer,
  atomicWrite,
  readIncomingOrDefault,
  upsertItem
};
