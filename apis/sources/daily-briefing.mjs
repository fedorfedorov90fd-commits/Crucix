// ============================================================
// daily-briefing.mjs — Ежедневный AI-дайджест
// ============================================================
// Генерирует сводку ключевых событий с использованием Ollama
// Обновление: при запросе (кэшируется на 1 час)
// ============================================================

import { promises as fs } from 'fs';
import { join } from 'path';

const BASKET_DIR = join(process.cwd(), 'data', 'basket');
const CACHE_FILE = join(process.cwd(), 'data', 'basket', 'daily-briefing-cache.json');

export async function handleDailyBriefing(req, res) {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathname = url.pathname;

        if (pathname === '/api/daily-briefing/' || pathname === '/api/daily-briefing') {
            const force = url.searchParams.get('force') === 'true';
            const briefing = await getDailyBriefing(force);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: briefing,
                generated: new Date().toISOString()
            }));
            return true;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
        return true;
    } catch (error) {
        console.error('[Daily Briefing] Ошибка:', error.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
        return true;
    }
}

async function getDailyBriefing(force) {
    // Проверяем кэш
    if (!force) {
        try {
            const content = await fs.readFile(CACHE_FILE, 'utf8');
            const cached = JSON.parse(content);
            const age = Date.now() - new Date(cached.generated).getTime();
            if (age < 3600000) { // 1 час
                return cached.data;
            }
        } catch {}
    }

    // Собираем данные
    const data = await collectData();

    // Генерируем сводку через Ollama
    let summary = await generateSummary(data);
    if (!summary) {
        summary = generateFallbackSummary(data);
    }

    const result = {
        summary: summary,
        stats: {
            critical_events: data.critical,
            high_events: data.high,
            medium_events: data.medium,
            total_events: data.critical + data.high + data.medium,
            countries_affected: data.countries.length,
            top_countries: data.countries.slice(0, 5)
        },
        raw: data
    };

    // Сохраняем кэш
    await fs.writeFile(CACHE_FILE, JSON.stringify({
        data: result,
        generated: new Date().toISOString()
    }, null, 2));

    return result;
}

async function collectData() {
    const data = {
        critical: 0,
        high: 0,
        medium: 0,
        countries: [],
        notam: [],
        gps: [],
        conflicts: [],
        warnings: [],
        market: {}
    };

    try {
        // NOTAM
        const notam = await loadJson('notam.json');
        if (notam && notam.data) {
            const features = notam.data.features || [];
            data.notam = features.map(f => f.properties || {});
            data.critical += data.notam.filter(n => n.severity === 'critical').length;
            data.high += data.notam.filter(n => n.severity === 'high').length;
            data.medium += data.notam.filter(n => n.severity === 'medium').length;
        }
    } catch {}

    try {
        // GPS-глушение
        const gps = await loadJson('gps-jamming.json');
        if (gps && gps.data) {
            data.gps = gps.data;
            data.critical += data.gps.filter(g => g.severity === 'critical').length;
            data.high += data.gps.filter(g => g.severity === 'high').length;
            data.medium += data.gps.filter(g => g.severity === 'medium').length;
        }
    } catch {}

    try {
        // ACLED
        const acled = await loadJson('acled.json');
        if (acled && acled.data) {
            data.conflicts = acled.data;
            data.critical += data.conflicts.filter(c => c.severity === 'critical').length;
            data.high += data.conflicts.filter(c => c.severity === 'high').length;
            data.medium += data.conflicts.filter(c => c.severity === 'medium').length;
            data.countries = [...new Set(data.conflicts.map(c => c.country || c.location).filter(Boolean))];
        }
    } catch {}

    try {
        // Early Warning
        const warnings = await loadJson('early-warning.json');
        if (warnings && warnings.data) {
            data.warnings = warnings.data;
            data.critical += data.warnings.filter(w => w.severity === 'critical').length;
            data.high += data.warnings.filter(w => w.severity === 'high').length;
            data.medium += data.warnings.filter(w => w.severity === 'medium').length;
        }
    } catch {}

    try {
        // Рынки
        const marketIndicators = ['vix', 'gold-oil-ratio', 'bdi', 'dxy', 'inflation'];
        for (const key of marketIndicators) {
            const file = await loadJson(`${key}.json`);
            if (file && file.data && file.data.length > 0) {
                data.market[key] = file.data[file.data.length - 1].value;
            }
        }
    } catch {}

    return data;
}

async function loadJson(filename) {
    try {
        const content = await fs.readFile(join(BASKET_DIR, filename), 'utf8');
        return JSON.parse(content);
    } catch {
        return null;
    }
}

async function generateSummary(data) {
    try {
        // Пытаемся использовать Ollama
        const prompt = `
Ты — AI-аналитик Crucix. Создай краткую сводку по глобальной ситуации на основе данных:

Критические события: ${data.critical}
Высокие события: ${data.high}
Средние события: ${data.medium}
Всего событий: ${data.critical + data.high + data.medium}

Активные конфликты: ${data.conflicts.length}
Ранние предупреждения: ${data.warnings.length}

Рыночные данные:
- VIX: ${data.market.vix || 'N/A'}
- Gold/Oil: ${data.market['gold-oil-ratio'] || 'N/A'}
- BDI: ${data.market.bdi || 'N/A'}

Напиши краткую сводку (3-5 предложений) на русском языке.
`;

        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'deepseek-r1:1.5b',
                prompt: prompt,
                stream: false,
                options: { temperature: 0.3, max_tokens: 200 }
            })
        });

        const result = await response.json();
        return result.response || null;
    } catch {
        return null;
    }
}

function generateFallbackSummary(data) {
    const total = data.critical + data.high + data.medium;
    let summary = `Глобальная ситуация: ${total} активных событий. `;

    if (data.critical > 0) {
        summary += `Обнаружено ${data.critical} критических событий. `;
    }
    if (data.high > 0) {
        summary += `${data.high} событий высокого уровня. `;
    }
    if (data.conflicts.length > 0) {
        summary += `Активные конфликты: ${data.conflicts.length}. `;
    }
    if (data.warnings.length > 0) {
        summary += `Ранних предупреждений: ${data.warnings.length}. `;
    }

    summary += `Рекомендуется мониторинг.`;

    return summary;
}
