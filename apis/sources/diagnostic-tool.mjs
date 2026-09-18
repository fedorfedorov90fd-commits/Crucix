#!/usr/bin/env node

// ============================================================
// DIAGNOSTIC-TOOL.MJS — API для диагностики Crucix
// ============================================================
// Этот модуль запускает скрипт scripts/diagnostic.mjs
// и возвращает его результат через API.
// ============================================================

import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// ============================================================
// ОСНОВНОЙ ОБРАБОТЧИК API
// ============================================================
export async function handleDiagnosticToolAPI(req, res) {
    try {
        // Парсим параметры запроса
        const url = new URL(req.url, `http://${req.headers.host}`);
        const params = url.searchParams;

        // Параметры
        const checks = params.get('checks') || 'all'; // all, api, pages, layers, keys, syntax
        const maxSize = parseInt(params.get('maxSize')) || 100; // КБ
        const parts = parseInt(params.get('parts')) || 1; // Количество частей (пока не используется)
        const format = params.get('format') || 'json'; // json или text

        // Формируем команду для запуска диагностического скрипта
        const scriptPath = path.join(process.cwd(), 'scripts', 'diagnostic.mjs');
        const command = `node "${scriptPath}" --checks=${checks}`;

        // Запускаем скрипт и получаем вывод
        const { stdout, stderr } = await execAsync(command, {
            timeout: 30000, // 30 секунд
            maxBuffer: 10 * 1024 * 1024, // 10 MB
        });

        if (stderr) {
            console.warn('[DiagnosticTool] stderr:', stderr);
        }

        // Если формат text — отдаём как plain text
        if (format === 'text') {
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(stdout);
            return;
        }

        // Если json — пытаемся распарсить, либо возвращаем в виде текста
        let result;
        try {
            // Пытаемся прочитать файл отчёта, который создаёт diagnostic.mjs
            const reportPath = path.join(process.cwd(), 'diagnostic-report.txt');
            const reportContent = await fs.readFile(reportPath, 'utf-8');
            result = {
                success: true,
                format: 'json',
                checks: checks,
                report: reportContent,
                stdout: stdout,
                stderr: stderr || undefined,
            };
        } catch (e) {
            // Если файла нет, возвращаем stdout
            result = {
                success: true,
                format: 'json',
                checks: checks,
                report: stdout,
                stderr: stderr || undefined,
            };
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result, null, 2));

    } catch (error) {
        console.error('[DiagnosticTool] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: error.message,
            stack: error.stack,
        }));
    }
}

// ============================================================
// ДОПОЛНИТЕЛЬНЫЙ ЭКСПОРТ (если потребуется)
// ============================================================
export default {
    handleDiagnosticToolAPI,
};
