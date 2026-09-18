/**
 * apis/sources/lib/basket-loader.mjs — DATA-ACCESS LAYER (утилита)
 *
 * НЕ ЯВЛЯЕТСЯ API-МОДУЛЕМ. Не попадает в реестр (не оканчивается на -api.mjs).
 * Используется модулями apis/sources/*-api.mjs для единообразного чтения
 * корзины (basket), persist-файлов и безопасной записи.
 *
 * ТРИ ФУНКЦИИ:
 *   loadWithFallback({ basketFile, fallbackData, hint })
 *     → ENOENT:     { data: fallbackData, source: 'fallback', hint }
 *     → JSON error: { data: null, source: 'corrupted', error: 'CORRUPTED_JSON', detail }
 *     → EACCES:     { data: null, source: 'error', error: 'PERMISSION_DENIED' }
 *     → ok:         { data, source: 'basket', mtime }
 *
 *   loadPersist({ persistFile, defaults })
 *     → ENOENT: { data: defaults, source: 'defaults' }
 *     → ok:     { data, source: 'persist', mtime }
 *     → error:  { data: defaults, source: 'defaults', error }
 *
 *   savePersist({ persistFile, data })
 *     → атомарная запись (temp + rename)
 *     → конкурентно-безопасная (promise-цепочка per file)
 *     → mkdir -p перед записью
 *
 * ГАРАНТИИ:
 *   - Атомарная запись на Linux (fs.rename атомарна в рамках одной ФС).
 *   - Различение семантики ENOENT / EACCES / JSON-parse.
 *   - Никакого встроенного кеша — кеш дело модуля, не утилиты.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';

// ============================================================
//  КОНКУРЕНТНО-БЕЗОПАСНАЯ ЗАПИСЬ
// ============================================================

/**
 * Promise-цепочка на файл: если два запроса одновременно пишут в один файл,
 * они выстраиваются в очередь. Последний выигрывает. Потери нет.
 */
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
 * Чтение JSON-файла из корзины с fallback на встроенные данные.
 * Различает три семантики ошибок:
 *   ENOENT       → fallback (файла нет, это нормально до первого сбора)
 *   JSON parse   → corrupted (файл есть, но повреждён — вернуть fallback + error)
 *   EACCES/other → error (реальная проблема с правами/диском)
 *
 * @param {object} opts
 * @param {string} opts.basketFile      — абсолютный путь или относительно PROJECT_ROOT
 * @param {any}    opts.fallbackData    — данные, если файла нет
 * @param {string} [opts.hint]          — подсказка (например 'запустите collect-x.mjs')
 * @returns {Promise<{ data, source, hint?, error?, detail?, mtime? }>}
 */
export async function loadWithFallback({ basketFile, fallbackData = null, hint = null }) {
  if (!basketFile) throw new Error('loadWithFallback: basketFile required');

  let raw;
  try {
    raw = await fs.readFile(basketFile, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') {
      return { data: fallbackData, source: 'fallback', hint };
    }
    if (e.code === 'EACCES') {
      return { data: null, source: 'error', error: 'PERMISSION_DENIED', detail: e.message };
    }
    return { data: null, source: 'error', error: e.code || 'READ_ERROR', detail: e.message };
  }

  let st;
  try { st = await fs.stat(basketFile); } catch { st = null; }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return {
      data: fallbackData,
      source: 'corrupted',
      error: 'CORRUPTED_JSON',
      detail: e.message,
      hint: hint ? `${hint} (файл повреждён, отдаются встроенные данные)` : 'файл повреждён',
    };
  }

  return {
    data: parsed,
    source: 'basket',
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
 *   2. Запись в <file>.<random>.tmp.
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
