/**
 * narrative-splitter-api.mjs v1.0.0 — Сверить нарративы по полюсам
 *
 * Читает data/basket/rsshub.json (500 items, 36 источников).
 * Группирует источники по полюсам (russian / western / non_aligned) из source-camps.json.
 * Фильтрует по ?topic= через префикс (например, «санкции» → prefix «санкци»).
 * Сортирует claims внутри полюса по pubDate descending (свежие наверху).
 * Формирует точки расхождений, timeline, stats.
 *
 * Эндпоинты:
 *   GET /api/layers/narrative-splitter?topic=санкции
 *   GET /api/layers/narrative-splitter?topic=Украина&limit=10
 *   GET /api/layers/narrative-splitter?detail=true
 *   GET /api/layers/narrative-splitter?format=csv
 *   GET /api/layers/narrative-splitter?format=stats
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ═══ КОНТРАКТ ═══
export const route = '/api/layers/narrative-splitter';
export const method = 'GET';
export const meta = {
    category: 'semantic',
    icon: '⚡',
    color: '#ff9800',
    vizType: 'comparison',
    source: 'data/basket/rsshub.json (36 источников, 500 items)',
    collector: 'collect-rsshub.mjs',
    cache: 120,
    description: 'Сверить российский и западный нарративы по теме. Расхождения, замалчивания, двойные стандарты.',
    unit: 'claims'
};

// ─── Маппинг источников на полюса (подстрока lowercase) ───
const POLE_MAP = {
    russian: [
        'tass', 'тасс', 'ria', 'риа', 'interfax', 'интерфакс',
        'lenta', 'лента', 'kommersant', 'коммерсант', 'izvestia', 'известия',
        'vz', 'взгляд', 'kp', 'комсомольская', 'rg', 'российская газета',
        '1prime', 'rt', 'sputnik', 'спутник', 'правда', 'звезда', 'телеканал',
        'rbc', 'рбк', 'gazeta', 'газета', 'forbes', 'форбс'
    ],
    western: [
        'guardian', 'nyt', 'bbc', 'reuters', 'ap', 'politico',
        'dw', 'france24', 'le monde', 'der spiegel', 'wsj', 'washington post',
        'cnn', 'abc', 'nbc', 'cbs', 'bloomberg', 'financial times', 'ft',
        'economist', 'the times', 'telegraph'
    ],
    non_aligned: [
        'aljazeera', 'al jazeera', 'straits times', 'xinhua', 'anadolu',
        'hindustan', 'scmp', 'japan times', 'times of india', 'the hindu',
        'global times', 'arab news', 'gulf news', 'middle east eye'
    ]
};

function detectPole(source) {
    if (!source) return 'unknown';
    const s = source.toLowerCase();
    for (const [pole, keys] of Object.entries(POLE_MAP)) {
        for (const k of keys) {
            if (s.includes(k)) return pole;
        }
    }
    return 'unknown';
}

// ─── Загрузка basket ───
function loadBasket(name) {
    const paths = [
        join(__dirname, '..', '..', 'data', 'basket', name),
        join(__dirname, '..', 'data', 'basket', name),
        join(process.cwd(), 'data', 'basket', name)
    ];
    for (const p of paths) {
        if (!existsSync(p)) continue;
        try {
            return JSON.parse(readFileSync(p, 'utf-8'));
        } catch { continue; }
    }
    return null;
}

// ─── Нормализация: массив / объект с items / объект с data ───
function extractItems(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw.items)) return raw.items;
    if (Array.isArray(raw.data)) return raw.data;
    if (Array.isArray(raw.features)) return raw.features;
    if (Array.isArray(raw.documents)) return raw.documents;
    if (Array.isArray(raw.records)) return raw.records;
    return [];
}

// ─── Вспомогательная функция: разэкранирование HTML-entities ───
function decodeHtmlEntities(s) {
    if (!s) return '';
    return String(s)
        .replace(/&quot;/g, '"')
        .replace(/&#34;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#([0-9]+);/g, (m, code) => String.fromCharCode(parseInt(code, 10)))
        .replace(/&#x([0-9a-f]+);/gi, (m, code) => String.fromCharCode(parseInt(code, 16)));
}

// ─── Вспомогательная функция: снятие CDATA-обёртки ───
function stripCdata(s) {
    if (!s) return '';
    let out = String(s).trim();
    out = out.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
    return out.trim();
}

// ─── Нормализация одного item ───
function normalizeItem(item) {
    if (!item || typeof item !== 'object') return null;

    let title = String(item.title || item.name || item.headline || item.label || '').trim();
    title = stripCdata(title);
    title = decodeHtmlEntities(title);
    title = title.replace(/\s+/g, ' ').trim();
    if (!title || title.length < 8) return null;

    // Пропускаем записи с битой кодировкой (replacement char)
    if (/[\uFFFD]/.test(title)) return null;

    // Пропускаем записи, где больше половины символов — нечитаемые
    const printable = title.replace(/[^\x20-\x7E\u0400-\u04FF]/g, '');
    if (printable.length < title.length * 0.5) return null;

    let source = String(item.source || item.feed || item.origin || item.publisher || '').trim();
    source = decodeHtmlEntities(source);

    let link = String(item.link || item.url || item.href || '').trim();
    link = stripCdata(link);

    const dateRaw = item.pubDate || item.published || item.timestamp || item.date || item.collectedAt || '';
    let date = null;
    try {
        if (dateRaw) {
            const d = new Date(dateRaw);
            if (!isNaN(d.getTime())) date = d.toISOString();
        }
    } catch { date = null; }

    const region = String(item.region || item.country || '').trim();
    const category = String(item.category || '').trim();

    return { title, source, link, date, dateRaw, region, category };
}

// ─── Подготовка темы: разбить на слова и обрезать окончания ───
function prepareTopicTerms(topic) {
    if (!topic) return [];
    const cleaned = topic.toLowerCase().trim().replace(/[^а-яёa-z0-9\s-]/gi, ' ');
    const words = cleaned.split(/\s+/).filter(function(w) { return w.length >= 3; });
    return words.map(function(w) {
        if (w.length > 4) {
            const last = w.slice(-1);
            if (/[аеёиоуыэюя]/i.test(last)) {
                return w.slice(0, -1);
            }
        }
        return w;
    });
}

// ─── Фильтр по теме: regex с границей слова + AND по всем словам ───
function matchesTopic(title, terms) {
    if (!terms || terms.length === 0) return true;
    const t = title.toLowerCase();
    for (let i = 0; i < terms.length; i++) {
        const term = terms[i];
        const re = new RegExp('(^|[^а-яёa-z])' + term + '[а-яёa-z]*', 'i');
        if (!re.test(t)) return false;
    }
    return true;
}

// ─── Формирование нарратива по полюсу ───
function buildNarrative(poleKey, items, topic, limit) {
    const sorted = items.slice().sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return db - da;
    });
    const claims = sorted.slice(0, limit).map(it => ({
        text: it.title,
        source: it.source,
        link: it.link,
        date: it.date,
        region: it.region
    }));

    const labels = {
        russian: 'Российский нарратив',
        western: 'Западный нарратив',
        non_aligned: 'Неприсоединившиеся'
    };

    // Уникальные источники
    const sources = [...new Set(items.map(it => it.source).filter(Boolean))];

    return {
        framing: `${labels[poleKey]} по теме «${topic}»`,
        count: items.length,
        sources_count: sources.length,
        sources: sources.slice(0, 15),
        claims
    };
}

// ─── Формирование точек расхождений ───
function buildWeldingPoints(russian, western, topic) {
    const welds = [];

    if (russian.length === 0 && western.length > 0) {
        welds.push({
            type: 'silence',
            severity: 'high',
            description: `Российские источники не освещают тему «${topic}» (0 упоминаний), западные — ${western.length} упоминаний`,
            evidence: `western: ${western.slice(0, 3).map(x => x.source).join(', ')}`
        });
    } else if (western.length === 0 && russian.length > 0) {
        welds.push({
            type: 'silence',
            severity: 'high',
            description: `Западные источники не освещают тему «${topic}» (0 упоминаний), российские — ${russian.length} упоминаний`,
            evidence: `russian: ${russian.slice(0, 3).map(x => x.source).join(', ')}`
        });
    } else if (russian.length > 0 && western.length > 0) {
        welds.push({
            type: 'framing_gap',
            severity: 'medium',
            description: `Тема «${topic}» освещается обеими сторонами: ${russian.length} российских vs ${western.length} западных упоминаний`,
            evidence: `russian: ${russian.slice(0, 2).map(x => x.source).join(', ')} | western: ${western.slice(0, 2).map(x => x.source).join(', ')}`
        });

        // Проверка на баланс
        const ratio = russian.length / (western.length || 1);
        if (ratio > 3 || ratio < 0.33) {
            welds.push({
                type: 'double_standard',
                severity: 'medium',
                description: `Дисбаланс освещения: ${ratio.toFixed(2)}x — одна сторона освещает тему существенно активнее`,
                evidence: `russian: ${russian.length}, western: ${western.length}`
            });
        }
    }

    return welds;
}

// ─── Timeline ───
function buildTimeline(russian, western, limit) {
    const all = [
        ...russian.map(it => ({ ...it, pole: 'russian' })),
        ...western.map(it => ({ ...it, pole: 'western' }))
    ];
    all.sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return db - da;
    });
    return all.slice(0, limit).map(it => ({
        date: it.date,
        event: it.title,
        source: it.source,
        pole: it.pole
    }));
}

// ═══ HANDLER ═══
export async function handler(req, res) {
    try {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const topic = url.searchParams.get('topic') || '';
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '15', 10) || 15, 50);
        const detail = url.searchParams.get('detail') === 'true';
        const format = (url.searchParams.get('format') || 'json').toLowerCase();

        // Основной источник
        let raw = loadBasket('rsshub.json');
        let sourceFile = 'rsshub.json';
        if (!raw || extractItems(raw).length === 0) {
            const alt = loadBasket('gdelt_news.json');
            if (alt && extractItems(alt).length > 0) {
                raw = alt;
                sourceFile = 'gdelt_news.json';
            }
        }
        if (!raw) {
            res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({
                success: false,
                error: 'no_data',
                message: 'Не найден ни rsshub.json, ни gdelt_news.json в data/basket/'
            }));
        }

        const items = extractItems(raw);
        const normalized = items.map(normalizeItem).filter(Boolean);

        // Фильтр по теме
        const terms = prepareTopicTerms(topic);
        const filtered = topic
            ? normalized.filter(it => matchesTopic(it.title, terms))
            : normalized;

        // Разбивка по полюсам
        const russian = [];
        const western = [];
        const nonAligned = [];
        for (const it of filtered) {
            const pole = detectPole(it.source);
            if (pole === 'russian') russian.push(it);
            else if (pole === 'western') western.push(it);
            else if (pole === 'non_aligned') nonAligned.push(it);
        }

        const russianNarrative = buildNarrative('russian', russian, topic, limit);
        const westernNarrative = buildNarrative('western', western, topic, limit);
        const nonAlignedNarrative = buildNarrative('non_aligned', nonAligned, topic, Math.min(limit, 5));
        const weldingPoints = buildWeldingPoints(russian, western, topic);
        const timeline = buildTimeline(russian, western, limit);

        const stats = {
            total_scanned: normalized.length,
            topic_matches: filtered.length,
            russian_count: russian.length,
            western_count: western.length,
            non_aligned_count: nonAligned.length,
            unknown_count: filtered.length - russian.length - western.length - nonAligned.length
        };

        // CSV формат
        if (format === 'csv') {
            const lines = ['pole,title,source,date,link'];
            for (const it of [...russian, ...western, ...nonAligned]) {
                const pole = detectPole(it.source);
                const safeTitle = it.title.replace(/"/g, '""');
                const safeSource = it.source.replace(/"/g, '""');
                lines.push(`${pole},"${safeTitle}","${safeSource}",${it.date || ''},${it.link || ''}`);
            }
            res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8' });
            return res.end(lines.join('\n'));
        }

        // Stats формат
        if (format === 'stats') {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: true, data: { topic, stats, topic_prefix: terms.join("|") } }, null, 2));
        }

        // JSON (по умолчанию)
        const result = {
            topic: topic || '(все темы)',
            topic_prefix: terms.join("|"),
            scanned_at: new Date().toISOString(),
            source_file: sourceFile,
            stats,
            russian_narrative: russianNarrative,
            western_narrative: westernNarrative,
            non_aligned_narrative: nonAlignedNarrative,
            welding_points: weldingPoints,
            timeline
        };

        if (detail) {
            result.russian_items = russian.map(it => ({ title: it.title, source: it.source, date: it.date, link: it.link }));
            result.western_items = western.map(it => ({ title: it.title, source: it.source, date: it.date, link: it.link }));
            result.non_aligned_items = nonAligned.map(it => ({ title: it.title, source: it.source, date: it.date, link: it.link }));
        }

        res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': `public, max-age=${meta.cache}`,
            'X-Module': 'narrative-splitter-api',
            'X-Module-Version': '1.0.0'
        });
        res.end(JSON.stringify({ success: true, data: result }, null, 2));

    } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: 'handler_error', message: e.message }));
    }
}
