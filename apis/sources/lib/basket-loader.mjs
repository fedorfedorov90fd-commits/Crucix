/**
 * apis/sources/lib/basket-loader.mjs — DATA-ACCESS LAYER (утилита)
 *
 * НЕ ЯВЛЯЕТСЯ API-МОДУЛЕМ. Не попадает в реестр (не оканчивается на -api.mjs).
 * Используется модулями apis/sources/*-api.mjs для единообразного чтения
 * корзины (basket), persist-файлов и безопасной записи.
 *
 * ВЕРСИЯ 2.0.0 (18.09.2026). Совместимость v0/v1:
 *   - Файлы со schema='crucix.basket.v1' отдаются нативно (source='basket-v1').
 *   - Файлы старого формата оборачиваются через basket-legacy.mjs
 *     (source='basket-legacy'). При этом сохраняется и оригинал в поле .legacy,
 *     чтобы старые API-модули, читающие плоский массив, продолжали работать.
 *
 * ТРИ ФУНКЦИИ:
 *   loadWithFallback({ basketFile, fallbackData, hint })
 *     → { data: v1-объект, legacy: оригинал|null, source, mtime?, error?, detail?, hint? }
 *       source ∈ 'basket-v1' | 'basket-legacy' | 'fallback' | 'corrupted' | 'error'
 *
 *   loadPersist({ persistFile, defaults })
 *     → { data, source: 'persist'|'defaults', mtime?, error? }
 *
 *   savePersist({ persistFile, data, pretty })
 *     → { ok, bytes, error? }
 *
 * ГАРАНТИИ:
 *   - Атомарная запись на Linux (fs.rename атомарна в рамках одной ФС).
 *   - Различение семантики ENOENT / EACCES / JSON-parse.
 *   - Никакого встроенного кеша — кеш дело модуля, не утилиты.
 */

import { promises as fs } from 'fs';
import { dirname } from 'path';
import { wrapLegacy } from './basket-legacy.mjs';

// ============================================================
//  КОНКУРЕНТНО-БЕЗОПАСНАЯ ЗАПИСЬ
// ============================================================

const writeChains = new Map();

function withWriteChain(key, fn) {
  const prev = writeChains.get(key) || Promise.resolve();
  const next = prev.then(fn, fn);
  writeChains.set(key, next.catch(() => {}));
  return next;
}

// ============================================================
//  loadWithFallback
// ============================================================

/**
 * Чтение JSON-файла из корзины с fallback и совместимостью v0/v1.
 *
 * @param {object} opts
 * @param {string} opts.basketFile      — абсолютный путь или относительно PROJECT_ROOT
 * @param {any}    opts.fallbackData    — данные, если файла нет
 * @param {string} [opts.hint]          — подсказка (например 'запустите collect-x.mjs')
 * @returns {Promise<{ data, legacy, source, hint?, error?, detail?, mtime? }>}
 */
export async function loadWithFallback({ basketFile, fallbackData = null, hint = null }) {
  if (!basketFile) throw new Error('loadWithFallback: basketFile required');

  let raw;
  try {
    raw = await fs.readFile(basketFile, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') {
      const wrappedFallback = wrapLegacy(fallbackData);
      return { data: wrappedFallback, legacy: fallbackData, source: 'fallback', hint };
    }
    if (e.code === 'EACCES') {
      return { data: null, legacy: null, source: 'error', error: 'PERMISSION_DENIED', detail: e.message };
    }
    return { data: null, legacy: null, source: 'error', error: e.code || 'READ_ERROR', detail: e.message };
  }

  let st;
  try { st = await fs.stat(basketFile); } catch { st = null; }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    const wrappedFallback = wrapLegacy(fallbackData);
    return {
      data: wrappedFallback,
      legacy: fallbackData,
      source: 'corrupted',
      error: 'CORRUPTED_JSON',
      detail: e.message,
      hint: hint ? `${hint} (файл повреждён, отдаются встроенные данные)` : 'файл повреждён',
    };
  }

  const isNativeV1 = parsed && typeof parsed === 'object' && parsed.schema === 'crucix.basket.v1';
  const wrapped = isNativeV1 ? parsed : wrapLegacy(parsed);

  return {
    data: wrapped,
    legacy: isNativeV1 ? null : parsed,
    source: isNativeV1 ? 'basket-v1' : 'basket-legacy',
    mtime: st ? st.mtime.toISOString() : null,
  };
}

// ============================================================
//  loadPersist
// ============================================================

/**
 * Чтение persist-файла (состояние модуля, история, избранное).
 * При отсутствии файла или ошибке чтения — возвращает defaults без hint.
 *
 * @param {object} opts
 * @param {string} opts.persistFile
 * @param {any}    opts.defaults
 * @returns {Promise<{ data, source, mtime?, error? }>}
 */
export async function loadPersist({ persistFile, defaults = null }) {
  if (!persistFile) throw new Error('loadPersist: persistFile required');

  let raw;
  try {
    raw = await fs.readFile(persistFile, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return { data: defaults, source: 'defaults' };
    return { data: defaults, source: 'defaults', error: e.code || 'READ_ERROR' };
  }

  let st;
  try { st = await fs.stat(persistFile); } catch { st = null; }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { data: defaults, source: 'defaults', error: 'CORRUPTED_JSON', detail: e.message };
  }

  return {
    data: parsed,
    source: 'persist',
    mtime: st ? st.mtime.toISOString() : null,
  };
}

// ============================================================
//  savePersist
// ============================================================

/**
 * Атомарная запись JSON в persist-файл.
 *   1. mkdir -p родительской папки.
 *   2. Запись в <file>.<pid>.<ts>.tmp.
 *   3. fs.rename поверх целевого файла (атомарно на Linux).
 *   4. Конкурентность: promise-цепочка на файл — параллельные вызовы
 *      выстраиваются в очередь, не теряя данные.
 *
 * @param {object} opts
 * @param {string} opts.persistFile
 * @param {any}    opts.data
 * @param {boolean} [opts.pretty=true]
 * @returns {Promise<{ ok, bytes, error? }>}
 */
export async function savePersist({ persistFile, data, pretty = true }) {
  if (!persistFile) throw new Error('savePersist: persistFile required');

  return withWriteChain(persistFile, async () => {
    const parent = dirname(persistFile);
    try { await fs.mkdir(parent, { recursive: true }); }
    catch (e) { return { ok: false, error: 'MKDIR_FAILED', detail: e.message }; }

    const body = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    const tmp = `${persistFile}.${process.pid}.${Date.now()}.tmp`;

    try { await fs.writeFile(tmp, body, 'utf8'); }
    catch (e) { return { ok: false, error: 'WRITE_FAILED', detail: e.message }; }

    try { await fs.rename(tmp, persistFile); }
    catch (e) {
      try { await fs.unlink(tmp); } catch {}
      return { ok: false, error: 'RENAME_FAILED', detail: e.message };
    }

    return { ok: true, bytes: Buffer.byteLength(body, 'utf8') };
  });
}
