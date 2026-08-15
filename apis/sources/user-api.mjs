#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №17: ЦИФРОВОЙ ДВОЙНИК ПОЛЬЗОВАТЕЛЯ
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'user');
const PROFILE_FILE = join(DATA_DIR, 'profile.json');
const ACTIVITY_FILE = join(DATA_DIR, 'activity.json');

// ============================================================
// 1. ДАННЫЕ ПО УМОЛЧАНИЮ
// ============================================================

const DEFAULT_PROFILE = {
    id: 'user-001',
    username: 'Аналитик',
    role: 'analyst',
    avatar: null,
    email: null,
    created: new Date().toISOString(),
    lastLogin: new Date().toISOString()
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
        thinktanks: true
    },
    notifications: {
        alerts: true,
        updates: true,
        recommendations: true
    },
    dashboard: {
        widgets: ['index', 'news', 'economy', 'cyber'],
        order: []
    }
};

const DEFAULT_ACTIVITY = [];

// ============================================================
// 2. РАБОТА С ДАННЫМИ
// ============================================================

async function ensureDir() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
    } catch (e) {
        // Игнорируем
    }
}

async function loadProfile() {
    await ensureDir();
    try {
        const data = await fs.readFile(PROFILE_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return { ...DEFAULT_PROFILE, settings: { ...DEFAULT_SETTINGS } };
    }
}

async function saveProfile(profile) {
    await ensureDir();
    await fs.writeFile(PROFILE_FILE, JSON.stringify(profile, null, 2));
}

async function loadActivity() {
    await ensureDir();
    try {
        const data = await fs.readFile(ACTIVITY_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return [...DEFAULT_ACTIVITY];
    }
}

async function saveActivity(activity) {
    await ensureDir();
    await fs.writeFile(ACTIVITY_FILE, JSON.stringify(activity, null, 2));
}

function generateId() {
    return `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getRoleLabel(role) {
    const labels = {
        'analyst': 'Аналитик',
        'researcher': 'Исследователь',
        'viewer': 'Наблюдатель',
        'admin': 'Администратор'
    };
    return labels[role] || role;
}

function getThemeLabel(theme) {
    const labels = {
        'dark': 'Тёмная',
        'light': 'Светлая',
        'auto': 'Авто'
    };
    return labels[theme] || theme;
}

function getLayoutLabel(layout) {
    const labels = {
        'compact': 'Компактный',
        'comfortable': 'Комфортный',
        'spacious': 'Просторный'
    };
    return labels[layout] || layout;
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

export async function handleUserAPI(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    try {
        // --- GET /api/user/profile ---
        if (path === '/api/user/profile' && req.method === 'GET') {
            const profile = await loadProfile();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                profile: profile,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- POST /api/user/profile ---
        if (path === '/api/user/profile' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const current = await loadProfile();
                    const updated = { ...current, ...data, lastLogin: new Date().toISOString() };
                    await saveProfile(updated);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        profile: updated,
                        message: 'Профиль обновлён'
                    }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
            });
            return;
        }

        // --- GET /api/user/settings ---
        if (path === '/api/user/settings' && req.method === 'GET') {
            const profile = await loadProfile();
            const settings = profile.settings || DEFAULT_SETTINGS;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                settings: settings,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- POST /api/user/settings ---
        if (path === '/api/user/settings' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const profile = await loadProfile();
                    profile.settings = { ...profile.settings, ...data };
                    await saveProfile(profile);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        settings: profile.settings,
                        message: 'Настройки обновлены'
                    }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
            });
            return;
        }

        // --- GET /api/user/activity ---
        if (path === '/api/user/activity' && req.method === 'GET') {
            const activity = await loadActivity();
            const limit = parseInt(new URLSearchParams(url.search).get('limit')) || 20;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                activity: activity.slice(0, limit),
                total: activity.length,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- POST /api/user/activity ---
        if (path === '/api/user/activity' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const activity = await loadActivity();
                    const entry = {
                        id: generateId(),
                        timestamp: new Date().toISOString(),
                        action: data.action || 'visit',
                        target: data.target || 'unknown',
                        details: data.details || {},
                        source: data.source || 'web'
                    };
                    activity.unshift(entry);
                    if (activity.length > 100) {
                        activity.length = 100;
                    }
                    await saveActivity(activity);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        entry: entry,
                        total: activity.length
                    }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
            });
            return;
        }

        // --- GET /api/user/export ---
        if (path === '/api/user/export' && req.method === 'GET') {
            const profile = await loadProfile();
            const activity = await loadActivity();
            const exportData = {
                profile: profile,
                settings: profile.settings || DEFAULT_SETTINGS,
                activity: activity.slice(0, 50),
                exportedAt: new Date().toISOString(),
                version: '2.1.2'
            };
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="crucix_profile_${new Date().toISOString().slice(0,10)}.json"`
            });
            res.end(JSON.stringify(exportData, null, 2));
            return;
        }

        // --- POST /api/user/import ---
        if (path === '/api/user/import' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    if (data.profile) {
                        await saveProfile(data.profile);
                    }
                    if (data.activity) {
                        await saveActivity(data.activity);
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        message: 'Профиль импортирован успешно'
                    }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
            });
            return;
        }

        // 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Неизвестный путь'
        }));

    } catch (error) {
        console.error('[User API] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

export default { handleUserAPI };
