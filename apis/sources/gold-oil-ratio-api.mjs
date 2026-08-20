/**
 * Gold/Oil Ratio API — геополитический индикатор
 * GET /api/gold-oil-ratio — получить текущие данные
 * GET /api/gold-oil-ratio/history — получить историю
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_PATH = path.join(__dirname, '../../data/indicators/gold-oil-ratio.json');

export async function handleGoldOilRatioAPI(req, res) {
    const url = new URL(req.url, "http://" + req.headers.host);
    const pathname = url.pathname;

    // GET /api/gold-oil-ratio
    if (pathname === '/api/gold-oil-ratio' && req.method === 'GET') {
        try {
            if (!fs.existsSync(DATA_PATH)) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    error: 'Данные не найдены. Запустите сборщик: node scripts/collect-gold-oil-ratio.mjs' 
                }));
                return;
            }

            const rawData = fs.readFileSync(DATA_PATH, 'utf8');
            const data = JSON.parse(rawData);

            const response = {
                timestamp: data.timestamp,
                currentRatio: data.currentRatio,
                avgRatio: data.avgRatio,
                minRatio: data.minRatio,
                maxRatio: data.maxRatio,
                riskLevel: data.riskLevel,
                riskColor: data.riskColor,
                riskDesc: data.riskDesc,
                metrics: data.metrics,
                metadata: data.metadata,
                history: data.history.slice(-30),
            };

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));
        } catch (error) {
            console.error('Ошибка Gold/Oil Ratio API:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Внутренняя ошибка сервера' }));
        }
        return;
    }

    // GET /api/gold-oil-ratio/history
    if (pathname === '/api/gold-oil-ratio/history' && req.method === 'GET') {
        try {
            const url2 = new URL(req.url, "http://" + req.headers.host);
            const limit = parseInt(url2.searchParams.get('limit')) || 365;

            if (!fs.existsSync(DATA_PATH)) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Данные не найдены' }));
                return;
            }

            const rawData = fs.readFileSync(DATA_PATH, 'utf8');
            const data = JSON.parse(rawData);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                history: data.history.slice(-limit),
                totalPoints: data.history.length,
                limit: limit,
            }));
        } catch (error) {
            console.error('Ошибка Gold/Oil Ratio History API:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Внутренняя ошибка сервера' }));
        }
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'API endpoint not found' }));
}