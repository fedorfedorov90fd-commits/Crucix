// ============================================================
// REPORTS-API.MJS — API для работы с отчетами
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = join(__dirname, '..', '..', 'data', 'reports');

export async function handleReportsAPI(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    console.log(`[Reports-API] Запрос: ${req.method} ${pathname}`);

    // Список отчетов
    if (pathname === '/api/reports/list') {
        try {
            const files = await fs.readdir(REPORTS_DIR);
            const reports = [];
            for (const file of files) {
                if (file.startsWith('daily-report-') && file.endsWith('.json')) {
                    try {
                        const filePath = join(REPORTS_DIR, file);
                        const content = await fs.readFile(filePath, 'utf8');
                        const data = JSON.parse(content);
                        reports.push({
                            filename: file,
                            date: data.date || file.replace('daily-report-', '').replace('.json', ''),
                            summary: data.summary || {},
                            timestamp: data.timestamp || null
                        });
                    } catch (e) {
                        console.log(`[Reports] ⚠️ Ошибка чтения ${file}:`, e.message);
                    }
                }
            }
            reports.sort((a, b) => b.date.localeCompare(a.date));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, reports }));
            return;
        } catch (error) {
            console.log('[Reports] ❌ Ошибка чтения папки:', error.message);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, reports: [] }));
            return;
        }
    }

    // Получение конкретного отчета
    if (pathname.startsWith('/api/reports/')) {
        const filename = pathname.replace('/api/reports/', '');
        if (filename && filename.endsWith('.json') && filename !== 'list') {
            try {
                const filePath = join(REPORTS_DIR, filename);
                console.log(`[Reports] Читаем файл: ${filePath}`);
                const content = await fs.readFile(filePath, 'utf8');
                const data = JSON.parse(content);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(data));
                return;
            } catch (error) {
                console.log(`[Reports] ❌ Ошибка чтения ${filename}:`, error.message);
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Отчёт не найден' }));
                return;
            }
        }
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Unknown endpoint' }));
}

export default { handleReportsAPI };
