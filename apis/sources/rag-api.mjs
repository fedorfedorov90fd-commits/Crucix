/**
 * apis/sources/rag-api.mjs — SERVICE-МОДУЛЬ: ВЕКТОРНАЯ ПАМЯТЬ И RAG-ПОИСК
 *
 * КОНТРАКТ CRUCIX v2 (SERVICE, мультиметодный).
 * ИСТОЧНИК: data/rag/documents.json — persist-файл с документами.
 *
 * Векторная память Crucix: база знаний с векторными эмбеддингами
 * (детерминированными, 64-мерными), косинусный поиск, RAG-запросы
 * с извлечением контекста из релевантных документов.
 *
 * ПОЧЕМУ SERVICE А НЕ LAYER:
 *   - Мультиметодный (GET + POST + DELETE).
 *   - Пишет документы в persist-файл.
 *   - Не является слоем карты (нет точек, нет vizType).
 *
 * ПУБЛИЧНЫЕ ЭНДПОИНТЫ:
 *   GET    /                  — корень (описание + сводка)
 *   GET    /status            — health-check
 *   GET    /documents         — список документов (?category=)
 *   GET    /document/:id      — конкретный документ
 *   GET    /stats             — статистика
 *   GET    /categories        — список категорий
 *   GET    /tags              — список тегов
 *   GET    /search?q=         — поиск (GET-форма)
 *   GET    /recent?limit=     — последние добавленные
 *   GET    /render            — рендер-конфиг
 *   POST   /index             — добавить документ
 *   POST   /search            — поиск (POST-форма)
 *   POST   /query             — RAG-ответ с контекстом
 *   POST   /bulk-index        — массовое добавление
 *   POST   /reindex           — пересчитать эмбеддинги
 *   DELETE /document/:id      — удалить документ
 *   DELETE /index             — очистить всю базу (confirm: true)
 *
 * ФОРМАТЫ: json, csv, series, stats, raw.
 * ПОИСК: детерминированный 64-мерный вектор (SHA-1 → нормализация) + косинус.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { loadPersist, savePersist } from './lib/basket-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(PROJECT_ROOT, 'data', 'rag');
const DOCS_FILE = join(DATA_DIR, 'documents.json');

export const route = '/api/services/rag';
export const methods = ['GET', 'POST', 'DELETE'];

export const meta = {
  service: true,
  description: 'Векторная память и RAG-поиск: база знаний с эмбеддингами, косинусный поиск, извлечение контекста для LLM',
  cache: 0,
  version: '2.0.0',
};

// ============================================================
//  КОНСТАНТЫ
// ============================================================

const MAX_BODY_BYTES = 1_000_000;
const MAX_DOCUMENTS = 10_000;
const MAX_BULK_ITEMS = 100;
const VECTOR_DIM = 64;
const DEFAULT_SEARCH_LIMIT = 5;
const MAX_SEARCH_LIMIT = 50;

// ============================================================
//  ДЕТЕРМИНИРОВАННЫЕ ЭМБЕДДИНГИ
// ============================================================

/**
 * Детерминированный 64-мерный вектор из текста.
 * Используем SHA-1 от слова → 8 байт → 8 float-значений [0,1).
 * Накопительно по всем словам, затем нормализуем.
 *
 * Ключевое свойство: одна и та же строка всегда даёт один и тот же вектор.
 * Это делает поиск воспроизводимым. Прототип использовал Math.random()
 * и был нестабилен.
 */
function getEmbedding(text) {
  const vector = new Array(VECTOR_DIM).fill(0);
  const words = String(text || '').toLowerCase().split(/[^a-zа-яё0-9]+/i).filter(Boolean);

  if (words.length === 0) return vector;

  for (const word of words) {
    const hash = createHash('sha1').update(word).digest();
    // Берём 8 байт, разворачиваем в 8 позиций по модулю VECTOR_DIM
    for (let i = 0; i < 8; i++) {
      const byte = hash[i];
      const pos = (byte * 8 + i) % VECTOR_DIM;
      vector[pos] += (byte / 255) * 2 - 1; // [-1, 1]
    }
  }

  // Нормализация в единичный вектор
  let norm = 0;
  for (const v of vector) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < VECTOR_DIM; i++) vector[i] /= norm;
  }
  return vector;
}

function cosineSimilarity(v1, v2) {
  if (!Array.isArray(v1) || !Array.isArray(v2)) return 0;
  if (v1.length !== v2.length) return 0;
  let dot = 0;
  for (let i = 0; i < v1.length; i++) dot += v1[i] * v2[i];
  // Вектора уже нормированы — косинус = dot
  return dot;
}

// ============================================================
//  ЗАГРУЗКА / СОХРАНЕНИЕ
// ============================================================

async function loadDocuments() {
  const result = await loadPersist({
    persistFile: DOCS_FILE,
    defaults: { documents: [], created_at: null, updated_at: null },
  });
  const data = result.data || {};
  if (!Array.isArray(data.documents)) data.documents = [];
  return { documents: data.documents, source: result.source, error: result.error };
}

async function saveDocuments(documents) {
  return savePersist({
    persistFile: DOCS_FILE,
    data: {
      documents,
      updated_at: new Date().toISOString(),
      count: documents.length,
    },
  });
}

// ============================================================
//  УТИЛИТЫ
// ============================================================

function generateId() {
  return `doc-${Date.now()}-${createHash('sha1').update(String(Math.random())).digest('hex').slice(0, 8)}`;
}

function normalizeDocument(doc, i) {
  return {
    id: String(doc.id || `doc-${String(i).padStart(3, '0')}`),
    title: doc.title || 'Без названия',
    content: doc.content || '',
    category: String(doc.category || 'general').toLowerCase(),
    source: doc.source || 'user',
    date: String(doc.date || '').slice(0, 10) || null,
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    embedding: Array.isArray(doc.embedding) && doc.embedding.length === VECTOR_DIM
      ? doc.embedding
      : getEmbedding(doc.content || doc.title || ''),
    created_at: doc.created_at || new Date().toISOString(),
    content_length: (doc.content || '').length,
  };
}

function readBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', c => {
      total += c.length;
      if (total > maxBytes) { req.destroy(); reject(new Error('body_too_large')); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      const raw = Buffer.concat(chunks).toString('utf8');
      try { resolve(JSON.parse(raw)); }
      catch (e) { reject(new Error('invalid_json_body: ' + e.message)); }
    });
    req.on('error', reject);
  });
}

// ============================================================
//  ПОИСК
// ============================================================

function searchDocuments(query, documents, limit = DEFAULT_SEARCH_LIMIT) {
  if (!query || documents.length === 0) return [];
  const queryVec = getEmbedding(query);
  const scored = documents.map(doc => {
    const sim = cosineSimilarity(queryVec, doc.embedding);
    return { doc, similarity: sim };
  });
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, limit).map(({ doc, similarity }) => ({
    id: doc.id,
    title: doc.title,
    content: doc.content.slice(0, 500),
    category: doc.category,
    source: doc.source,
    date: doc.date,
    tags: doc.tags,
    similarity: Number((similarity * 100).toFixed(2)),
  }));
}

function buildContext(results, maxChars = 1500) {
  if (results.length === 0) return 'Нет релевантных документов.';
  let out = '';
  for (const r of results) {
    const chunk = `[${r.title}] ${r.content}\n\n`;
    if (out.length + chunk.length > maxChars) break;
    out += chunk;
  }
  return out.trim();
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(documents) {
  const byCategory = {};
  const bySource = {};
  const tagCounts = {};
  let totalContentLength = 0;
  let withEmbedding = 0;

  for (const d of documents) {
    byCategory[d.category] = (byCategory[d.category] || 0) + 1;
    bySource[d.source] = (bySource[d.source] || 0) + 1;
    for (const t of d.tags) tagCounts[t] = (tagCounts[t] || 0) + 1;
    totalContentLength += d.content_length || 0;
    if (Array.isArray(d.embedding) && d.embedding.length === VECTOR_DIM) withEmbedding++;
  }

  const top = (obj, limit = 15) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name, count]) => ({ name, count }));

  return {
    total: documents.length,
    with_embedding: withEmbedding,
    total_content_length: totalContentLength,
    avg_content_length: documents.length > 0 ? Math.round(totalContentLength / documents.length) : 0,
    unique_categories: Object.keys(byCategory).length,
    unique_sources: Object.keys(bySource).length,
    unique_tags: Object.keys(tagCounts).length,
    vector_dim: VECTOR_DIM,
    by_category: byCategory,
    by_source: bySource,
    top_tags: top(tagCounts, 15),
  };
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toCSV(documents) {
  const lines = ['id,title,category,source,date,content_length,tags'];
  const esc = v => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  for (const d of documents) {
    lines.push([d.id, d.title, d.category, d.source, d.date, d.content_length, (d.tags || []).join(';')].map(esc).join(','));
  }
  return lines.join('\n') + '\n';
}

function toSeries(documents) {
  return documents.map(d => ({
    id: d.id,
    title: d.title,
    category: d.category,
    source: d.source,
    date: d.date,
    tags: d.tags,
    content_length: d.content_length,
  }));
}

function sendJSON(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(body)),
    ...extra,
  });
  res.end(body);
}

function sendText(res, status, text, ct = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': ct, 'Content-Length': String(Buffer.byteLength(text)) });
  res.end(text);
}

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  const extra = {
    'X-Service': 'rag',
    'X-Service-Version': meta.version,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/services\/rag/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
      res.end();
      return;
    }

    // ============================================================
    //  GET
    // ============================================================
    if (req.method === 'GET') {
      // Загрузка с локальным try/catch
      let loaded;
      try {
        loaded = await loadDocuments();
      } catch (e) {
        return sendJSON(res, 500, { success: false, error: 'load_error', message: e.message }, extra);
      }
      const { documents, source, error } = loaded;

      if (sub === '/' || sub === '') {
        return sendJSON(res, 200, {
          service: 'rag',
          version: meta.version,
          description: meta.description,
          documents_count: documents.length,
          stats: computeStats(documents),
          endpoints: {
            'GET /status': 'health-check',
            'GET /documents': 'список документов (?category=)',
            'GET /document/:id': 'конкретный документ',
            'GET /stats': 'статистика',
            'GET /categories': 'список категорий',
            'GET /tags': 'список тегов',
            'GET /search?q=': 'поиск (GET-форма)',
            'GET /recent?limit=': 'последние добавленные',
            'GET /render': 'рендер-конфиг',
            'POST /index': 'добавить документ',
            'POST /search': 'поиск (POST-форма)',
            'POST /query': 'RAG-ответ с контекстом',
            'POST /bulk-index': 'массовое добавление',
            'POST /reindex': 'пересчитать эмбеддинги',
            'DELETE /document/:id': 'удалить документ',
            'DELETE /index': 'очистить всю базу (confirm:true)',
          },
        }, extra);
      }

      if (sub === '/status') {
        return sendJSON(res, 200, {
          success: true,
          service: 'rag',
          status: 'online',
          documents: documents.length,
          source,
          error: error || null,
          timestamp: new Date().toISOString(),
        }, extra);
      }

      if (sub === '/documents') {
        const categoryFilter = query.category ? String(query.category).toLowerCase() : null;
        let filtered = documents;
        if (categoryFilter && categoryFilter !== 'all') {
          filtered = filtered.filter(d => d.category === categoryFilter);
        }
        if (format === 'csv') return sendText(res, 200, toCSV(filtered), 'text/csv; charset=utf-8');
        if (format === 'series') return sendJSON(res, 200, { series: toSeries(filtered), count: filtered.length }, extra);
        if (format === 'raw') return sendJSON(res, 200, { data: filtered, total: documents.length }, extra);
        return sendJSON(res, 200, {
          success: true,
          documents: filtered.map(d => ({ ...d, embedding: undefined })),
          total: filtered.length,
          total_all: documents.length,
          timestamp: new Date().toISOString(),
        }, extra);
      }

      if (sub.startsWith('/document/')) {
        const id = decodeURIComponent(sub.slice('/document/'.length));
        const doc = documents.find(d => d.id === id);
        if (!doc) return sendJSON(res, 404, { success: false, error: 'document_not_found', id }, extra);
        return sendJSON(res, 200, { success: true, document: { ...doc, embedding: undefined } }, extra);
      }

      if (sub === '/stats' || format === 'stats') {
        return sendJSON(res, 200, { success: true, stats: computeStats(documents), source }, extra);
      }

      if (sub === '/categories') {
        const set = new Set(documents.map(d => d.category));
        const list = [...set].map(c => ({ name: c, count: documents.filter(d => d.category === c).length })).sort((a, b) => b.count - a.count);
        return sendJSON(res, 200, { success: true, categories: list, total: list.length }, extra);
      }

      if (sub === '/tags') {
        const counts = {};
        for (const d of documents) for (const t of d.tags) counts[t] = (counts[t] || 0) + 1;
        const list = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
        return sendJSON(res, 200, { success: true, tags: list, total: list.length }, extra);
      }

      if (sub === '/search') {
        const q = String(query.q || '').trim();
        if (!q) return sendJSON(res, 400, { success: false, error: 'field_required: q' }, extra);
        const limit = Math.min(parseInt(query.limit, 10) || DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT);
        const results = searchDocuments(q, documents, limit);
        return sendJSON(res, 200, { success: true, query: q, count: results.length, results }, extra);
      }

      if (sub === '/recent') {
        const limit = parseInt(query.limit, 10) || 10;
        const sorted = documents.slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
        return sendJSON(res, 200, { success: true, recent: sorted.slice(0, limit).map(d => ({ ...d, embedding: undefined })), count: Math.min(limit, documents.length) }, extra);
      }

      if (sub === '/render') {
        return sendJSON(res, 200, {
          render: {
            type: 'table',
            columns: ['id', 'title', 'category', 'source', 'date', 'content_length'],
            documents: documents.map(d => ({ ...d, embedding: undefined })),
            stats: computeStats(documents),
          },
        }, extra);
      }

      return sendJSON(res, 404, {
        success: false,
        error: 'endpoint_not_found',
        path: sub,
        available: ['/', '/status', '/documents', '/document/:id', '/stats', '/categories', '/tags', '/search', '/recent', '/render'],
      }, extra);
    }

    // ============================================================
    //  POST
    // ============================================================
    if (req.method === 'POST') {
      let body;
      try { body = await readBody(req); }
      catch (e) { return sendJSON(res, 400, { success: false, error: 'invalid_body', message: e.message }, extra); }

      // Загрузка
      let loaded;
      try {
        loaded = await loadDocuments();
      } catch (e) {
        return sendJSON(res, 500, { success: false, error: 'load_error', message: e.message }, extra);
      }
      const { documents } = loaded;

      if (sub === '/index' || sub === '/') {
        const title = String(body.title || 'Без названия');
        const content = String(body.content || '');
        if (!content) return sendJSON(res, 400, { success: false, error: 'field_required: content' }, extra);

        if (documents.length >= MAX_DOCUMENTS) {
          return sendJSON(res, 409, { success: false, error: 'limit_reached', max: MAX_DOCUMENTS }, extra);
        }

        const doc = {
          id: generateId(),
          title,
          content,
          category: String(body.category || 'general').toLowerCase(),
          source: body.source || 'user',
          date: new Date().toISOString().slice(0, 10),
          tags: Array.isArray(body.tags) ? body.tags : [],
          embedding: getEmbedding(content),
          content_length: content.length,
          created_at: new Date().toISOString(),
        };

        documents.push(doc);
        const saved = await saveDocuments(documents);
        if (!saved.ok) return sendJSON(res, 500, { success: false, error: 'save_failed', detail: saved.error }, extra);

        return sendJSON(res, 200, {
          success: true,
          document: { ...doc, embedding: undefined },
          total: documents.length,
          message: 'Документ добавлен в базу знаний',
        }, extra);
      }

      if (sub === '/bulk-index') {
        const items = Array.isArray(body.documents) ? body.documents : [];
        if (items.length === 0) return sendJSON(res, 400, { success: false, error: 'field_required: documents[]' }, extra);
        if (items.length > MAX_BULK_ITEMS) return sendJSON(res, 400, { success: false, error: 'too_many', max: MAX_BULK_ITEMS, got: items.length }, extra);

        const added = [];
        for (const item of items) {
          if (documents.length >= MAX_DOCUMENTS) break;
          const content = String(item.content || '');
          if (!content) continue;
          const doc = {
            id: generateId(),
            title: String(item.title || 'Без названия'),
            content,
            category: String(item.category || 'general').toLowerCase(),
            source: item.source || 'user',
            date: new Date().toISOString().slice(0, 10),
            tags: Array.isArray(item.tags) ? item.tags : [],
            embedding: getEmbedding(content),
            content_length: content.length,
            created_at: new Date().toISOString(),
          };
          documents.push(doc);
          added.push({ id: doc.id, title: doc.title });
        }

        const saved = await saveDocuments(documents);
        if (!saved.ok) return sendJSON(res, 500, { success: false, error: 'save_failed', detail: saved.error }, extra);

        return sendJSON(res, 200, { success: true, added: added.length, documents: added, total: documents.length }, extra);
      }

      if (sub === '/search') {
        const q = String(body.query || '').trim();
        if (!q) return sendJSON(res, 400, { success: false, error: 'field_required: query' }, extra);
        const limit = Math.min(parseInt(body.limit, 10) || DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT);
        const results = searchDocuments(q, documents, limit);
        return sendJSON(res, 200, {
          success: true,
          query: q,
          results,
          count: results.length,
          timestamp: new Date().toISOString(),
        }, extra);
      }

      if (sub === '/query') {
        const q = String(body.query || '').trim();
        if (!q) return sendJSON(res, 400, { success: false, error: 'field_required: query' }, extra);
        const limit = Math.min(parseInt(body.limit, 10) || 3, MAX_SEARCH_LIMIT);
        const results = searchDocuments(q, documents, limit);
        const context = buildContext(results);
        const avgSim = results.length > 0 ? results.reduce((a, r) => a + r.similarity, 0) / results.length : 0;
        return sendJSON(res, 200, {
          success: true,
          query: q,
          context,
          sources: results.map(r => ({ id: r.id, title: r.title, similarity: r.similarity })),
          confidence: Math.round(avgSim),
          timestamp: new Date().toISOString(),
        }, extra);
      }

      if (sub === '/reindex') {
        let changed = 0;
        for (const doc of documents) {
          const newEmb = getEmbedding(doc.content || doc.title || '');
          if (!Array.isArray(doc.embedding) || doc.embedding.length !== VECTOR_DIM) {
            doc.embedding = newEmb;
            changed++;
          }
        }
        const saved = await saveDocuments(documents);
        if (!saved.ok) return sendJSON(res, 500, { success: false, error: 'save_failed', detail: saved.error }, extra);
        return sendJSON(res, 200, { success: true, reindexed: changed, total: documents.length }, extra);
      }

      return sendJSON(res, 404, { success: false, error: 'post_endpoint_not_found', path: sub, available: ['/index', '/bulk-index', '/search', '/query', '/reindex'] }, extra);
    }

    // ============================================================
    //  DELETE
    // ============================================================
    if (req.method === 'DELETE') {
      let loaded;
      try {
        loaded = await loadDocuments();
      } catch (e) {
        return sendJSON(res, 500, { success: false, error: 'load_error', message: e.message }, extra);
      }
      const { documents } = loaded;

      if (sub === '/index') {
        let body;
        try { body = await readBody(req); } catch (e) { body = {}; }
        if (body.confirm !== true) {
          return sendJSON(res, 400, {
            success: false,
            error: 'confirmation_required',
            hint: 'send DELETE /api/services/rag/index with body {"confirm": true}',
            will_remove: documents.length,
          }, extra);
        }
        const removed = documents.length;
        const saved = await saveDocuments([]);
        if (!saved.ok) return sendJSON(res, 500, { success: false, error: 'save_failed', detail: saved.error }, extra);
        return sendJSON(res, 200, { success: true, cleared: removed, total: 0 }, extra);
      }

      if (sub.startsWith('/document/')) {
        const id = decodeURIComponent(sub.slice('/document/'.length));
        const idx = documents.findIndex(d => d.id === id);
        if (idx === -1) return sendJSON(res, 404, { success: false, error: 'document_not_found', id }, extra);
        const removed = documents.splice(idx, 1)[0];
        const saved = await saveDocuments(documents);
        if (!saved.ok) return sendJSON(res, 500, { success: false, error: 'save_failed', detail: saved.error }, extra);
        return sendJSON(res, 200, {
          success: true,
          document: { ...removed, embedding: undefined },
          total: documents.length,
          message: 'Документ удалён',
        }, extra);
      }

      return sendJSON(res, 404, { success: false, error: 'delete_endpoint_not_found', path: sub, available: ['/document/:id', '/index'] }, extra);
    }

    return sendJSON(res, 405, { success: false, error: 'method_not_allowed', allowed: methods }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { success: false, error: status === 400 ? 'bad_request' : 'handler_error', message: e.message };
    try { sendJSON(res, status, payload, extra); } catch {}
  }
}
