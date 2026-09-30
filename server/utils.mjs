/**
 * server/utils.mjs — УТИЛИТЫ
 *
 * Извлечено из server.mjs v12.0 (ULTIMATE EDITION)
 * Содержит: sendJSON, sendError, fileExists, serveStatic, generate404Page, createStub
 */

import { promises as fs } from 'fs';
import { extname } from 'path';
import config from './config.mjs';
const { MIME_TYPES } = config;

export function sendJSON(res, data, statusCode = 200) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return true;
}

export function sendError(res, message, statusCode = 500) {
    return sendJSON(res, { error: message, status: statusCode }, statusCode);
}

export async function fileExists(filePath) {
    try { await fs.access(filePath); return true; } catch { return false; }
}

export async function serveStatic(req, res, filePath) {
    try {
        const ext = extname(filePath).toLowerCase();
        const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
        const content = await fs.readFile(filePath);
        res.writeHead(200, {
            'Content-Type': mimeType,
            'Cache-Control': 'public, max-age=86400',
            'X-Content-Type-Options': 'nosniff',
        });
        res.end(content);
        return true;
    } catch (error) {
        console.error(`[Static] Ошибка:`, error.message);
        return false;
    }
}

export function generate404Page() {
    return `<!DOCTYPE html>
<html><head><title>404 — Crucix</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a1a;color:#e0e0e0;font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh}.container{text-align:center}h1{font-size:72px;margin:0;color:#2196f3;font-weight:700}p{font-size:20px;color:#888;margin:16px 0 24px}a{color:#2196f3;text-decoration:none;font-size:16px;padding:10px 30px;border:1px solid #2196f3;border-radius:6px}a:hover{opacity:.7;background:rgba(33,150,243,.1)}</style>
</head><body><div class="container"><h1>404</h1><p>Страница не найдена</p><a href="/">← Вернуться на главную</a></div></body></html>`;
}

export function createStub(apiName) {
    return async (req, res) => {
        res.writeHead(501, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: `API "${apiName}" временно недоступен`,
            status: 501,
            timestamp: new Date().toISOString()
        }));
    };
}
