// ═══════════════════════════════════════════════════════════════
//  CRUCIX ENTITY GRAPH PERSIST HELPER v1.0.0
//  Утилиты автосохранения графа в data/persist/entity-graph.json.
//  Экспортирует безопасные обёртки над graph.save/load.
// ═══════════════════════════════════════════════════════════════

import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PERSIST_DIR = join(__dirname, '..', 'data', 'persist');
export const PERSIST_FILE = join(PERSIST_DIR, 'entity-graph.json');

export function ensurePersistDir() {
  if (!existsSync(PERSIST_DIR)) mkdirSync(PERSIST_DIR, { recursive: true });
  return PERSIST_DIR;
}

export function persistExists() {
  return existsSync(PERSIST_FILE);
}

export function persistSize() {
  if (!persistExists()) return 0;
  try { return statSync(PERSIST_FILE).size; } catch { return 0; }
}

export function attachAutosave(graph, { intervalMs = 60000, onError = null } = {}) {
  if (!graph || typeof graph.save !== 'function') throw new Error('attachAutosave требует EntityGraph с методом save');
  ensurePersistDir();
  const timer = setInterval(() => {
    try {
      graph.save(PERSIST_FILE);
    } catch (e) {
      if (typeof onError === 'function') onError(e);
    }
  }, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();

  const originalSave = graph.save.bind(graph);
  graph.save = (path) => originalSave(path || PERSIST_FILE);

  return {
    stop() { clearInterval(timer); },
    save() { graph.save(PERSIST_FILE); },
    file: PERSIST_FILE,
    intervalMs,
  };
}

export function loadPersisted(graph, { onMissing = null } = {}) {
  if (!graph || typeof graph.load !== 'function') throw new Error('loadPersisted требует EntityGraph с методом load');
  if (!persistExists()) {
    if (typeof onMissing === 'function') onMissing();
    return false;
  }
  return graph.load(PERSIST_FILE);
}

export function getStats() {
  return {
    persistDir: PERSIST_DIR,
    persistFile: PERSIST_FILE,
    exists: persistExists(),
    sizeBytes: persistSize(),
  };
}
