/**
 * apis/sources/user-api.mjs — SERVICE-МОДУЛЬ: ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ
 *
 * КОНТРАКТ CRUCIX v2 (SERVICE, мультиметодный).
 * ИСТОЧНИК:
 *   - data/user/profile.json  — persist-файл профиля.
 *   - data/user/settings.json — persist-файл настроек.
 *   - data/user/activity.json — persist-файл журнала активности (до 500 записей).
 *
 * Цифровой двойник пользователя: профиль, настройки, активность,
 * экспорт/импорт, метаданные (роли, темы, языки, раскладки, виджеты).
 *
 * ПОЧЕМУ SERVICE:
 *   - Мультиметодный (GET + POST + PUT + DELETE).
 *   - Хранит состояние пользователя.
 *   - Не слой карты.
 *
 * ПУБЛИЧНЫЕ ЭНДПОИНТЫ (20):
 *   GET    /              — корень
 *   GET    /status        — health-check
 *   GET    /profile       — профиль
 *   POST   /profile       — обновить профиль
 *   GET    /settings      — настройки
 *   POST   /settings      — заменить настройки
 *   PATCH  /settings      — частичное обновление
 *   GET    /activity      — журнал активности (?limit=)
 *   POST   /activity      — добавить запись
 *   DELETE /activity      — очистить (confirm:true)
 *   GET    /export        — выгрузить профиль (download)
 *   POST   /import        — загрузить профиль
 *   GET    /stats         — статистика
 *   GET    /role          — информация о роли
 *   GET    /themes        — доступные темы
 *   GET    /languages     — доступные языки
 *   GET    /layouts       — доступные раскладки
 *   GET    /widgets       — доступные виджеты
 *   GET    /render        — рендер-конфиг
 *   DELETE /profile       — сброс профиля (confirm:true)
 *
 * ФОРМАТЫ: json, csv, series, stats, raw.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { loadPersist, savePersist } from './lib/basket-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const USER_DIR = join(PROJECT_ROOT, 'data', 'user');
const PROFILE_FILE  = join(USER_DIR, 'profile.json');
const SETTINGS_FILE = join(USER_DIR, 'settings.json');
const ACTIVITY_FILE = join(USER_DIR, 'activity.json');

export const route = '/api/services/user';
export const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export const meta = {
  service: true,
  description: 'Профиль пользователя Crucix: настройки, активность, экспорт/импорт, метаданные (роли/темы/языки/раскладки/виджеты)',
  cache: 0,
  version: '2.0.0',
};

// ============================================================
//  КОНСТАНТЫ
// ============================================================

const MAX_BODY_BYTES = 500_000;
const MAX_ACTIVITY_ENTRIES = 500;
const MAX_EXPORT_ACTIVITY = 100;

const DEFAULT_PROFILE = {
  id: 'user-001',
  username: 'Аналитик',
  role: 'analyst',
  avatar: null,
  email: null,
  bio: null,
  timezone: 'Europe/Moscow',
  created: null,
  lastLogin: null,
};

const DEFAULT_SETTINGS = {
  theme: 'dark',
  language: 'ru',
  layout: 'comfortable',
  autoRefresh: '60s',
  sources: {
    rss: true,
    newsapi: true,
    satellite: true,
    aviation: true,
    shipping: true,
    economy: true,
    cyber: true,
    thinktanks: true,
  },
  notifications: {
    alerts: true,
    updates: true,
    recommendations: true,
  },
  dashboard: {
    widgets: ['index', 'news', 'economy', 'cyber'],
    order: [],
  },
};

const ROLES = {
  analyst:    { label: 'Аналитик',        color: '#0ea5e9' },
  researcher: { label: 'Исследователь',   color: '#8b5cf6' },
  viewer:     { label: 'Наблюдатель',     color: '#64748b' },
  admin:      { label: 'Администратор',   color: '#dc2626' },
};

const THEMES = {
  dark:  { label: 'Тёмная',  color: '#0a0a0f' },
  light: { label: 'Светлая', color: '#f5f5f5' },
  auto:  { label: 'Авто',    color: '#64748b' },
};

const LANGUAGES = {
  ru: { label: 'Русский',   flag: 'RU' },
  en: { label: 'English',   flag: 'EN' },
};

const LAYOUTS = {
  compact:     { label: 'Компактный',  columns: 4 },
  comfortable: { label: 'Комфортный',  columns: 3 },
  spacious:    { label: 'Просторный',  columns: 2 },
};

const WIDGETS = {
  index:     { label: 'Глобальный индекс', icon: 'INDEX' },
  news:      { label: 'Новости',           icon: 'NEWS' },
  economy:   { label: 'Экономика',         icon: 'ECON' },
  cyber:     { label: 'Кибербезопасность', icon: 'CYBER' },
  military:  { label: 'Военные',           icon: 'MIL' },
  space:     { label: 'Космос',            icon: 'SPACE' },
  health:    { label: 'Здоровье',          icon: 'HEALTH' },
  ecology:   { label: 'Экология',          icon: 'ECO' },
  energy:    { label: 'Энергетика',        icon: 'ENERGY' },
  transport: { label: 'Транспорт',         icon: 'TRANS' },
};

// ============================================================
//  УТИЛИТЫ
// ============================================================

function generateActivityId() {
  return `act-${Date.now()}-${createHash('sha1').update(String(Math.random())).digest('hex').slice(0, 6)}`;
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
      try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error('invalid_json_body: ' + e.message)); }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': String(Buffer.byteLength(body)), ...extra });
  res.end(body);
}

function sendText(res, status, text, ct = 'text/plain; charset=utf-8', extra = {}) {
  res.writeHead(status, { 'Content-Type': ct, 'Content-Length': String(Buffer.byteLength(text, 'utf8')), ...extra });
  res.end(text);
}

// ============================================================
//  ЗАГРУЗКА / СОХРАНЕНИЕ
// ============================================================

async function ensureDir() {
  try { await fs.mkdir(USER_DIR, { recursive: true }); } catch {}
}

async function loadProfile() {
  await ensureDir();
  const result = await loadPersist({ persistFile: PROFILE_FILE, defaults: null });
  const data = result.data;
  if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
    const fresh = { ...DEFAULT_PROFILE, created: new Date().toISOString(), lastLogin: new Date().toISOString() };
    await savePersist({ persistFile: PROFILE_FILE, data: fresh });
    return { profile: fresh, source: 'defaults' };
  }
  return { profile: data, source: result.source };
}

async function saveProfile(profile) {
  return savePersist({ persistFile: PROFILE_FILE, data: profile });
}

async function loadSettings() {
  await ensureDir();
  const result = await loadPersist({ persistFile: SETTINGS_FILE, defaults: null });
  const data = result.data;
  if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
    await savePersist({ persistFile: SETTINGS_FILE, data: DEFAULT_SETTINGS });
    return { settings: { ...DEFAULT_SETTINGS }, source: 'defaults' };
  }
  return { settings: data, source: result.source };
}

async function saveSettings(settings) {
  return savePersist({ persistFile: SETTINGS_FILE, data: settings });
}

async function loadActivity() {
  await ensureDir();
  const result = await loadPersist({ persistFile: ACTIVITY_FILE, defaults: { entries: [] } });
  const data = result.data || {};
  let entries = [];
  if (Array.isArray(data)) entries = data;
  else if (Array.isArray(data.entries)) entries = data.entries;
  return entries;
}

async function saveActivity(entries) {
  // Храним только последние MAX_ACTIVITY_ENTRIES
  const trimmed = entries.slice(0, MAX_ACTIVITY_ENTRIES);
  return savePersist({ persistFile: ACTIVITY_FILE, data: { entries: trimmed, updated_at: new Date().toISOString(), count: trimmed.length } });
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeUserStats(profile, settings, activity) {
  const byAction = {};
  const bySource = {};
  const byDay = {};
  for (const e of activity) {
    byAction[e.action] = (byAction[e.action] || 0) + 1;
    if (e.source) bySource[e.source] = (bySource[e.source] || 0) + 1;
    if (e.timestamp) {
      const day = String(e.timestamp).slice(0, 10);
      byDay[day] = (byDay[day] || 0) + 1;
    }
  }
  const top = (obj, n = 10) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));
  const days = Object.keys(byDay).sort();
  return {
    profile: {
      id: profile.id,
      username: profile.username,
      role: profile.role,
      has_avatar: !!profile.avatar,
      has_email: !!profile.email,
      created: profile.created,
      lastLogin: profile.lastLogin,
    },
    settings: {
      theme: settings.theme,
      language: settings.language,
      layout: settings.layout,
      autoRefresh: settings.autoRefresh,
      widgets_count: Array.isArray(settings.dashboard?.widgets) ? settings.dashboard.widgets.length : 0,
      sources_enabled: Object.values(settings.sources || {}).filter(Boolean).length,
      notifications_enabled: Object.values(settings.notifications || {}).filter(Boolean).length,
    },
    activity: {
      total: activity.length,
      max_capacity: MAX_ACTIVITY_ENTRIES,
      usage_pct: activity.length > 0 ? Math.round((activity.length / MAX_ACTIVITY_ENTRIES) * 100) : 0,
      top_actions: top(byAction, 10),
      top_sources: top(bySource, 10),
      date_first: days[0] || null,
      date_last: days[days.length - 1] || null,
      active_days: days.length,
    },
  };
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toCSV(entries) {
  const lines = ['id,timestamp,action,target,source'];
  const esc = v => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  for (const e of entries) lines.push([e.id, e.timestamp, e.action, e.target, e.source].map(esc).join(','));
  return lines.join('\n') + '\n';
}

function toSeries(entries) {
  return entries.map(e => ({
    id: e.id, timestamp: e.timestamp, action: e.action, target: e.target, source: e.source,
  }));
}

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  const extra = {
    'X-Service': 'user',
    'X-Service-Version': meta.version,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/services\/user/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
      res.end();
      return;
    }

    // Загрузка с локальным try/catch
    let profileLoaded, settingsLoaded, activity;
    try {
      [profileLoaded, settingsLoaded] = await Promise.all([loadProfile(), loadSettings()]);
      activity = await loadActivity();
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: 'load_error', message: e.message }, extra);
    }
    const profile = profileLoaded.profile;
    const settings = settingsLoaded.settings;

    // ============================================================
    //  GET
    // ============================================================
    if (req.method === 'GET') {

      if (sub === '/' || sub === '') {
        return sendJSON(res, 200, {
          service: 'user',
          version: meta.version,
          description: meta.description,
          endpoints: {
            'GET /status':       'health-check',
            'GET /profile':      'профиль',
            'POST /profile':     'обновить профиль',
            'GET /settings':     'настройки',
            'POST /settings':    'заменить настройки',
            'PATCH /settings':   'частичное обновление',
            'GET /activity':     'журнал активности (?limit=)',
            'POST /activity':    'добавить запись',
            'DELETE /activity':  'очистить (confirm:true)',
            'GET /export':       'выгрузить (download)',
            'POST /import':      'загрузить',
            'GET /stats':        'статистика',
            'GET /role':         'инфо о роли',
            'GET /themes':       'доступные темы',
            'GET /languages':    'доступные языки',
            'GET /layouts':      'доступные раскладки',
            'GET /widgets':      'доступные виджеты',
            'GET /render':       'рендер-конфиг',
            'DELETE /profile':   'сброс профиля (confirm:true)',
          },
          current: {
            user_id: profile.id,
            username: profile.username,
            role: profile.role,
            role_label: ROLES[profile.role]?.label || profile.role,
            theme: settings.theme,
            language: settings.language,
            activity_count: activity.length,
          },
        }, extra);
      }

      if (sub === '/status') {
        return sendJSON(res, 200, {
          success: true,
          service: 'user',
          status: 'online',
          user_id: profile.id,
          username: profile.username,
          role: profile.role,
          activity_count: activity.length,
          settings_source: settingsLoaded.source,
          profile_source: profileLoaded.source,
          timestamp: new Date().toISOString(),
        }, extra);
      }

      if (sub === '/profile') {
        return sendJSON(res, 200, {
          success: true,
          profile: {
            ...profile,
            roleLabel: ROLES[profile.role]?.label || profile.role,
            roleColor: ROLES[profile.role]?.color || '#64748b',
          },
          source: profileLoaded.source,
          timestamp: new Date().toISOString(),
        }, extra);
      }

      if (sub === '/settings') {
        return sendJSON(res, 200, {
          success: true,
          settings,
          source: settingsLoaded.source,
          timestamp: new Date().toISOString(),
        }, extra);
      }

      if (sub === '/activity') {
        const limit = parseInt(query.limit, 10) || 20;
        const offset = parseInt(query.offset, 10) || 0;
        const slice = activity.slice(offset, offset + limit);
        if (format === 'csv') return sendText(res, 200, toCSV(slice), 'text/csv; charset=utf-8');
        if (format === 'series') return sendJSON(res, 200, { series: toSeries(slice), count: slice.length }, extra);
        if (format === 'raw') return sendJSON(res, 200, { data: activity, total: activity.length }, extra);
        return sendJSON(res, 200, {
          success: true,
          activity: slice,
          total: activity.length,
          limit,
          offset,
          timestamp: new Date().toISOString(),
        }, extra);
      }

      if (sub === '/export') {
        const exportData = {
          crucix_export: {
            version: '2.0.0',
            exported_at: new Date().toISOString(),
          },
          profile,
          settings,
          activity: activity.slice(0, MAX_EXPORT_ACTIVITY),
        };
        const body = JSON.stringify(exportData, null, 2);
        const dateStr = new Date().toISOString().slice(0, 10);
        return sendText(res, 200, body, 'application/json; charset=utf-8', {
          'Content-Disposition': `attachment; filename="crucix_profile_${dateStr}.json"`,
        });
      }

      if (sub === '/stats' || format === 'stats') {
        return sendJSON(res, 200, {
          success: true,
          stats: computeUserStats(profile, settings, activity),
        }, extra);
      }

      if (sub === '/role') {
        return sendJSON(res, 200, {
          success: true,
          current: profile.role,
          current_label: ROLES[profile.role]?.label || profile.role,
          roles: Object.entries(ROLES).map(([key, def]) => ({ key, ...def })),
          total: Object.keys(ROLES).length,
        }, extra);
      }

      if (sub === '/themes') {
        return sendJSON(res, 200, {
          success: true,
          current: settings.theme,
          themes: Object.entries(THEMES).map(([key, def]) => ({ key, ...def })),
          total: Object.keys(THEMES).length,
        }, extra);
      }

      if (sub === '/languages') {
        return sendJSON(res, 200, {
          success: true,
          current: settings.language,
          languages: Object.entries(LANGUAGES).map(([key, def]) => ({ key, ...def })),
          total: Object.keys(LANGUAGES).length,
        }, extra);
      }

      if (sub === '/layouts') {
        return sendJSON(res, 200, {
          success: true,
          current: settings.layout,
          layouts: Object.entries(LAYOUTS).map(([key, def]) => ({ key, ...def })),
          total: Object.keys(LAYOUTS).length,
        }, extra);
      }

      if (sub === '/widgets') {
        const enabled = settings.dashboard?.widgets || [];
        return sendJSON(res, 200, {
          success: true,
          enabled,
          available: Object.entries(WIDGETS).map(([key, def]) => ({ key, ...def, is_enabled: enabled.includes(key) })),
          total: Object.keys(WIDGETS).length,
        }, extra);
      }

      if (sub === '/render') {
        return sendJSON(res, 200, {
          render: {
            type: 'profile',
            profile: { ...profile, roleLabel: ROLES[profile.role]?.label },
            settings,
            stats: computeUserStats(profile, settings, activity),
            recent_activity: activity.slice(0, 10),
          },
        }, extra);
      }

      return sendJSON(res, 404, {
        success: false,
        error: 'endpoint_not_found',
        path: sub,
        available: ['/', '/status', '/profile', '/settings', '/activity', '/export', '/stats', '/role', '/themes', '/languages', '/layouts', '/widgets', '/render'],
      }, extra);
    }

    // ============================================================
    //  POST
    // ============================================================
    if (req.method === 'POST') {
      let body;
      try { body = await readBody(req); }
      catch (e) { return sendJSON(res, 400, { success: false, error: 'invalid_body', message: e.message }, extra); }

      if (sub === '/profile') {
        const allowed = ['username', 'role', 'avatar', 'email', 'bio', 'timezone'];
        const updated = { ...profile };
        for (const k of allowed) if (k in body) updated[k] = body[k];
        updated.lastLogin = new Date().toISOString();
        if (body.role && !ROLES[body.role]) {
          return sendJSON(res, 400, { success: false, error: 'invalid_role', got: body.role, allowed: Object.keys(ROLES) }, extra);
        }
        const saved = await saveProfile(updated);
        if (!saved.ok) return sendJSON(res, 500, { success: false, error: 'save_failed', detail: saved.error }, extra);
        return sendJSON(res, 200, {
          success: true,
          profile: { ...updated, roleLabel: ROLES[updated.role]?.label || updated.role },
          message: 'Профиль обновлён',
        }, extra);
      }

      if (sub === '/settings') {
        // Полная замена
        const newSettings = { ...DEFAULT_SETTINGS, ...body };
        const saved = await saveSettings(newSettings);
        if (!saved.ok) return sendJSON(res, 500, { success: false, error: 'save_failed', detail: saved.error }, extra);
        return sendJSON(res, 200, { success: true, settings: newSettings, message: 'Настройки обновлены' }, extra);
      }

      if (sub === '/activity') {
        const entry = {
          id: generateActivityId(),
          timestamp: new Date().toISOString(),
          action: String(body.action || 'visit'),
          target: String(body.target || 'unknown'),
          details: body.details && typeof body.details === 'object' ? body.details : {},
          source: String(body.source || 'web'),
        };
        const newActivity = [entry, ...activity].slice(0, MAX_ACTIVITY_ENTRIES);
        const saved = await saveActivity(newActivity);
        if (!saved.ok) return sendJSON(res, 500, { success: false, error: 'save_failed', detail: saved.error }, extra);
        return sendJSON(res, 200, { success: true, entry, total: newActivity.length }, extra);
      }

      if (sub === '/import') {
        let imported = { profile: false, settings: false, activity: 0 };
        if (body.profile && typeof body.profile === 'object') {
          const merged = { ...DEFAULT_PROFILE, ...body.profile, imported_at: new Date().toISOString() };
          await saveProfile(merged);
          imported.profile = true;
        }
        if (body.settings && typeof body.settings === 'object') {
          const merged = { ...DEFAULT_SETTINGS, ...body.settings };
          await saveSettings(merged);
          imported.settings = true;
        }
        if (Array.isArray(body.activity)) {
          const merged = [...body.activity, ...activity].slice(0, MAX_ACTIVITY_ENTRIES);
          await saveActivity(merged);
          imported.activity = body.activity.length;
        }
        return sendJSON(res, 200, { success: true, imported, message: 'Профиль импортирован' }, extra);
      }

      return sendJSON(res, 404, { success: false, error: 'post_endpoint_not_found', path: sub, available: ['/profile', '/settings', '/activity', '/import'] }, extra);
    }

    // ============================================================
    //  PATCH
    // ============================================================
    if (req.method === 'PATCH') {
      let body;
      try { body = await readBody(req); }
      catch (e) { return sendJSON(res, 400, { success: false, error: 'invalid_body', message: e.message }, extra); }

      if (sub === '/settings') {
        // Частичное обновление — глубокое слияние верхнего уровня
        const merged = { ...settings };
        for (const [k, v] of Object.entries(body)) {
          if (v && typeof v === 'object' && !Array.isArray(v) && merged[k] && typeof merged[k] === 'object') {
            merged[k] = { ...merged[k], ...v };
          } else {
            merged[k] = v;
          }
        }
        const saved = await saveSettings(merged);
        if (!saved.ok) return sendJSON(res, 500, { success: false, error: 'save_failed', detail: saved.error }, extra);
        return sendJSON(res, 200, { success: true, settings: merged, message: 'Настройки обновлены (patch)' }, extra);
      }

      return sendJSON(res, 404, { success: false, error: 'patch_endpoint_not_found', path: sub, available: ['/settings'] }, extra);
    }

    // ============================================================
    //  PUT
    // ============================================================
    if (req.method === 'PUT') {
      if (sub === '/settings') {
        let body;
        try { body = await readBody(req); }
        catch (e) { return sendJSON(res, 400, { success: false, error: 'invalid_body', message: e.message }, extra); }
        const newSettings = { ...DEFAULT_SETTINGS, ...body };
        const saved = await saveSettings(newSettings);
        if (!saved.ok) return sendJSON(res, 500, { success: false, error: 'save_failed', detail: saved.error }, extra);
        return sendJSON(res, 200, { success: true, settings: newSettings }, extra);
      }
      return sendJSON(res, 404, { success: false, error: 'put_endpoint_not_found', path: sub, available: ['/settings'] }, extra);
    }

    // ============================================================
    //  DELETE
    // ============================================================
    if (req.method === 'DELETE') {
      let body;
      try { body = await readBody(req); } catch { body = {}; }

      if (sub === '/activity') {
        if (body.confirm !== true) {
          return sendJSON(res, 400, {
            success: false,
            error: 'confirmation_required',
            hint: 'send DELETE /api/services/user/activity with body {"confirm": true}',
            will_remove: activity.length,
          }, extra);
        }
        const saved = await saveActivity([]);
        if (!saved.ok) return sendJSON(res, 500, { success: false, error: 'save_failed' }, extra);
        return sendJSON(res, 200, { success: true, cleared: activity.length, total: 0 }, extra);
      }

      if (sub === '/profile') {
        if (body.confirm !== true) {
          return sendJSON(res, 400, {
            success: false,
            error: 'confirmation_required',
            hint: 'send DELETE /api/services/user/profile with body {"confirm": true}',
          }, extra);
        }
        const fresh = { ...DEFAULT_PROFILE, created: new Date().toISOString(), lastLogin: new Date().toISOString() };
        await saveProfile(fresh);
        await saveSettings({ ...DEFAULT_SETTINGS });
        await saveActivity([]);
        return sendJSON(res, 200, { success: true, reset: true, profile: fresh }, extra);
      }

      return sendJSON(res, 404, { success: false, error: 'delete_endpoint_not_found', path: sub, available: ['/activity', '/profile'] }, extra);
    }

    return sendJSON(res, 405, { success: false, error: 'method_not_allowed', allowed: methods }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { success: false, error: status === 400 ? 'bad_request' : 'handler_error', message: e.message };
    try { sendJSON(res, status, payload, extra); } catch {}
  }
}
