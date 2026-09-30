// plugins/sandbox_worker.mjs
// Worker для выполнения кода плагина в изоляции.
//
// Назначение:
//   Изолированное исполнение плагина в отдельном worker_thread.
//   Перехват fetch с проверкой permissions.
//   Timeout на init и onShutdown.
//   Безопасный вызов функций плагина по имени (без __proto__/constructor).
//
// Особенности:
//   - Zero dependencies: только node:worker_threads, node:url.
//   - Загрузка модуля через pathToFileURL (совместимо с кириллицей в путях).
//   - Проверка permissions для сетевых запросов.
//   - Ловля uncaughtException и unhandledRejection.

import { parentPort, workerData } from 'node:worker_threads';
import { pathToFileURL } from 'node:url';

const { entryPath, config, permissions } = workerData || {};

let pluginModule = null;
const allowedPermissions = new Set(Array.isArray(permissions) ? permissions : []);

const PROTECTED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const INIT_TIMEOUT_MS = 10000;
const SHUTDOWN_TIMEOUT_MS = 5000;

function checkPermission(perm) {
  if (!allowedPermissions.has(perm)) {
    const err = new Error('Permission denied: ' + perm);
    err.code = 'EPERM_SANDBOX';
    throw err;
  }
}

// --- Перехват fetch ---------------------------------

const originalFetch = globalThis.fetch;

globalThis.fetch = async (url, options) => {
  try {
    const urlStr = typeof url === 'string' ? url : (url && url.url) || '';

    const isNetwork =
      urlStr.startsWith('http://') ||
      urlStr.startsWith('https://') ||
      urlStr.startsWith('ws://') ||
      urlStr.startsWith('wss://');

    if (isNetwork) {
      checkPermission('network:outbound');
    }

    return await originalFetch(url, options);
  } catch (e) {
    throw e;
  }
};

// --- Вспомогательные -------------------------------

function _safePostMessage(msg) {
  try {
    parentPort.postMessage(msg);
    return true;
  } catch (_) {
    return false;
  }
}

function _withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    Promise.resolve(promise).then(v => ({ ok: true, value: v })),
    new Promise(resolve => {
      timer = setTimeout(() => resolve({ ok: false, timeout: true, label }), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function _shutdown() {
  if (pluginModule && typeof pluginModule.onShutdown === 'function') {
    const outcome = await _withTimeout(
      pluginModule.onShutdown(),
      SHUTDOWN_TIMEOUT_MS,
      'onShutdown'
    );
    if (!outcome.ok) {
      // Логируем в родителя, но не блокируем выход
      _safePostMessage({ type: 'warning', warning: 'onShutdown_timeout' });
    }
  }
}

// --- Загрузка плагина ------------------------------

async function loadPlugin() {
  if (!entryPath || typeof entryPath !== 'string') {
    _safePostMessage({ type: 'error', error: 'entryPath_missing' });
    setImmediate(() => process.exit(1));
    return;
  }

  try {
    const moduleUrl = pathToFileURL(entryPath).href;
    pluginModule = await import(moduleUrl);

    if (typeof pluginModule.init === 'function') {
      const outcome = await _withTimeout(
        pluginModule.init(config),
        INIT_TIMEOUT_MS,
        'init'
      );
      if (!outcome.ok) {
        _safePostMessage({ type: 'error', error: 'init_timeout' });
        setImmediate(() => process.exit(1));
        return;
      }
    }

    _safePostMessage({ type: 'ready' });
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    _safePostMessage({ type: 'error', error: 'load_failed: ' + msg });
    setImmediate(() => process.exit(1));
  }
}

// --- Обработка сообщений от родителя ---------------

parentPort.on('message', async (msg) => {
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'shutdown') {
    try { await _shutdown(); } catch (_) { /* ignore */ }
    setImmediate(() => process.exit(0));
    return;
  }

  if (msg.type === 'ping') {
    _safePostMessage({ type: 'pong', id: msg.id });
    return;
  }

  const { id, fnName, args } = msg;

  if (typeof id === 'undefined') {
    _safePostMessage({ type: 'warning', warning: 'message_without_id' });
    return;
  }

  try {
    if (typeof fnName !== 'string' || PROTECTED_KEYS.has(fnName)) {
      throw new Error('invalid_fn_name');
    }

    if (!pluginModule || typeof pluginModule[fnName] !== 'function') {
      throw new Error('Function not found: ' + fnName);
    }

    const safeArgs = Array.isArray(args) ? args : [];
    const result = await pluginModule[fnName](...safeArgs);
    _safePostMessage({ id, result });
  } catch (e) {
    const msg2 = e && e.message ? e.message : String(e);
    const isPerm = e && e.code === 'EPERM_SANDBOX';
    _safePostMessage({ id, error: msg2, permission: isPerm });
  }
});

// --- Глобальная защита от падений ------------------

process.on('uncaughtException', (e) => {
  _safePostMessage({
    type: 'error',
    error: 'uncaught: ' + (e && e.message ? e.message : String(e)),
  });
  setImmediate(() => process.exit(1));
});

process.on('unhandledRejection', (reason) => {
  const msg = reason && reason.message ? reason.message : String(reason);
  _safePostMessage({ type: 'warning', warning: 'unhandled_rejection: ' + msg });
});

loadPlugin();
