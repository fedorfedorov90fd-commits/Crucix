#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №23: ЭКСПОРТ ДАННЫХ И ОТЧЁТОВ
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const EXPORT_DIR = join(ROOT, 'data', 'exports');

// ============================================================
// 1. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

async function ensureExportDir() {
    try {
        await fs.mkdir(EXPORT_DIR, { recursive: true });
    } catch (e) {}
}

function getFilename(prefix, format) {
    const date = new Date().toISOString().slice(0, 10);
    const time = new Date().toISOString().slice(11, 19).replace(/:/g, '-');
    return `${prefix}_${date}_${time}.${format}`;
}

// ============================================================
// 2. ЭКСПОРТ В РАЗНЫЕ ФОРМАТЫ
// ============================================================

function exportJSON(data) {
    return JSON.stringify(data, null, 2);
}

function exportCSV(data) {
    if (!data || !data.length) return '';
    
    const headers = Object.keys(data[0]);
    let csv = headers.join(',') + '\n';
    
    for (const row of data) {
        const values = headers.map(h => {
            let val = row[h] || '';
            if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
                val = `"${val.replace(/"/g, '""')}"`;
            }
            return val;
        });
        csv += values.join(',') + '\n';
    }
    
    return csv;
}

function exportHTML(data, title = 'Отчёт Crucix') {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        body { font-family: Arial, sans-serif; background: #0a0e17; color: #e0e0e0; padding: 20px; }
        h1 { color: #4ecdc4; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #1a2a3a; color: #4ecdc4; padding: 10px; text-align: left; }
        td { padding: 8px; border-bottom: 1px solid #1a2a3a; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 20px 0; }
        .stat-card { background: #111a24; padding: 15px; border-radius: 8px; text-align: center; }
        .stat-value { font-size: 24px; font-weight: bold; color: #4ecdc4; }
        .stat-label { color: #8899aa; font-size: 12px; }
    </style>
</head>
<body>
    <h1>${title}</h1>
    <p>Дата: ${new Date().toLocaleString()}</p>
    <pre>${JSON.stringify(data, null, 2)}</pre>
</body>
</html>`;
}

async function exportDOCX(data, title = 'Отчёт Crucix') {
    try {
        // Пытаемся использовать docx библиотеку
        const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
        
        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    new Paragraph({
                        text: title,
                        heading: HeadingLevel.HEADING_1,
                        spacing: { after: 200 }
                    }),
                    new Paragraph({
                        text: `Дата: ${new Date().toLocaleString()}`,
                        spacing: { after: 300 }
                    }),
                    new Paragraph({
                        text: JSON.stringify(data, null, 2),
                        spacing: { after: 200 }
                    })
                ]
            }]
        });
        
        const buffer = await Packer.toBuffer(doc);
        return buffer;
    } catch (e) {
        console.error('[Export] DOCX не поддерживается:', e.message);
        // Возвращаем JSON как fallback
        return Buffer.from(exportJSON(data));
    }
}

// ============================================================
// 3. ОСНОВНОЙ ОБРАБОТЧИК
// ============================================================

export async function handleExportAPI(req, res) {
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
        await ensureExportDir();

        // --- POST /api/export ---
        if (path === '/api/export' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const { format = 'json', content, filename = 'export', title = 'Отчёт Crucix' } = data;
                    
                    let result;
                    let mimeType;
                    let extension;
                    
                    const exportData = content || data.data || { message: 'Нет данных' };
                    
                    switch (format) {
                        case 'json':
                            result = exportJSON(exportData);
                            mimeType = 'application/json';
                            extension = 'json';
                            break;
                        case 'csv':
                            result = exportCSV(Array.isArray(exportData) ? exportData : [exportData]);
                            mimeType = 'text/csv';
                            extension = 'csv';
                            break;
                        case 'html':
                            result = exportHTML(exportData, title);
                            mimeType = 'text/html';
                            extension = 'html';
                            break;
                        case 'docx':
                            result = await exportDOCX(exportData, title);
                            mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                            extension = 'docx';
                            break;
                        default:
                            result = exportJSON(exportData);
                            mimeType = 'application/json';
                            extension = 'json';
                    }
                    
                    const filename_full = getFilename(filename, extension);
                    
                    // Сохраняем на диск
                    const filepath = join(EXPORT_DIR, filename_full);
                    await fs.writeFile(filepath, result);
                    
                    res.writeHead(200, {
                        'Content-Type': mimeType,
                        'Content-Disposition': `attachment; filename="${filename_full}"`
                    });
                    res.end(result);
                    
                } catch (e) {
                    console.error('[Export] Ошибка:', e);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
            });
            return;
        }

        // --- GET /api/export/formats ---
        if (path === '/api/export/formats' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                formats: [
                    { id: 'json', name: 'JSON', icon: '📋', mime: 'application/json' },
                    { id: 'csv', name: 'CSV', icon: '📊', mime: 'text/csv' },
                    { id: 'html', name: 'HTML', icon: '🌐', mime: 'text/html' },
                    { id: 'docx', name: 'DOCX', icon: '📄', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
                ],
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

    } catch (error) {
        console.error('[Export API] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

export default { handleExportAPI };
