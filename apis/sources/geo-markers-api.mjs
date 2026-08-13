#!/usr/bin/env node

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'raw');
const STATUS_FILE = join(ROOT, 'data', 'geo', 'country-status.json');
const COORDS_FILE = join(ROOT, 'data', 'geo', 'country-coords.json');

let countryCoords = {};

async function loadCountryCoords() {
    try {
        const content = await fs.readFile(COORDS_FILE, 'utf-8');
        countryCoords = JSON.parse(content);
        console.log('📌 Загружено координат стран:', Object.keys(countryCoords).length);
        return countryCoords;
    } catch (e) {
        console.error('❌ Ошибка загрузки координат:', e.message);
        return {};
    }
}

// ======== ВСЕ СТРАНЫ СО СТАТУСАМИ ========
const COUNTRIES = {
    // ===== КРИТИЧЕСКИЕ (ВОЙНА) =====
    'ukraine': { name: 'Украина', status: 'critical' },
    'syria': { name: 'Сирия', status: 'critical' },
    'yemen': { name: 'Йемен', status: 'critical' },
    'palestine': { name: 'Палестина', status: 'critical' },
    'sudan': { name: 'Судан', status: 'critical' },
    'north-korea': { name: 'Северная Корея', status: 'critical' },
    'israel': { name: 'Израиль', status: 'critical' },
    'iran': { name: 'Иран', status: 'critical' },
    'south-sudan': { name: 'Южный Судан', status: 'critical' },
    'somali': { name: 'Сомали', status: 'critical' },
    'ethiopia': { name: 'Эфиопия', status: 'critical' },
    'myanmar': { name: 'Мьянма', status: 'critical' },
    'afghanistan': { name: 'Афганистан', status: 'critical' },
    'iraq': { name: 'Ирак', status: 'critical' },
    'lebanon': { name: 'Ливан', status: 'critical' },
    'libya': { name: 'Ливия', status: 'critical' },
    'mali': { name: 'Мали', status: 'critical' },
    'niger': { name: 'Нигер', status: 'critical' },
    'congo': { name: 'Конго', status: 'critical' },
    'car': { name: 'ЦАР', status: 'critical' },

    // ===== ВЫСОКИЕ (ПОДГОТОВКА) =====
    'russia': { name: 'Россия', status: 'high' },
    'pakistan': { name: 'Пакистан', status: 'high' },
    'mexico': { name: 'Мексика', status: 'high' },
    'turkey': { name: 'Турция', status: 'high' },
    'japan': { name: 'Япония', status: 'high' },
    'south-korea': { name: 'Южная Корея', status: 'high' },
    'poland': { name: 'Польша', status: 'high' },
    'armenia': { name: 'Армения', status: 'high' },
    'azerbaijan': { name: 'Азербайджан', status: 'high' },
    'colombia': { name: 'Колумбия', status: 'high' },
    'venezuela': { name: 'Венесуэла', status: 'high' },
    'belarus': { name: 'Беларусь', status: 'high' },
    'serbia': { name: 'Сербия', status: 'high' },
    'kosovo': { name: 'Косово', status: 'high' },
    'bosnia': { name: 'Босния', status: 'high' },
    'georgia': { name: 'Грузия', status: 'high' },
    'moldova': { name: 'Молдова', status: 'high' },
    'kazakhstan': { name: 'Казахстан', status: 'high' },
    'kyrgyzstan': { name: 'Кыргызстан', status: 'high' },
    'tajikistan': { name: 'Таджикистан', status: 'high' },
    'turkmenistan': { name: 'Туркменистан', status: 'high' },
    'uzbekistan': { name: 'Узбекистан', status: 'high' },
    'mongolia': { name: 'Монголия', status: 'high' },
    'nepal': { name: 'Непал', status: 'high' },
    'bangladesh': { name: 'Бангладеш', status: 'high' },
    'sri-lanka': { name: 'Шри-Ланка', status: 'high' },
    'cambodia': { name: 'Камбоджа', status: 'high' },
    'laos': { name: 'Лаос', status: 'high' },
    'philippines': { name: 'Филиппины', status: 'high' },
    'indonesia': { name: 'Индонезия', status: 'high' },
    'malaysia': { name: 'Малайзия', status: 'high' },
    'thailand': { name: 'Таиланд', status: 'high' },
    'vietnam': { name: 'Вьетнам', status: 'high' },
    'egypt': { name: 'Египет', status: 'high' },
    'algeria': { name: 'Алжир', status: 'high' },
    'morocco': { name: 'Марокко', status: 'high' },
    'tunisia': { name: 'Тунис', status: 'high' },
    'mauritania': { name: 'Мавритания', status: 'high' },
    'senegal': { name: 'Сенегал', status: 'high' },
    'guinea': { name: 'Гвинея', status: 'high' },
    'burkina': { name: 'Буркина-Фасо', status: 'high' },
    'benin': { name: 'Бенин', status: 'high' },
    'togo': { name: 'Того', status: 'high' },
    'ghana': { name: 'Гана', status: 'high' },
    'ivory-coast': { name: 'Кот-д\'Ивуар', status: 'high' },
    'liberia': { name: 'Либерия', status: 'high' },
    'sierra-leone': { name: 'Сьерра-Леоне', status: 'high' },
    'guinea-bissau': { name: 'Гвинея-Бисау', status: 'high' },
    'gambia': { name: 'Гамбия', status: 'high' },
    'chad': { name: 'Чад', status: 'high' },
    'cameroon': { name: 'Камерун', status: 'high' },
    'nigeria': { name: 'Нигерия', status: 'high' },
    'angola': { name: 'Ангола', status: 'high' },
    'mozambique': { name: 'Мозамбик', status: 'high' },
    'zimbabwe': { name: 'Зимбабве', status: 'high' },
    'zambia': { name: 'Замбия', status: 'high' },
    'malawi': { name: 'Малави', status: 'high' },
    'madagascar': { name: 'Мадагаскар', status: 'high' },
    'kenya': { name: 'Кения', status: 'high' },
    'tanzania': { name: 'Танзания', status: 'high' },
    'uganda': { name: 'Уганда', status: 'high' },
    'rwanda': { name: 'Руанда', status: 'high' },
    'burundi': { name: 'Бурунди', status: 'high' },
    'djibouti': { name: 'Джибути', status: 'high' },
    'eritrea': { name: 'Эритрея', status: 'high' },
    'south-africa': { name: 'Южная Африка', status: 'high' },
    'namibia': { name: 'Намибия', status: 'high' },
    'botswana': { name: 'Ботсвана', status: 'high' },
    'lesotho': { name: 'Лесото', status: 'high' },
    'eswatini': { name: 'Эсватини', status: 'high' },
    'mauritius': { name: 'Маврикий', status: 'high' },
    'comoros': { name: 'Коморы', status: 'high' },
    'bahrain': { name: 'Бахрейн', status: 'high' },
    'kuwait': { name: 'Кувейт', status: 'high' },
    'oman': { name: 'Оман', status: 'high' },
    'qatar': { name: 'Катар', status: 'high' },
    'uae': { name: 'ОАЭ', status: 'high' },
    'jordan': { name: 'Иордания', status: 'high' },
    'saudi': { name: 'Саудовская Аравия', status: 'high' },

    // ===== СРЕДНИЕ (НАПРЯЖЕНИЕ) =====
    'china': { name: 'Китай', status: 'medium' },
    'india': { name: 'Индия', status: 'medium' },
    'brazil': { name: 'Бразилия', status: 'medium' },
    'argentina': { name: 'Аргентина', status: 'medium' },
    'chile': { name: 'Чили', status: 'medium' },
    'peru': { name: 'Перу', status: 'medium' },
    'ecuador': { name: 'Эквадор', status: 'medium' },
    'bolivia': { name: 'Боливия', status: 'medium' },
    'paraguay': { name: 'Парагвай', status: 'medium' },
    'uruguay': { name: 'Уругвай', status: 'medium' },
    'guyana': { name: 'Гайана', status: 'medium' },
    'suriname': { name: 'Суринам', status: 'medium' },
    'trinidad': { name: 'Тринидад', status: 'medium' },
    'jamaica': { name: 'Ямайка', status: 'medium' },
    'bahamas': { name: 'Багамы', status: 'medium' },
    'barbados': { name: 'Барбадос', status: 'medium' },
    'belize': { name: 'Белиз', status: 'medium' },
    'costa-rica': { name: 'Коста-Рика', status: 'medium' },
    'el-salvador': { name: 'Сальвадор', status: 'medium' },
    'guatemala': { name: 'Гватемала', status: 'medium' },
    'honduras': { name: 'Гондурас', status: 'medium' },
    'nicaragua': { name: 'Никарагуа', status: 'medium' },
    'panama': { name: 'Панама', status: 'medium' },
    'dominican': { name: 'Доминикана', status: 'medium' },
    'haiti': { name: 'Гаити', status: 'medium' },
    'cuba': { name: 'Куба', status: 'medium' },
    'uk': { name: 'Великобритания', status: 'medium' },
    'france': { name: 'Франция', status: 'medium' },
    'germany': { name: 'Германия', status: 'medium' },
    'italy': { name: 'Италия', status: 'medium' },
    'spain': { name: 'Испания', status: 'medium' },
    'portugal': { name: 'Португалия', status: 'medium' },
    'netherlands': { name: 'Нидерланды', status: 'medium' },
    'belgium': { name: 'Бельгия', status: 'medium' },
    'luxembourg': { name: 'Люксембург', status: 'medium' },
    'switzerland': { name: 'Швейцария', status: 'medium' },
    'austria': { name: 'Австрия', status: 'medium' },
    'sweden': { name: 'Швеция', status: 'medium' },
    'norway': { name: 'Норвегия', status: 'medium' },
    'denmark': { name: 'Дания', status: 'medium' },
    'finland': { name: 'Финляндия', status: 'medium' },
    'iceland': { name: 'Исландия', status: 'medium' },
    'ireland': { name: 'Ирландия', status: 'medium' },
    'greece': { name: 'Греция', status: 'medium' },
    'bulgaria': { name: 'Болгария', status: 'medium' },
    'romania': { name: 'Румыния', status: 'medium' },
    'hungary': { name: 'Венгрия', status: 'medium' },
    'czech': { name: 'Чехия', status: 'medium' },
    'slovakia': { name: 'Словакия', status: 'medium' },
    'slovenia': { name: 'Словения', status: 'medium' },
    'croatia': { name: 'Хорватия', status: 'medium' },
    'montenegro': { name: 'Черногория', status: 'medium' },
    'albania': { name: 'Алба尼亚', status: 'medium' },
    'north-macedonia': { name: 'Северная Македония', status: 'medium' },
    'bosnia': { name: 'Босния', status: 'medium' },
    'lithuania': { name: 'Литва', status: 'medium' },
    'latvia': { name: 'Латвия', status: 'medium' },
    'estonia': { name: 'Эстония', status: 'medium' },
    'cyprus': { name: 'Кипр', status: 'medium' },
    'malta': { name: 'Мальта', status: 'medium' },
    'monaco': { name: 'Монако', status: 'medium' },
    'liechtenstein': { name: 'Лихтенштейн', status: 'medium' },
    'andorra': { name: 'Андорра', status: 'medium' },
    'san-marino': { name: 'Сан-Марино', status: 'medium' },
    'vatican': { name: 'Ватикан', status: 'medium' },

    // ===== НОРМАЛЬНЫЕ (СПОКОЙНЫЕ) =====
    'us': { name: 'США', status: 'normal' },
    'canada': { name: 'Канада', status: 'normal' },
    'australia': { name: 'Австралия', status: 'normal' },
    'new-zealand': { name: 'Новая Зеландия', status: 'normal' },
    'singapore': { name: 'Сингапур', status: 'normal' },
    'brunei': { name: 'Бруней', status: 'normal' },
    'taiwan': { name: 'Тайвань', status: 'normal' },
    'papua': { name: 'Папуа', status: 'normal' },
    'fiji': { name: 'Фиджи', status: 'normal' },
    'solomon': { name: 'Соломоны', status: 'normal' },
    'vanuatu': { name: 'Вануату', status: 'normal' },
    'timor-leste': { name: 'Тимор', status: 'normal' },
    'maldives': { name: 'Мальдивы', status: 'normal' },
    'cape-verde': { name: 'Кабо-Верде', status: 'normal' },
    'sao-tome': { name: 'Сан-Томе', status: 'normal' },
    'seychelles': { name: 'Сейшелы', status: 'normal' },
    'palau': { name: 'Палау', status: 'normal' },
    'micronesia': { name: 'Микронезия', status: 'normal' },
    'marshall': { name: 'Маршаллы', status: 'normal' },
    'kiribati': { name: 'Кирибати', status: 'normal' },
    'tuvalu': { name: 'Тувалу', status: 'normal' },
    'nauru': { name: 'Науру', status: 'normal' },
    'tonga': { name: 'Тонга', status: 'normal' },
    'samoa': { name: 'Самоа', status: 'normal' },
};

function getStatusColor(status) {
    const colors = {
        'critical': '#ef4444',
        'high': '#f97316',
        'medium': '#eab308',
        'normal': '#22c55e'
    };
    return colors[status] || '#666';
}

function getCountryCoords(countryId) {
    const coords = countryCoords[countryId];
    if (coords) {
        const offset = 0.5;
        return {
            lat: coords.lat + (Math.random() - 0.5) * offset * 2,
            lng: coords.lng + (Math.random() - 0.5) * offset * 2,
            name: coords.name || countryId
        };
    }
    return { lat: 20 + (Math.random() - 0.5) * 10, lng: (Math.random() - 0.5) * 20, name: 'Мир' };
}

export async function handleGeoMarkersAPI(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    await loadCountryCoords();

    if (pathname === '/api/geo/status' && req.method === 'GET') {
        try {
            const result = Object.entries(COUNTRIES).map(([id, data]) => {
                const coords = getCountryCoords(id);
                return {
                    id: id,
                    name: data.name || id,
                    status: data.status || 'normal',
                    color: getStatusColor(data.status),
                    lat: coords.lat,
                    lng: coords.lng
                };
            });

            console.log('🌍 Статусы стран:', result.length);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                total: result.length,
                countries: result
            }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: e.message }));
        }
        return;
    }

    if (pathname === '/api/geo/markers' && req.method === 'GET') {
        try {
            // Генерируем демо-маркеры для показа
            const demoMarkers = [];
            const countries = Object.keys(COUNTRIES);
            const titles = [
                'Военные учения', 'Дипломатические переговоры', 'Экономический саммит',
                'Гуманитарная помощь', 'Политический кризис', 'Торговое соглашение',
                'Экологическая инициатива', 'Кибератака', 'Террористическая угроза',
                'Стихийное бедствие', 'Массовые протесты', 'Инфраструктурный проект',
                'Космическая программа', 'Ядерная программа', 'Энергетический кризис'
            ];
            const sources = ['Reuters', 'AP', 'BBC', 'Al Jazeera', 'TASS', 'France 24', 'CNN', 'Bloomberg'];

            for (let i = 0; i < 30; i++) {
                const countryId = countries[i % countries.length];
                const coords = getCountryCoords(countryId);
                const score = Math.floor(Math.random() * 10);
                const title = titles[i % titles.length] + ' в ' + (COUNTRIES[countryId]?.name || countryId);
                const source = sources[i % sources.length];

                demoMarkers.push({
                    id: 'demo-' + i,
                    lat: coords.lat,
                    lng: coords.lng,
                    countryId: countryId,
                    countryName: COUNTRIES[countryId]?.name || countryId,
                    title: title,
                    source: source,
                    score: score,
                    scoreClass: score >= 8 ? 'critical' : score >= 5 ? 'important' : 'normal',
                    color: score >= 8 ? '#ef4444' : score >= 5 ? '#f97316' : '#22c55e',
                    url: '#',
                    summary: 'Новость из источника ' + source + '. Нажмите для подробностей.',
                    date: new Date().toISOString()
                });
            }

            console.log('📌 Возвращаю маркеры:', demoMarkers.length);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                total: demoMarkers.length,
                markers: demoMarkers
            }));
        } catch (e) {
            console.error('❌ Ошибка:', e);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: e.message }));
        }
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));
}
