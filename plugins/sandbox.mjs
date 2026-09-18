// plugins/sandbox.mjs
// Sandbox для плагинов Crucix - изоляция исполнения с resource limits.
//
// Назначение:
//   Изоляция кода плагинов в worker_threads с ограничениями:
//     - память (maxOldGenerationSizeMb)
//     - время (timeout на каждый вызов)
//     - отсутствие доступа к env, сети, файловой системе (через sandbox_worker)
//   Управление жизненным циклом sandbox'ов через SandboxManager.
//
// Особенности:
//   - Zero dependencies: только node:worker_threads, node:path, node:url.
//   - Единый set pendingMessages без гонок.
//   - Stop reject'ит все ожидающие вызовы.
//   - Идемпотентный stop.
//   - Singleton через getSandboxManager() с поддержкой reset.

import { Worker } from 'node:worker_threads';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_WORKER_PATH = join(__dirname, 'sandbox_worker.mjs');

export class PluginSandbox {
  constructor(manifest, { timeout = 30000, maxMemory = 128, workerPath } = {}) {
    this.manifest = manifest || {};
    this.timeout = timeout;
    this.maxMemory = maxMemory;
    this.workerPath = workerPath || DEFAULT_WORKER_PATH;
    this.worker = null;
    this.ready = false;
    this.pendingMessages = new Map();
    this.messageId = 0;
    this.startedAt = null;
  }

  async start(entryPath, config = {}) {
    if (this.worker) {
      throw new Error('Sandbox already started');
    }
    if (!entryPath || typeof entryPath !== 'string') {
      throw new Error('entryPath is required');
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const done = (fn, arg) => {
        if (settled) return;
        settled = true;
        fn(arg);
      };

      this.worker = new Worker(this.workerPath, {
        workerData: {
          entryPath,
          config,
          permissions: this.manifest.permissions || [],
        },
        resourceLimits: {
          maxOldGenerationSizeMb: this.maxMemory,
          maxYoungGenerationSizeMb: 32,
          codeRangeSizeMb: 16,
        },
        env: {},
      });

      const initTimeout = setTimeout(() => {
        try { this.worker && this.worker.terminate(); } catch (_) { /* ignore */ }
        done(reject, new Error('Sandbox initialization timeout'));
      }, 10000);

      if (initTimeout.unref) initTimeout.unref();

      this.worker.on('message', (msg) => {
        if (msg && msg.type === 'ready') {
          clearTimeout(initTimeout);
          this.ready = true;
          this.startedAt = Date.now();
          done(resolve);
          return;
        }

        if (msg && msg.type === 'error') {
          clearTimeout(initTimeout);
          done(reject, new Error(msg.error || 'sandbox_init_error'));
          return;
        }

        if (msg && msg.id && this.pendingMessages.has(msg.id)) {
          const pending = this.pendingMessages.get(msg.id);
          this.pendingMessages.delete(msg.id);
          if (msg.error) pending.reject(new Error(msg.error));
          else pending.resolve(msg.result);
        }
      });

      this.worker.on('error', (err) => {
        clearTimeout(initTimeout);
        done(reject, err);
        this._rejectAllPending(new Error('worker_error: ' + (err && err.message ? err.message : String(err))));
      });

      this.worker.on('exit', (code) => {
        clearTimeout(initTimeout);
        this.ready = false;
        if (!settled && code !== 0) {
          done(reject, new Error('Worker exited with code ' + code));
        } else {
          done(resolve);
        }
        this._rejectAllPending(new Error('worker_exited_code_' + code));
      });
    });
  }

  _rejectAllPending(err) {
    for (const [id, pending] of this.pendingMessages) {
      try { pending.reject(err); } catch (_) { /* ignore */ }
      this.pendingMessages.delete(id);
    }
  }

  async call(fnName, ...args) {
    if (!this.ready || !this.worker) {
      throw new Error('Sandbox not ready');
    }

    const id = ++this.messageId;

    return new Promise((resolve, reject) => {
      let settled = false;
      const done = (fn, arg) => {
        if (settled) return;
        settled = true;
        fn(arg);
      };

      const timer = setTimeout(() => {
        this.pendingMessages.delete(id);
        done(reject, new Error('Timeout calling ' + fnName));
      }, this.timeout);

      this.pendingMessages.set(id, {
        resolve: (result) => { clearTimeout(timer); done(resolve, result); },
        reject: (err) => { clearTimeout(timer); done(reject, err); },
      });

      try {
        this.worker.postMessage({ id, fnName, args });
      } catch (e) {
        clearTimeout(timer);
        this.pendingMessages.delete(id);
        done(reject, new Error('postMessage failed: ' + e.message));
      }
    });
  }

  async stop() {
    if (!this.worker) return;

    const worker = this.worker;
    this.worker = null;
    this.ready = false;

    // Отклонить все ожидающие вызовы
    this._rejectAllPending(new Error('sandbox_stopped'));

    try {
      worker.postMessage({ type: 'shutdown' });
    } catch (_) { /* ignore */ }

    // Дать воркеру 100 мс на graceful shutdown, потом terminate
    await new Promise(r => setTimeout(r, 100));

    try {
      await worker.terminate();
    } catch (_) { /* ignore */ }
  }

  isRunning() {
    return this.ready && this.worker !== null;
  }

  status() {
    return {
      name: this.manifest && this.manifest.name,
      running: this.isRunning(),
      pending: this.pendingMessages.size,
      uptimeMs: this.startedAt ? Date.now() - this.startedAt : 0,
      timeout: this.timeout,
      maxMemoryMb: this.maxMemory,
    };
  }
}

export class SandboxManager {
  constructor({ maxSandboxes = 10, defaultTimeout = 30000 } = {}) {
    this.sandboxes = new Map();
    this.maxSandboxes = maxSandboxes;
    this.defaultTimeout = defaultTimeout;
  }

  async createSandbox(manifest, entryPath, config = {}, { replace = false } = {}) {
    if (!manifest || !manifest.name) {
      throw new Error('manifest.name is required');
    }

    if (this.sandboxes.has(manifest.name)) {
      if (!replace) {
        throw new Error('plugin_already_running: ' + manifest.name);
      }
      await this.destroySandbox(manifest.name);
    }

    if (this.sandboxes.size >= this.maxSandboxes) {
      throw new Error('Max sandboxes reached (' + this.maxSandboxes + ')');
    }

    const sandbox = new PluginSandbox(manifest, {
      timeout: manifest.timeout || this.defaultTimeout,
      maxMemory: manifest.maxMemory || 128,
    });

    await sandbox.start(entryPath, config);
    this.sandboxes.set(manifest.name, sandbox);

    return sandbox;
  }

  getSandbox(pluginName) {
    return this.sandboxes.get(pluginName) || null;
  }

  hasSandbox(pluginName) {
    return this.sandboxes.has(pluginName);
  }

  async destroySandbox(pluginName) {
    const sandbox = this.sandboxes.get(pluginName);
    if (!sandbox) return { ok: true, existed: false };

    try {
      await sandbox.stop();
    } catch (_) { /* ignore */ }

    this.sandboxes.delete(pluginName);
    return { ok: true, existed: true };
  }

  async destroyAll() {
    const names = Array.from(this.sandboxes.keys());
    for (const name of names) {
      await this.destroySandbox(name);
    }
    this.sandboxes.clear();
    return { ok: true, stopped: names.length };
  }

  list() {
    return Array.from(this.sandboxes.entries()).map(([name, sandbox]) => ({
      name,
      running: sandbox.isRunning(),
      pending: sandbox.pendingMessages.size,
      uptimeMs: sandbox.startedAt ? Date.now() - sandbox.startedAt : 0,
      timeout: sandbox.timeout,
    }));
  }

  stats() {
    let running = 0;
    for (const sandbox of this.sandboxes.values()) {
      if (sandbox.isRunning()) running++;
    }
    return {
      total: this.sandboxes.size,
      running,
      max: this.maxSandboxes,
      defaultTimeout: this.defaultTimeout,
    };
  }
}

let _manager = null;

export function getSandboxManager(options) {
  if (!_manager) _manager = new SandboxManager(options);
  return _manager;
}

export function _resetSandboxManager() {
  _manager = null;
}

export const SANDBOX_INFO = {
  name: 'Plugin Sandbox',
  description: 'Isolated plugin execution via worker_threads with resource limits',
  runtime: 'worker_threads',
  defaultTimeoutMs: 30000,
  defaultMaxMemoryMb: 128,
};
