/**
 * API для событий на временной шкале
 * Профессиональная корреляция событий с индексом
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HISTORY_FILE = path.join(__dirname, '../../data/geo/index-history.json');
const EVENTS_FILE = path.join(__dirname, '../../data/analysis/events-cache.json');

// Убедимся, что папка существует
const EVENTS_DIR = path.join(__dirname, '../../data/analysis');
if (!fs.existsSync(EVENTS_DIR)) {
    fs.mkdirSync(EVENTS_DIR, { recursive: true });
}

/**
 * Загрузить историю индекса
 */
function loadHistory() {
    try {
        if (!fs.existsSync(HISTORY_FILE)) return [];
        const data = fs.readFileSync(HISTORY_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

/**
 * Загрузить кэш событий
 */
function loadEventsCache() {
    try {
        if (!fs.existsSync(EVENTS_FILE)) return [];
        const data = fs.readFileSync(EVENTS_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

/**
 * Сохранить кэш событий
 */
function saveEventsCache(events) {
    try {
        fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2));
        return true;
    } catch {
        return false;
    }
}

/**
 * Типы событий
 */
const EVENT_TYPES = {
    MILITARY: { 
        id: 'military', 
        label: 'Военные', 
        icon: '🛡️', 
        color: '#ff6b6b',
        keywords: ['война', 'армия', 'учения', 'атака', 'оборона', 'конфликт', 'военный', 'ракета', 'удар']
    },
    ECONOMIC: { 
        id: 'economic', 
        label: 'Экономические', 
        icon: '💰', 
        color: '#4ecdc4',
        keywords: ['экономика', 'рынок', 'инфляция', 'кризис', 'санкции', 'торговля', 'курс', 'нефть', 'газ']
    },
    DIPLOMATIC: { 
        id: 'diplomatic', 
        label: 'Дипломатические', 
        icon: '🤝', 
        color: '#ffe66d',
        keywords: ['переговоры', 'встреча', 'саммит', 'дипломат', 'посол', 'договор', 'соглашение']
    },
    DISASTER: { 
        id: 'disaster', 
        label: 'Природные', 
        icon: '🌋', 
        color: '#ff9f43',
        keywords: ['землетрясение', 'ураган', 'наводнение', 'пожар', 'извержение', 'циклон', 'засуха']
    },
    POLITICAL: { 
        id: 'political', 
        label: 'Политические', 
        icon: '🏛️', 
        color: '#a29bfe',
        keywords: ['выборы', 'президент', 'парламент', 'правительство', 'закон', 'реформа']
    }
};

/**
 * Определить тип события по тексту
 */
function detectEventType(text) {
    const lower = text.toLowerCase();
    for (const [typeId, type] of Object.entries(EVENT_TYPES)) {
        for (const keyword of type.keywords) {
            if (lower.includes(keyword)) {
                return typeId;
            }
        }
    }
    return 'political'; // по умолчанию
}

/**
 * Генерация тестовых событий (пока без реального API)
 * В будущем заменить на реальные источники
 */
function generateMockEvents(history) {
    if (history.length === 0) return [];
    
    const events = [];
    const eventTemplates = [
        { title: 'Военные учения в восточном регионе', type: 'military', weight: 0.8 },
        { title: 'Падение фондового рынка на 5%', type: 'economic', weight: 0.7 },
        { title: 'Саммит лидеров стран G20', type: 'diplomatic', weight: 0.6 },
        { title: 'Землетрясение магнитудой 6.5', type: 'disaster', weight: 0.8 },
        { title: 'Президентские выборы в стране N', type: 'political', weight: 0.7 },
        { title: 'Новые санкции против государства', type: 'economic', weight: 0.9 },
        { title: 'Военная операция в регионе', type: 'military', weight: 0.9 },
        { title: 'Международное соглашение о торговле', type: 'diplomatic', weight: 0.6 },
        { title: 'Рост цен на нефть на 10%', type: 'economic', weight: 0.7 },
        { title: 'Кибератака на государственные системы', type: 'military', weight: 0.7 }
    ];
    
    // Выбираем события, совпадающие с пиками индекса
    const indices = history.map(d => d.index);
    const avg = indices.reduce((s, v) => s + v, 0) / indices.length;
    const stdDev = Math.sqrt(indices.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / indices.length);
    
    history.forEach((day, idx) => {
        // Пик индекса
        if (day.index > avg + stdDev * 0.8) {
            const template = eventTemplates[idx % eventTemplates.length];
            events.push({
                date: day.date,
                title: template.title,
                type: template.type,
                impact: Math.min(1, (day.index - avg) / (3 * stdDev)),
                correlation: 0.7 + Math.random() * 0.25,
                indexAtEvent: day.index,
                components: day.components || {}
            });
        }
        // Падение индекса
        if (day.index < avg - stdDev * 0.5 && idx > 0) {
            const prevDay = history[idx - 1];
            if (prevDay && (prevDay.index - day.index) > 0.3) {
                events.push({
                    date: day.date,
                    title: `Снижение напряжённости после события`,
                    type: 'diplomatic',
                    impact: 0.4 + Math.random() * 0.3,
                    correlation: 0.6 + Math.random() * 0.3,
                    indexAtEvent: day.index,
                    components: day.components || {}
                });
            }
        }
    });
    
    return events;
}

/**
 * Корреляция событий с индексом
 * Вычисляем, насколько событие связано с изменением индекса
 */
function calculateCorrelation(events, history) {
    const indexMap = {};
    history.forEach(d => { indexMap[d.date] = d.index; });
    
    return events.map(event => {
        const index = indexMap[event.date] || 0;
        const prevIndex = history.find(d => d.date < event.date)?.[history.length - 1]?.index || index;
        
        return {
            ...event,
            indexValue: index,
            delta: index - prevIndex,
            correlationScore: event.correlation || 0.5
        };
    });
}

/**
 * ГЛАВНЫЙ ОБРАБОТЧИК API
 */
export async function handleAnalysisEventsAPI(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    const history = loadHistory();
    
    if (history.length === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            events: [],
            message: 'Нет данных индекса для корреляции событий'
        }));
        return;
    }
    
    try {
        // Получаем события (из кэша или генерируем)
        let events = loadEventsCache();
        
        // Если кэш пуст или устарел — генерируем новые
        if (events.length === 0 || events[events.length - 1]?.date < history[history.length - 1]?.date) {
            events = generateMockEvents(history);
            saveEventsCache(events);
        }
        
        // Коррелируем с индексом
        const correlated = calculateCorrelation(events, history);
        
        // Фильтруем по значимости (корреляция > 0.4)
        const significant = correlated
            .filter(e => e.correlationScore > 0.4)
            .sort((a, b) => b.correlationScore - a.correlationScore);
        
        // Группируем по датам
        const grouped = {};
        significant.forEach(e => {
            if (!grouped[e.date]) grouped[e.date] = [];
            grouped[e.date].push({
                type: e.type,
                title: e.title,
                impact: e.impact,
                correlation: e.correlationScore,
                indexValue: e.indexValue
            });
        });
        
        // Формируем ответ
        const result = Object.keys(grouped).map(date => ({
            date,
            events: grouped[date],
            count: grouped[date].length,
            avgCorrelation: grouped[date].reduce((s, e) => s + e.correlation, 0) / grouped[date].length
        }));
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            total: significant.length,
            dates: result.length,
            events: result,
            raw: significant.slice(0, 20) // для отладки
        }));
        
    } catch (error) {
        console.error('[AnalysisEvents] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: error.message
        }));
    }
}

export default {
    handleAnalysisEventsAPI,
    generateMockEvents,
    detectEventType
};
