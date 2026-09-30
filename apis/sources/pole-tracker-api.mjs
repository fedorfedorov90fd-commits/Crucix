/**
 * pole-tracker-api.mjs v3.0 — Вычисление геополитической полярности из данных
 *
 * Полный контракт Crucix: route + method + meta + handler
 *
 * Принцип: полюс ВЫЧИСЛЯЕТСЯ из basket-данных, не задаётся списком.
 * Каждая страна получает вектор признаков → классифицируется в полюс.
 *
 * Эндпоинты:
 *   GET /api/layers/pole-tracker             — сводка по всем полюсам
 *   GET /api/layers/pole-tracker?country=ru  — детальный запрос по стране
 *   GET /api/layers/pole-tracker?detail=true — полная выкладка с векторами
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ═══ КОНТРАКТ ═══
export const route = '/api/layers/pole-tracker';
export const method = 'GET';
export const meta = {
    category: 'geopolitical',
    icon: '🌐',
    color: '#4fc3f7',
    vizType: 'map',
    source: 'Crucix basket (ofac, conflicts, internet-outages, military-bases, gdelt, comtrade, social-unrest)',
    collector: null,
    cache: 60,
    description: 'Вычисление геополитической полярности из данных. Полюс не задаётся списком — вычисляется из вектора признаков каждой страны.',
    unit: 'index'
};

// ─── Загрузка конфига ───────────────────────────────────────
function loadCamps() {
    const paths = [
        join(__dirname, 'source-camps.json'),
        join(__dirname, '..', 'source-camps.json')
    ];
    for (const p of paths) {
        if (!existsSync(p)) continue;
        try {
            return JSON.parse(readFileSync(p, 'utf-8'));
        } catch { continue; }
    }
    return null;
}

// ─── Загрузка basket-файла (defensively) ────────────────────
function loadBasket(name) {
    const paths = [
        join(__dirname, '..', '..', 'data', 'basket', name),
        join(__dirname, '..', 'data', 'basket', name),
        join(process.cwd(), 'data', 'basket', name)
    ];
    for (const p of paths) {
        if (!existsSync(p)) continue;
        try {
            const raw = readFileSync(p, 'utf-8');
            const data = JSON.parse(raw);
            return normalizeBasketData(data);
        } catch { continue; }
    }
    return null;
}

function normalizeBasketData(data) {
    if (data === null || data === undefined) return null;
    if (Array.isArray(data)) return data;
    if (typeof data === 'object') {
        if (Array.isArray(data.data)) return data.data;
        if (Array.isArray(data.records)) return data.records;
        if (Array.isArray(data.items)) return data.items;
        if (Array.isArray(data.results)) return data.results;
        if (Array.isArray(data.features)) return data.features;
        return [data];
    }
    return null;
}

// ─── Подсчёт упоминаний страны в данных ─────────────────────
function countMentions(data, country) {
    if (!data || !country) return 0;
    const lower = country.toLowerCase();
    let count = 0;
    for (const item of data) {
        const blob = JSON.stringify(item).toLowerCase();
        if (blob.includes(lower)) count++;
    }
    return count;
}

// ─── Направленные санкции: кто на кого ──────────────────────
function countDirectional(data, fromCountry, toCountry) {
    if (!data || !fromCountry || !toCountry) return 0;
    const from = fromCountry.toLowerCase();
    const to = toCountry.toLowerCase();
    let count = 0;
    for (const item of data) {
        const blob = JSON.stringify(item).toLowerCase();
        if (blob.includes(from) && blob.includes(to)) count++;
    }
    return count;
}

// ─── Список всех стран для анализа ──────────────────────────
function getAllCountries(camps) {
    const set = new Set();
    for (const poleKey of ['russian', 'western', 'non_aligned']) {
        const pole = camps.pole_cores?.[poleKey];
        if (!pole) continue;
        for (const c of (pole.core || [])) set.add(c);
        for (const c of (pole.baseline_satellites || [])) set.add(c);
        for (const c of (pole.affiliated || [])) set.add(c);
    }
    const extra = [
        'china', 'india', 'turkey', 'saudi_arabia', 'uae', 'egypt', 'pakistan',
        'kazakhstan', 'uzbekistan', 'serbia', 'hungary', 'slovakia', 'mexico',
        'argentina', 'nigeria', 'ethiopia', 'algeria', 'morocco', 'vietnam',
        'thailand', 'malaysia', 'philippines', 'bangladesh', 'indonesia',
        'japan', 'south_korea', 'australia', 'canada', 'poland', 'germany',
        'france', 'italy', 'spain', 'netherlands', 'uk', 'usa', 'russia',
        'belarus', 'ukraine', 'iran', 'syria', 'north_korea', 'israel',
        'qatar', 'kuwait', 'oman', 'bahrain', 'jordan', 'lebanon', 'iraq',
        'afghanistan', 'libya', 'sudan', 'yemen', 'somalia', 'kenya',
        'south_africa', 'brazil', 'venezuela', 'cuba', 'nicaragua', 'bolivia',
        'colombia', 'peru', 'chile', 'ecuador'
    ];
    for (const c of extra) set.add(c);
    return [...set];
}

// ─── Вычисление вектора признаков для страны ─────────────────
function computeCountryVector(country, baskets) {
    return {
        sanctions_against: countMentions(baskets.sanctions, country),
        sanctions_by: 0,
        conflicts_involved: countMentions(baskets.conflicts, country),
        internet_outages: countMentions(baskets.internet_outages, country),
        military_bases: countMentions(baskets.military_bases, country),
        gdelt_mentions: countMentions(baskets.gdelt, country),
        trade_links: countMentions(baskets.trade, country),
        unrest_level: countMentions(baskets.unrest, country),
        diplomatic_activity: countMentions(baskets.diplomatic, country),
        un_votes: countMentions(baskets.un_votes, country)
    };
}

// ─── Классификация страны в полюс ───────────────────────────
function classifyCountry(country, vector, camps) {
    const c = country.toLowerCase();

    // Проверяем baseline — входит ли в ядро/сателлиты/affiliated
    for (const poleKey of ['russian', 'western', 'non_aligned']) {
        const pole = camps.pole_cores?.[poleKey];
        if (!pole) continue;
        const all = [
            ...(pole.core || []),
            ...(pole.baseline_satellites || []),
            ...(pole.affiliated || [])
        ].map(x => x.toLowerCase());

        if (all.includes(c)) {
            let confidence = 0.5;
            if (vector.sanctions_against > 0) confidence += 0.15;
            if (vector.conflicts_involved > 0) confidence += 0.1;
            if (vector.gdelt_mentions > 0) confidence += 0.05;
            if (vector.military_bases > 0) confidence += 0.05;
            if (vector.trade_links > 0) confidence += 0.05;
            if (vector.internet_outages > 0) confidence += 0.05;
            confidence = Math.min(confidence, 0.98);

            return {
                pole: poleKey,
                confidence: Math.round(confidence * 100) / 100,
                basis: 'baseline_plus_data',
                vector
            };
        }
    }

    // Data-driven классификация
    let score_russian = 0;
    let score_western = 0;
    let score_non_aligned = 0;

    if (vector.sanctions_against > 0) score_russian += vector.sanctions_against * 0.3;
    if (vector.conflicts_involved > 0) {
        score_russian += 0.1;
        score_western += 0.1;
    }
    if (vector.internet_outages > 0) {
        score_russian += 0.05;
        score_western += 0.05;
    }
    if (vector.military_bases > 0) score_western += 0.15;
    if (vector.trade_links > 0) score_non_aligned += 0.1;
    if (vector.unrest_level > 0) score_non_aligned += 0.05;

    const totalSignals = Object.values(vector).reduce((a, b) => a + b, 0);
    if (totalSignals === 0) {
        return { pole: 'unknown', confidence: 0.1, basis: 'no_data', vector };
    }

    const max = Math.max(score_russian, score_western, score_non_aligned);
    if (max === 0) {
        return { pole: 'non_aligned', confidence: 0.3, basis: 'weak_signals', vector };
    }

    let pole = 'non_aligned';
    if (max === score_russian) pole = 'russian';
    else if (max === score_western) pole = 'western';

    return {
        pole,
        confidence: Math.round(Math.min(max, 0.95) * 100) / 100,
        basis: 'data_driven',
        vector
    };
}

// ─── Индекс полярности (0 = однополярный, 1 = макс) ─────────
function computePolarityIndex(classifications) {
    const total = Object.keys(classifications).length;
    if (total === 0) return 0;

    const counts = { russian: 0, western: 0, non_aligned: 0, unknown: 0 };
    for (const c of Object.values(classifications)) {
        counts[c.pole] = (counts[c.pole] || 0) + 1;
    }

    const polarized = counts.russian + counts.western;
    const ratio = polarized / total;
    const balance = counts.russian > 0 && counts.western > 0
        ? 1 - Math.abs(counts.russian - counts.western) / (counts.russian + counts.western)
        : 0.3;

    return Math.round(ratio * balance * 100) / 100;
}

// ═══ HANDLER ═══
export async function handler(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const camps = loadCamps();

    if (!camps) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
            success: false,
            error: 'source-camps.json not found',
            path: route
        }));
    }

    // Загружаем все basket-файлы по индикаторам
    const indicatorMap = camps.indicators?.basket_files || {};
    const baskets = {};
    const basketStatus = {};

    for (const [key, spec] of Object.entries(indicatorMap)) {
        const files = spec.files || [];
        let loaded = null;
        let sourceFile = null;
        for (const fname of files) {
            const data = loadBasket(fname);
            if (data && data.length > 0) {
                loaded = data;
                sourceFile = fname;
                break;
            }
        }
        baskets[key] = loaded;
        basketStatus[key] = {
            loaded: loaded !== null,
            source_file: sourceFile,
            records: loaded ? loaded.length : 0,
            expected_files: files
        };
    }

    // ?country= — детальный запрос по одной стране
    const countryParam = url.searchParams.get('country');
    if (countryParam) {
        const vec = computeCountryVector(countryParam, baskets);
        const classification = classifyCountry(countryParam, vec, camps);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
            success: true,
            country: countryParam,
            classification,
            basket_status: basketStatus,
            timestamp: new Date().toISOString()
        }, null, 2));
    }

    // Классифицируем все страны
    const countries = getAllCountries(camps);
    const classifications = {};
    for (const country of countries) {
        const vec = computeCountryVector(country, baskets);
        classifications[country] = classifyCountry(country, vec, camps);
    }

    // Группируем по полюсам
    const poles = {
        russian: { countries: [], total: 0 },
        western: { countries: [], total: 0 },
        non_aligned: { countries: [], total: 0 },
        unknown: { countries: [], total: 0 }
    };

    for (const [country, cls] of Object.entries(classifications)) {
        poles[cls.pole].countries.push({
            country,
            confidence: cls.confidence,
            basis: cls.basis
        });
        poles[cls.pole].total++;
    }

    // Сортируем по confidence
    for (const p of Object.values(poles)) {
        p.countries.sort((a, b) => b.confidence - a.confidence);
    }

    const polarityIndex = computePolarityIndex(classifications);

    const vectors = {
        sanctions_flow: baskets.sanctions ? 'detected' : 'no_data',
        info_war: baskets.internet_outages ? 'detected' : 'no_data',
        military_presence: baskets.military_bases ? 'detected' : 'no_data',
        economic_decoupling: baskets.trade ? 'partial_data' : 'no_data',
        diplomatic_activity: baskets.diplomatic ? 'detected' : 'no_data',
        un_voting: baskets.un_votes ? 'detected' : 'no_data'
    };

    const result = {
        timestamp: new Date().toISOString(),
        debate: camps.polarity_debate,
        polarity_index: polarityIndex,
        poles: {
            russian: {
                total: poles.russian.total,
                countries: poles.russian.countries.slice(0, 30),
                narrative_framing: camps.media_sources?.russian?.narrative_framing || '',
                media_sources: camps.media_sources?.russian?.sources || []
            },
            western: {
                total: poles.western.total,
                countries: poles.western.countries.slice(0, 30),
                narrative_framing: camps.media_sources?.western?.narrative_framing || '',
                media_sources: camps.media_sources?.western?.sources || []
            },
            non_aligned: {
                total: poles.non_aligned.total,
                countries: poles.non_aligned.countries.slice(0, 30),
                narrative_framing: camps.media_sources?.non_aligned?.narrative_framing || '',
                media_sources: camps.media_sources?.non_aligned?.sources || []
            },
            unknown: {
                total: poles.unknown.total,
                countries: poles.unknown.countries.slice(0, 20)
            }
        },
        vectors,
        basket_status: basketStatus
    };

    if (url.searchParams.get('detail') === 'true') {
        result.detail = classifications;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: result }, null, 2));
}

// ─── Обратная совместимость со старым loadModule ────────────
export default handler;
