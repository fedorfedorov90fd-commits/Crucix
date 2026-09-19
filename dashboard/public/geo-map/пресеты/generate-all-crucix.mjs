#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const OUT_DIR = './crucix-data';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ============================================================
//  УТИЛИТЫ
// ============================================================
function rnd(min, max) { return Math.random() * (max - min) + min; }
function rndInt(min, max) { return Math.floor(rnd(min, max + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN(arr, n) { return [...arr].sort(() => Math.random() - 0.5).slice(0, n); }
function ts(minutesAgo = 180) {
    return new Date(Date.now() - rndInt(0, minutesAgo) * 60000).toISOString();
}
function save(filename, features) {
    const geojson = { type: 'FeatureCollection', features };
    fs.writeFileSync(path.join(OUT_DIR, filename), JSON.stringify(geojson, null, 2), 'utf-8');
    console.log(`  ✅ ${filename}: ${features.length} объектов`);
}
function pt(lon, lat, props) {
    return { type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: { timestamp: ts(), ...props } };
}
function line(coords, props) {
    return { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: { timestamp: ts(), ...props } };
}
function poly(coords, props) {
    return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: { timestamp: ts(), ...props } };
}

// ============================================================
//  БАЗОВЫЕ ДАННЫЕ — города, страны, координаты
// ============================================================
const hotspots = [
    { city: 'Киев', country: 'Украина', lat: 50.45, lon: 30.52 },
    { city: 'Москва', country: 'Россия', lat: 55.75, lon: 37.61 },
    { city: 'Вашингтон', country: 'США', lat: 38.91, lon: -77.04 },
    { city: 'Пекин', country: 'Китай', lat: 39.90, lon: 116.41 },
    { city: 'Тегеран', country: 'Иран', lat: 35.69, lon: 51.39 },
    { city: 'Пхеньян', country: 'КНДР', lat: 39.04, lon: 125.76 },
    { city: 'Тель-Авив', country: 'Израиль', lat: 32.09, lon: 34.78 },
    { city: 'Лондон', country: 'Великобритания', lat: 51.51, lon: -0.13 },
    { city: 'Берлин', country: 'Германия', lat: 52.52, lon: 13.41 },
    { city: 'Токио', country: 'Япония', lat: 35.68, lon: 139.65 },
    { city: 'Сеул', country: 'Юж. Корея', lat: 37.57, lon: 126.98 },
    { city: 'Тайбэй', country: 'Тайвань', lat: 25.03, lon: 121.57 },
    { city: 'Нью-Дели', country: 'Индия', lat: 28.61, lon: 77.21 },
    { city: 'Стамбул', country: 'Турция', lat: 41.01, lon: 28.98 },
    { city: 'Каир', country: 'Египет', lat: 30.04, lon: 31.24 },
    { city: 'Багдад', country: 'Ирак', lat: 33.32, lon: 44.36 },
    { city: 'Дамаск', country: 'Сирия', lat: 33.51, lon: 36.29 },
    { city: 'Даман', country: 'Саудовская Аравия', lat: 26.42, lon: 50.14 },
    { city: 'Карачи', country: 'Пакистан', lat: 24.86, lon: 67.01 },
    { city: 'Дакка', country: 'Бангладеш', lat: 23.81, lon: 90.41 },
    { city: 'Лагос', country: 'Нигерия', lat: 6.52, lon: 3.38 },
    { city: 'Йоханнесбург', country: 'ЮАР', lat: -26.20, lon: 28.05 },
    { city: 'Сан-Паулу', country: 'Бразилия', lat: -23.55, lon: -46.63 },
    { city: 'Мехико', country: 'Мексика', lat: 19.43, lon: -99.13 },
    { city: 'Буэнос-Айрес', country: 'Аргентина', lat: -34.61, lon: -58.38 },
    { city: 'Сидней', country: 'Австралия', lat: -33.87, lon: 151.21 },
    { city: 'Сингапур', country: 'Сингапур', lat: 1.35, lon: 103.82 },
    { city: 'Дубай', country: 'ОАЭ', lat: 25.20, lon: 55.27 },
    { city: 'Хельсинки', country: 'Финляндия', lat: 60.17, lon: 24.94 },
    { city: 'Варшава', country: 'Польша', lat: 52.23, lon: 21.01 },
    { city: 'Бухарест', country: 'Румыния', lat: 44.43, lon: 26.10 },
    { city: 'Тбилиси', country: 'Грузия', lat: 41.69, lon: 44.80 },
    { city: 'Минск', country: 'Беларусь', lat: 53.90, lon: 27.57 },
    { city: 'Астана', country: 'Казахстан', lat: 51.16, lon: 71.47 },
    { city: 'Ташкент', country: 'Узбекистан', lat: 41.30, lon: 69.24 },
    { city: 'Манила', country: 'Филиппины', lat: 14.60, lon: 120.98 },
    { city: 'Ханой', country: 'Вьетнам', lat: 21.03, lon: 105.85 },
    { city: 'Бангкок', country: 'Таиланд', lat: 13.76, lon: 100.50 },
    { city: 'Джакарта', country: 'Индонезия', lat: -6.21, lon: 106.85 },
    { city: 'Рейкьявик', country: 'Исландия', lat: 64.15, lon: -21.94 },
    { city: 'Тромсё', country: 'Норвегия', lat: 69.65, lon: 18.96 },
    { city: 'Мурманск', country: 'Россия', lat: 68.97, lon: 33.08 },
    { city: 'Владивосток', country: 'Россия', lat: 43.12, lon: 131.93 },
    { city: 'Калининград', country: 'Россия', lat: 54.71, lon: 20.51 },
    { city: 'Севастополь', country: 'Россия', lat: 44.62, lon: 33.53 },
    { city: 'Гавана', country: 'Куба', lat: 23.13, lon: -82.36 },
    { city: 'Каракас', country: 'Венесуэла', lat: 10.49, lon: -66.88 },
    { city: 'Найроби', country: 'Кения', lat: -1.29, lon: 36.82 },
    { city: 'Аддис-Абеба', country: 'Эфиопия', lat: 9.03, lon: 38.74 },
    { city: 'Хартум', country: 'Судан', lat: 15.50, lon: 32.56 }
];

const regions = {
    'США': 'Сев. Америка', 'Россия': 'Вост. Европа', 'Китай': 'Вост. Азия',
    'Иран': 'Бл. Восток', 'КНДР': 'Вост. Азия', 'Израиль': 'Бл. Восток',
    'Великобритания': 'Зап. Европа', 'Германия': 'Зап. Европа', 'Япония': 'Вост. Азия',
    'Юж. Корея': 'Вост. Азия', 'Тайвань': 'Вост. Азия', 'Индия': 'Юж. Азия',
    'Турция': 'Бл. Восток', 'Египет': 'Сев. Африка', 'Ирак': 'Бл. Восток',
    'Сирия': 'Бл. Восток', 'Саудовская Аравия': 'Бл. Восток', 'Пакистан': 'Юж. Азия',
    'Бангладеш': 'Юж. Азия', 'Нигерия': 'Зап. Африка', 'ЮАР': 'Юж. Африка',
    'Бразилия': 'Юж. Америка', 'Мексика': 'Сев. Америка', 'Аргентина': 'Юж. Америка',
    'Австралия': 'Океания', 'Сингапур': 'Юж. Азия', 'ОАЭ': 'Бл. Восток',
    'Финляндия': 'Сев. Европа', 'Польша': 'Вост. Европа', 'Румыния': 'Вост. Европа',
    'Грузия': 'Кавказ', 'Беларусь': 'Вост. Европа', 'Казахстан': 'Центр. Азия',
    'Узбекистан': 'Центр. Азия', 'Филиппины': 'Юж. Азия', 'Вьетнам': 'Юж. Азия',
    'Таиланд': 'Юж. Азия', 'Индонезия': 'Юж. Азия', 'Исландия': 'Сев. Европа',
    'Норвегия': 'Сев. Европа', 'Куба': 'Карибы', 'Венесуэла': 'Юж. Америка',
    'Кения': 'Вост. Африка', 'Эфиопия': 'Вост. Африка', 'Судан': 'Сев. Африка',
    'Украина': 'Вост. Европа'
};

console.log('\n🚀 Генерация всех оставшихся слоёв Crucix\n');

// ============================================================
//  РАЗВЕДКА (intelligence) — 12 слоёв
// ============================================================
console.log('📡 Разведка:');

// crucix-radar
save('crucix-radar.json', pickN(hotspots, 30).map(h =>
    pt(h.lon + rnd(-2,2), h.lat + rnd(-2,2), {
        label: `РЛС ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        radarType: pick(['досрочная', 'навигационная', 'засечка', 'перехват']),
        range: rndInt(100, 3000), value: rndInt(10, 28), icon: '📡'
    })
));

// crucix-satellite-recon
save('crucix-satellite-recon.json', pickN(hotspots, 25).map(h =>
    pt(h.lon + rnd(-5,5), h.lat + rnd(-5,5), {
        label: `Спутник-разведчик над ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        satId: `USA-${rndInt(200, 290)}`, resolution: `${rndInt(10, 50)} см`, value: rndInt(18, 30), icon: '🛰️'
    })
));

// crucix-sigint
save('crucix-sigint.json', pickN(hotspots, 28).map(h =>
    pt(h.lon + rnd(-1,1), h.lat + rnd(-1,1), {
        label: `SIGINT: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        freq: `${rndInt(30, 3000)} МГц`, signalType: pick(['军用', 'GPS', '蜂窝', '卫星']),
        value: rndInt(15, 28), icon: '📻'
    })
));

// crucix-humint
save('crucix-humint.json', pickN(hotspots, 20).map(h =>
    pt(h.lon + rnd(-0.5,0.5), h.lat + rnd(-0.5,0.5), {
        label: `Источник ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        reliability: pick(['A', 'B', 'C']), access: pick(['直接', '间接', '技术']),
        value: rndInt(10, 25), icon: '🕵️'
    })
));

// crucix-osint
save('crucix-osint.json', pickN(hotspots, 35).map(h =>
    pt(h.lon + rnd(-1,1), h.lat + rnd(-1,1), {
        label: `OSINT: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        source: pick(['社交媒体', '新闻', '博客', '论坛', '卫星图像']),
        value: rndInt(8, 20), icon: '🌐'
    })
));

// crucix-imint
save('crucix-imint.json', pickN(hotspots, 22).map(h =>
    pt(h.lon + rnd(-0.3,0.3), h.lat + rnd(-0.3,0.3), {
        label: `Снимок: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        platform: pick(['无人机', '卫星', '高空侦察', '巡逻机']),
        resolution: `${rndInt(10, 100)} см`, value: rndInt(15, 26), icon: '📸'
    })
));

// crucix-masint
save('crucix-masint.json', pickN(hotspots, 18).map(h =>
    pt(h.lon + rnd(-1,1), h.lat + rnd(-1,1), {
        label: `MASINT: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        masType: pick(['雷达特征', '化学痕迹', '核痕迹', '声学特征']),
        value: rndInt(12, 25), icon: '🔬'
    })
));

// crucix-geoint
save('crucix-geoint.json', pickN(hotspots, 24).map(h =>
    pt(h.lon + rnd(-0.5,0.5), h.lat + rnd(-0.5,0.5), {
        label: `GEO: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        terrainType: pick(['城市', '山地', '沿海', '沙漠', '森林']),
        elevation: rndInt(0, 3000), value: rndInt(10, 22), icon: '🗺️'
    })
));

// crucix-electronic-warfare
save('crucix-electronic-warfare.json', pickN(hotspots, 26).map(h =>
    pt(h.lon + rnd(-1,1), h.lat + rnd(-1,1), {
        label: `РЭБ: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        ewType: pick(['глушение', 'обман', 'защита', 'разведка']),
        power: `${rndInt(10, 500)} кВт`, value: rndInt(15, 28), icon: '⚡'
    })
));

// crucix-drone-recon
save('crucix-drone-recon.json', pickN(hotspots, 20).map(h =>
    pt(h.lon + rnd(-0.5,0.5), h.lat + rnd(-0.5,0.5), {
        label: `БПЛА: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        droneType: pick(['MALE', 'HALE', 'тактический', 'мини']),
        altitude: rndInt(500, 20000), value: rndInt(12, 25), icon: '🛩️'
    })
));

// crucix-communication-intercept
save('crucix-communication-intercept.json', pickN(hotspots, 30).map(h =>
    pt(h.lon + rnd(-1,1), h.lat + rnd(-1,1), {
        label: `Перехват: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        channel: pick(['SATCOM', 'HF', 'VHF', 'UHF', '蜂窝', '光纤']),
        value: rndInt(10, 24), icon: '📡'
    })
));

// crucix-pattern-life
save('crucix-pattern-life.json', pickN(hotspots, 15).map(h =>
    pt(h.lon, h.lat, {
        label: `Pattern: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        pattern: pick(['утренняя активность', 'ночные движения', 'изменение маршрутов', 'аномальный поток']),
        confidence: rndInt(60, 95), value: rndInt(15, 28), icon: '📊'
    })
));

// ============================================================
//  ВОЕННЫЙ (military) — 10 слоёв
// ============================================================
console.log('🛡️ Военный:');

// crucix-equipment
save('crucix-equipment.json', pickN(hotspots, 35).map(h =>
    pt(h.lon + rnd(-1,1), h.lat + rnd(-1,1), {
        label: `${pick(['Танк', 'БМП', 'Артиллерия', 'РСЗО', 'Транспортёр'])}: ${h.city}`,
        region: regions[h.country] || h.country, country: h.country,
        equipType: pick(['тяжёлая', 'средняя', 'лёгкая']),
        count: rndInt(5, 200), value: rndInt(10, 25), icon: '🚙'
    })
));

// crucix-personnel
save('crucix-personnel.json', pickN(hotspots, 25).map(h =>
    pt(h.lon + rnd(-0.5,0.5), h.lat + rnd(-0.5,0.5), {
        label: `Личный состав: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        unitType: pick(['мехбригада', 'спецназ', 'десант', 'морпехи', 'инженеры']),
        personnel: rndInt(100, 15000), value: rndInt(10, 24), icon: '👥'
    })
));

// crucix-bases
save('crucix-bases.json', pickN(hotspots, 30).map(h =>
    pt(h.lon + rnd(-0.2,0.2), h.lat + rnd(-0.2,0.2), {
        label: `База: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        baseType: pick(['армия', 'ВМФ', 'авиация', 'совместная']),
        status: pick(['активная', 'учебная', 'резерв', 'строится']),
        value: rndInt(15, 28), icon: '🏰'
    })
));

// crucix-movements
save('crucix-movements.json', pickN(hotspots, 20).map(h => {
    const h2 = pick(hotspots);
    return line([[h.lon, h.lat], [h2.lon, h2.lat], [h2.lon + rnd(-3,3), h2.lat + rnd(-3,3)]], {
        label: `Перемещение: ${h.city} → ${h2.city}`,
        region: regions[h.country] || h.country, country: h.country,
        moveType: pick(['наземное', 'воздушное', 'морское']),
        speed: rndInt(10, 80), value: rndInt(15, 26), icon: '📍'
    });
}));

// crucix-supply-lines
save('crucix-supply-lines.json', pickN(hotspots, 15).map(h => {
    const h2 = pick(hotspots);
    return line([[h.lon, h.lat], [h2.lon, h2.lat]], {
        label: `Снабжение: ${h.city} → ${h2.city}`,
        region: regions[h.country] || h.country, country: h.country,
        cargoType: pick(['топливо', 'боеприпасы', 'продовольствие', 'техника']),
        status: pick(['активна', 'перебита', 'под угрозой']),
        value: rndInt(12, 25), icon: '🚛'
    });
}));

// crucix-air-defense
save('crucix-air-defense.json', pickN(hotspots, 28).map(h =>
    pt(h.lon + rnd(-0.5,0.5), h.lat + rnd(-0.5,0.5), {
        label: `ПВО: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        system: pick(['S-400', 'Patriot', 'S-300', 'THAAD', 'Iron Dome', 'HQ-9']),
        range: rndInt(40, 400), value: rndInt(16, 28), icon: '🛡️'
    })
));

// crucix-naval
save('crucix-naval.json', pickN(hotspots.filter(h => Math.abs(h.lat) < 60), 22).map(h =>
    pt(h.lon + rnd(-3,3), h.lat + rnd(-3,3), {
        label: `${pick(['Фрегат', 'Эсминец', 'Подлодка', 'Авианосец', 'Корвет'])}: ${h.city}`,
        region: regions[h.country] || h.country, country: h.country,
        vesselType: pick(['надводный', 'подводный']),
        value: rndInt(15, 27), icon: '🚢'
    })
));

// crucix-aviation-mil
save('crucix-aviation-mil.json', pickN(hotspots, 25).map(h =>
    pt(h.lon + rnd(-1,1), h.lat + rnd(-1,1), {
        label: `${pick(['Истребитель', 'Бомбардировщик', 'Вертолёт', 'Разведчик', 'Транспорт'])}: ${h.city}`,
        region: regions[h.country] || h.country, country: h.country,
        aircraftType: pick(['истребитель', 'бомбардировщик', 'ударный', 'транспорт']),
        value: rndInt(14, 26), icon: '✈️'
    })
));

// crucix-missile
save('crucix-missile.json', pickN(hotspots, 18).map(h =>
    pt(h.lon + rnd(-0.5,0.5), h.lat + rnd(-0.5,0.5), {
        label: `Ракетная пусковая: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        missileType: pick(['баллистическая', 'крылатая', 'тактическая', 'гиперзвуковая']),
        range: rndInt(300, 15000), value: rndInt(18, 30), icon: '🚀'
    })
));

// crucix-target-list
save('crucix-target-list.json', pickN(hotspots, 16).map(h =>
    pt(h.lon + rnd(-0.3,0.3), h.lat + rnd(-0.3,0.3), {
        label: `Цель: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        targetType: pick(['командный пункт', 'склад', 'аэродром', 'мост', 'электростанция']),
        priority: pick(['высокая', 'средняя', 'низкая']),
        status: pick(['в разработке', 'утверждена', 'поражена', 'отменена']),
        value: rndInt(20, 30), icon: '🎯'
    })
));

// ============================================================
//  КИБЕР (cyber) — 7 слоёв
// ============================================================
console.log('🔒 Кибер:');

// crucix-cyber-nodes
save('crucix-cyber-nodes.json', pickN(hotspots, 30).map(h =>
    pt(h.lon + rnd(-0.3,0.3), h.lat + rnd(-0.3,0.3), {
        label: `Узел: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        nodeType: pick(['сервер', 'маршрутизатор', 'ЦОД', 'DNS', 'CDN']),
        status: pick(['активен', 'скомпрометирован', 'офлайн']),
        value: rndInt(10, 25), icon: '🖥️'
    })
));

// crucix-cyber-links
save('crucix-cyber-links.json', pickN(hotspots, 20).map(h => {
    const h2 = pick(hotspots);
    return line([[h.lon, h.lat], [h2.lon, h2.lat]], {
        label: `Связь: ${h.city} → ${h2.city}`,
        region: regions[h.country] || h.country, country: h.country,
        linkType: pick(['BGP', 'VPN', 'туннель', 'прокси']),
        traffic: `${rndInt(1, 999)} Гб/с`, value: rndInt(8, 20), icon: '🔗'
    });
}));

// crucix-cyber-infrastructure
save('crucix-cyber-infrastructure.json', pickN(hotspots, 25).map(h =>
    pt(h.lon + rnd(-0.3,0.3), h.lat + rnd(-0.3,0.3), {
        label: `Инфра: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        infraType: pick(['ботнет C2', 'прокси-сеть', 'тор-узел', 'VPN-ферма', 'майнинг']),
        value: rndInt(12, 26), icon: '🏗️'
    })
));

// crucix-cyber-anomalies
save('crucix-cyber-anomalies.json', pickN(hotspots, 22).map(h =>
    pt(h.lon + rnd(-0.5,0.5), h.lat + rnd(-0.5,0.5), {
        label: `Аномалия: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        anomalyType: pick(['нетипичный трафик', 'всплеск DNS', 'порт-сканирование', 'брутфорс']),
        value: rndInt(15, 28), icon: '⚠️'
    })
));

// crucix-cyber-attribution
save('crucix-cyber-attribution.json', pickN(hotspots, 15).map(h =>
    pt(h.lon + rnd(-0.3,0.3), h.lat + rnd(-0.3,0.3), {
        label: `Атрибуция: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        actor: pick(['APT-28', 'APT-29', 'Lazarus', 'APT-41', 'APT-34', 'Fin7']),
        confidence: rndInt(50, 95), value: rndInt(18, 28), icon: '🕵️'
    })
));

// crucix-cyber-scan
save('crucix-cyber-scan.json', pickN(hotspots, 28).map(h =>
    pt(h.lon + rnd(-0.3,0.3), h.lat + rnd(-0.3,0.3), {
        label: `Сканирование: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        scanType: pick(['Shodan', 'Censys', 'порт-скан', 'уязвимость']),
        ports: `${pick(['22', '80', '443', '3389', '445'])}/${pick(['TCP', 'UDP'])}`,
        value: rndInt(5, 18), icon: '🔍'
    })
));

// crucix-cyber-darkweb
save('crucix-cyber-darkweb.json', pickN(hotspots, 18).map(h =>
    pt(h.lon + rnd(-0.3,0.3), h.lat + rnd(-0.3,0.3), {
        label: `Даркнет: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        market: pick(['Tor-рынок', 'I2P-форум', 'менеджер ботнетов', 'продажа данных']),
        value: rndInt(12, 25), icon: '🕸️'
    })
));

// ============================================================
//  КОСМОС (space) — 5 слоёв
// ============================================================
console.log('🚀 Космос:');

// crucix-orbits
save('crucix-orbits.json', Array.from({ length: 15 }, (_, i) => {
    const inc = rndInt(30, 98);
    const coords = Array.from({ length: 60 }, (_, j) => {
        const angle = (j / 60) * 2 * Math.PI;
        const lat = Math.sin(angle) * inc;
        const lon = ((j / 60) * 360 + i * 24) % 360 - 180;
        return [lon, lat];
    });
    return line(coords, {
        label: `Орбита-${String(i + 1).padStart(2, '0')}`,
        region: 'космос', country: 'международный',
        orbitType: pick(['LEO', 'MEO', 'GEO', 'SSO']),
        inclination: inc, value: rndInt(10, 20), icon: '🌐'
    });
}));

// crucix-space-debris
save('crucix-space-debris.json', Array.from({ length: 60 }, (_, i) =>
    pt(rnd(-180, 180), rnd(-85, 85), {
        label: `Мусор-${String(i + 1).padStart(3, '0')}`,
        region: 'космос', country: 'международный',
        debrisType: pick(['фрагмент', 'ступень', 'болт', 'обшивка']),
        size: `${rndInt(1, 50)} см`, altitude: rndInt(400, 20000),
        value: rndInt(5, 15), icon: '🛰️'
    })
));

// crucix-space-launch
save('crucix-space-launch.json', [
    { city: 'Космодром Восточный', lat: 51.88, lon: 128.33, country: 'Россия' },
    { city: 'Плесецк', lat: 62.93, lon: 40.58, country: 'Россия' },
    { city: 'Байконур', lat: 45.96, lon: 63.31, country: 'Казахстан' },
    { city: 'Cape Canaveral', lat: 28.56, lon: -80.57, country: 'США' },
    { city: 'Vandenberg', lat: 34.77, lon: -120.57, country: 'США' },
    { city: 'Jiuquan', lat: 40.96, lon: 100.29, country: 'Китай' },
    { city: 'Kourou', lat: 5.23, lon: -52.77, country: 'Франция' },
    { city: 'Tanegashima', lat: 30.40, lon: 130.97, country: 'Япония' }
].map(l => pt(l.lon, l.lat, {
    label: `Пуск: ${l.city}`, region: regions[l.country] || l.country, country: l.country,
    rocket: pick(['Союз-2', 'Falcon 9', 'Long March', 'Ariane', 'H-IIA', 'Angara']),
    payload: pick(['спутник', 'груз МКС', 'разведка', 'научный']),
    value: rndInt(18, 28), icon: '🚀'
})));

// crucix-gps-jamming
save('crucix-gps-jamming.json', pickN(hotspots, 20).map(h =>
    pt(h.lon + rnd(-2,2), h.lat + rnd(-2,2), {
        label: `GPS-глушение: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        radius: rndInt(50, 500), intensity: rndInt(40, 95),
        value: rndInt(15, 28), icon: '📡'
    })
));

// crucix-space-weather
save('crucix-space-weather.json', [
    pt(0, 0, { label: 'Солнечная вспышка X-2.1', region: 'Солнце', country: 'Солнце',
        eventType: 'вспышка', class: 'X', value: 28, icon: '🌞' }),
    pt(45, 30, { label: 'Геомагнитная буря G3', region: 'Земля', country: 'Земля',
        eventType: 'магнитная буря', class: 'G3', value: 24, icon: '🌞' }),
    pt(-30, -60, { label: 'Корональный выброс MME', region: 'Земля', country: 'Земля',
        eventType: 'CME', class: 'M', value: 22, icon: '🌞' }),
    pt(15, 80, { label: 'Радиопомехи R2', region: 'Полярные', country: 'Земля',
        eventType: 'радиопомехи', class: 'R2', value: 18, icon: '🌞' }),
    pt(-15, -120, { label: 'Поток частиц S1', region: 'Тропики', country: 'Земля',
        eventType: 'поток частиц', class: 'S1', value: 15, icon: '🌞' })
]);

// ============================================================
//  ИНФРАСТРУКТУРА (infrastructure) — 10 слоёв
// ============================================================
console.log('🏗️ Инфраструктура:');

// crucix-power-grid
save('crucix-power-grid.json', pickN(hotspots, 30).map(h =>
    pt(h.lon + rnd(-1,1), h.lat + rnd(-1,1), {
        label: `Электростанция: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        plantType: pick(['ТЭЦ', 'ГЭС', 'АЭС', 'ВЭС', 'СЭС', 'ГТУ']),
        capacity: `${rndInt(50, 5000)} МВт`, status: pick(['работает', 'авария', 'ремонт']),
        value: rndInt(12, 26), icon: '⚡'
    })
));

// crucix-pipelines
const pipeCities = pickN(hotspots, 12);
save('crucix-pipelines.json', pipeCities.map((h, i) => {
    const h2 = pipeCities[(i + 1) % pipeCities.length];
    return line([[h.lon, h.lat], [h2.lon, h2.lat]], {
        label: `Трубопровод: ${h.city} → ${h2.city}`,
        region: regions[h.country] || h.country, country: h.country,
        pipeType: pick(['нефть', 'газ', 'нефтепродукты']),
        diameter: `${rndInt(200, 1200)} мм`, value: rndInt(15, 25), icon: '🛢️'
    });
}));

// crucix-datacenters
save('crucix-datacenters.json', pickN(hotspots, 25).map(h =>
    pt(h.lon + rnd(-0.3,0.3), h.lat + rnd(-0.3,0.3), {
        label: `ЦОД: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        operator: pick(['AWS', 'Google', 'Azure', 'Local', 'Cloudflare', 'Meta']),
        capacity: `${rndInt(1, 100)} МВт`, value: rndInt(12, 25), icon: '🏢'
    })
));

// crucix-undersea-cables
save('crucix-undersea-cables.json', [
    ['Владивосток', 'Нью-Йорк'], ['Лондон', 'Нью-Йорк'], ['Сингапур', 'Сидней'],
    ['Дубай', 'Мумбаи'], ['Токио', 'Сан-Паулу'], ['Каир', 'Марсель'],
    ['Лагос', 'Лиссабон'], ['Гавана', 'Каракас'], ['Севастополь', 'Стамбул'],
    ['Гонконг', 'Лос-Анджелес'], ['Стокгольм', 'Рейкьявик'], ['Манила', 'Гуам']
].map(pair => {
    const c1 = hotspots.find(h => h.city === pair[0]) || pick(hotspots);
    const c2 = hotspots.find(h => h.city === pair[1]) || pick(hotspots);
    return line([[c1.lon, c1.lat], [c2.lon, c2.lat]], {
        label: `Кабель: ${pair[0]} → ${pair[1]}`,
        region: 'океан', country: 'международный',
        cableType: pick(['магистральный', 'региональный', 'специальный']),
        length: rndInt(1000, 20000), value: rndInt(15, 26), icon: '🌊'
    });
}));

// crucix-telecom
save('crucix-telecom.json', pickN(hotspots, 28).map(h =>
    pt(h.lon + rnd(-0.3,0.3), h.lat + rnd(-0.3,0.3), {
        label: `Телеком: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        operator: pick(['MTS', 'AT&T', 'China Mobile', 'Vodafone', 'Deutsche Telekom', 'Reliance']),
        tech: pick(['5G', '4G', '3G', 'спутник']),
        value: rndInt(10, 22), icon: '📡'
    })
));

// crucix-transport-hub
save('crucix-transport-hub.json', pickN(hotspots, 22).map(h =>
    pt(h.lon + rnd(-0.3,0.3), h.lat + rnd(-0.3,0.3), {
        label: `Хаб: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        hubType: pick(['ж/д узел', 'автотрасса', 'логистический центр', 'перевалка']),
        value: rndInt(10, 22), icon: '🚂'
    })
));

// crucix-ports-infra
save('crucix-port-infra.json', hotspots.filter(h => Math.abs(h.lat) < 60).slice(0, 20).map(h =>
    pt(h.lon + rnd(-0.1,0.1), h.lat + rnd(-0.1,0.1), {
        label: `Порт: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        portType: pick(['контейнерный', 'наливной', 'сухогруз', 'рыбный', 'военно-морской']),
        throughput: `${rndInt(1, 40)} млн TEU`, value: rndInt(12, 25), icon: '⚓'
    })
));

// crucix-airports
save('crucix-airports.json', pickN(hotspots, 25).map(h =>
    pt(h.lon + rnd(-0.2,0.2), h.lat + rnd(-0.2,0.2), {
        label: `Аэропорт: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        iata: `${pick(['S','U','L','E','Z'])}${pick(['U','V','W','X','Y'])}${pick(['X','F','L','M','N'])}`,
        passengers: `${rndInt(1, 80)} млн/год`, value: rndInt(10, 22), icon: '✈️'
    })
));

// crucix-water-systems
save('crucix-water-systems.json', pickN(hotspots, 18).map(h =>
    pt(h.lon + rnd(-0.5,0.5), h.lat + rnd(-0.5,0.5), {
        label: `Водоснабжение: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        systemType: pick(['водохранилище', 'насосная станция', 'очистные', 'водозабор']),
        capacity: `${rndInt(10, 1000)} тыс. м³/сут`, value: rndInt(8, 18), icon: '💧'
    })
));

// crucix-nuclear-facilities
save('crucix-nuclear-facilities.json', [
    { city: 'Нововоронежская АЭС', lat: 51.18, lon: 39.07, country: 'Россия' },
    { city: 'Ленинградская АЭС', lat: 59.85, lon: 29.10, country: 'Россия' },
    { city: 'Курская АЭС', lat: 51.69, lon: 35.61, country: 'Россия' },
    { city: 'Запорожская АЭС', lat: 47.51, lon: 34.58, country: 'Украина' },
    { city: 'Чернобыльская АЭС', lat: 51.27, lon: 30.22, country: 'Украина' },
    { city: 'Фукусима-1', lat: 37.42, lon: 141.03, country: 'Япония' },
    { city: 'Озери, Франция', lat: 47.43, lon: 4.47, country: 'Франция' },
    { city: 'Three Mile Island', lat: 40.15, lon: -76.72, country: 'США' },
    { city: 'Дэянь, Китай', lat: 38.90, lon: 121.59, country: 'Китай' },
    { city: 'Бушер, Иран', lat: 28.83, lon: 50.89, country: 'Иран' },
    { city: 'Барселина, Испания', lat: 41.27, lon: -3.49, country: 'Испания' },
    { city: 'Куданкулам, Индия', lat: 8.17, lon: 77.71, country: 'Индия' },
    { city: 'Брукхейвен, США', lat: 40.87, lon: -72.87, country: 'США' },
    { city: 'Ловийса, Финляндия', lat: 60.38, lon: 26.43, country: 'Финляндия' }
].map(n => pt(n.lon, n.lat, {
    label: n.city, region: regions[n.country] || n.country, country: n.country,
    facilityType: pick(['АЭС', 'полигон', 'хранилище', 'НИИ']),
    status: pick(['активна', 'строится', 'выводится', 'инцидент']),
    value: rndInt(18, 30), icon: '☢️'
})));

// ============================================================
//  ФИНАНСЫ (finance) — 6 слоёв
// ============================================================
console.log('💰 Финансы:');

// crucix-fin-flows
save('crucix-fin-flows.json', pickN(hotspots, 20).map(h => {
    const h2 = pick(hotspots);
    return line([[h.lon, h.lat], [h2.lon, h2.lat]], {
        label: `Поток: ${h.city} → ${h2.city}`,
        region: regions[h.country] || h.country, country: h.country,
        flowType: pick(['перевод', 'инвестиция', 'торговля', 'вывод капитала']),
        amount: `$${rndInt(1, 500)} млн`, value: rndInt(10, 25), icon: '💸'
    });
}));

// crucix-sanctions
save('crucix-sanctions.json', pickN(hotspots, 18).map(h =>
    pt(h.lon + rnd(-0.3,0.3), h.lat + rnd(-0.3,0.3), {
        label: `Санкции: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        sanctionsType: pick(['SDN', 'секторальные', 'экспортные', 'финансовые', 'визовые']),
        program: pick(['OFAC', 'EU', 'UN', 'UK', ' individual']),
        value: rndInt(15, 28), icon: '⛔'
    })
));

// crucix-crypto-trace
save('crucix-crypto-trace.json', pickN(hotspots, 20).map(h =>
    pt(h.lon + rnd(-0.3,0.3), h.lat + rnd(-0.3,0.3), {
        label: `Крипто: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        coin: pick(['BTC', 'ETH', 'USDT', 'XMR', 'TRX']),
        walletType: pick(['обменник', 'миксер', 'холодный', 'горячий']),
        value: rndInt(12, 25), icon: '₿'
    })
));

// crucix-shell-companies
save('crucix-shell-companies.json', pickN(hotspots, 16).map(h =>
    pt(h.lon + rnd(-0.3,0.3), h.lat + rnd(-0.3,0.3), {
        label: `Фирма-однодневка: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        jurisdiction: pick(['BVI', 'Cyprus', 'Panama', 'Seychelles', 'Cayman', 'UAE']),
        risk: pick(['высокий', 'критический', 'средний']),
        value: rndInt(15, 28), icon: '🏢'
    })
));

// crucix-banking
save('crucix-banking.json', pickN(hotspots, 25).map(h =>
    pt(h.lon + rnd(-0.3,0.3), h.lat + rnd(-0.3,0.3), {
        label: `Банк: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        bankType: pick(['центральный', 'коммерческий', 'инвестиционный', 'офшорный']),
        assets: `$${rndInt(1, 500)} млрд`, value: rndInt(10, 22), icon: '🏦'
    })
));

// crucix-trade-routes
save('crucix-trade-routes.json', [
    ['Шанхай', 'Роттердам'], ['Нью-Йорк', 'Гамбург'], ['Сингапур', 'Дубай'],
    ['Гонконг', 'Лос-Анджелес'], ['Стамбул', 'Одесса'], ['Мумбаи', 'Дурбан'],
    ['Владивосток', 'Пусан'], ['Хьюстон', 'Токио'], ['Каир', 'Пирей'], ['Сантус', 'Шанхай']
].map(pair => {
    const c1 = hotspots.find(h => h.city === pair[0]) || pick(hotspots);
    const c2 = hotspots.find(h => h.city === pair[1]) || pick(hotspots);
    return line([[c1.lon, c1.lat], [c2.lon, c2.lat]], {
        label: `Маршрут: ${pair[0]} → ${pair[1]}`,
        region: 'международный', country: 'международный',
        cargoType: pick(['контейнеры', 'нефть', 'зерно', 'руды', 'техника']),
        volume: `${rndInt(100, 5000)} тыс. т`, value: rndInt(12, 24), icon: '📦'
    });
}));

// ============================================================
//  СОЦИАЛЬНЫЕ (social) — 6 слоёв
// ============================================================
console.log('👥 Социальные:');

// crucix-population-flow
save('crucix-population-flow.json', pickN(hotspots, 15).map(h => {
    const h2 = pick(hotspots);
    return line([[h.lon, h.lat], [h2.lon, h2.lat]], {
        label: `Миграция: ${h.city} → ${h2.city}`,
        region: regions[h.country] || h.country, country: h.country,
        flowType: pick(['миграция', 'эвакуация', 'трудовая', 'вынужденная']),
        count: rndInt(1000, 500000), value: rndInt(12, 25), icon: '👥'
    });
}));

// crucix-refugees
save('crucix-refugees.json', pickN(hotspots, 14).map(h =>
    pt(h.lon + rnd(-1,1), h.lat + rnd(-1,1), {
        label: `Лагерь беженцев: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        campType: pick(['формальный', 'неформальный', 'ПВР', 'приют']),
        count: rndInt(500, 200000), value: rndInt(15, 28), icon: '🧳'
    })
));

// crucix-social-unrest
save('crucix-social-unrest.json', pickN(hotspots, 22).map(h =>
    pt(h.lon + rnd(-0.5,0.5), h.lat + rnd(-0.5,0.5), {
        label: `Непредсказуемость: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        unrestType: pick(['протесты', 'забастовка', 'беспорядки', 'митинг', 'блокада']),
        participants: rndInt(100, 500000), value: rndInt(15, 28), icon: '🔥'
    })
));

// crucix-phone-activity
save('crucix-phone-activity.json', pickN(hotspots, 30).map(h =>
    pt(h.lon + rnd(-0.3,0.3), h.lat + rnd(-0.3,0.3), {
        label: `Активность телефонов: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        activityType: pick(['всплеск', 'падение', 'аномалия', 'миграция']),
        devices: rndInt(1000, 500000), value: rndInt(10, 22), icon: '📱'
    })
));

// crucix-border-crossings
save('crucix-border-crossings.json', pickN(hotspots, 18).map(h =>
    pt(h.lon + rnd(-0.5,0.5), h.lat + rnd(-0.5,0.5), {
        label: `Пункт пропуска: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        crossingType: pick(['авто', 'ж/д', 'пешеходный', 'мультимодальный', 'воздушный']),
        status: pick(['открыт', 'закрыт', 'ограничен', 'очередь']),
        value: rndInt(10, 24), icon: '🛂'
    })
));

// crucix-media-narrative
save('crucix-media-narrative.json', pickN(hotspots, 20).map(h =>
    pt(h.lon + rnd(-0.3,0.3), h.lat + rnd(-0.3,0.3), {
        label: `Нарратив: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        narrativeType: pick(['пропаганда', 'контрнарратив', 'информационная атака', 'факт-чек']),
        sentiment: pick(['негативный', 'нейтральный', 'позитивный']),
        reach: rndInt(10000, 5000000), value: rndInt(12, 24), icon: '📰'
    })
));

// ============================================================
//  ЭКОЛОГИЯ (ecological) — 5 слоёв
// ============================================================
console.log('🌿 Экология:');

// crucix-earthquakes
save('crucix-earthquakes.json', Array.from({ length: 25 }, () => {
    const h = pick(hotspots);
    return pt(h.lon + rnd(-5,5), h.lat + rnd(-5,5), {
        label: `Землетрясение M${rnd(2.5, 7.5).toFixed(1)}`,
        region: regions[h.country] || h.country, country: h.country,
        magnitude: rnd(2.5, 7.5), depth: rndInt(5, 200),
        value: rndInt(10, 28), icon: '🌋'
    });
}));

// crucix-fires
save('crucix-fires.json', pickN(hotspots, 30).map(h =>
    pt(h.lon + rnd(-2,2), h.lat + rnd(-2,2), {
        label: `Пожар: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        fireType: pick(['лесной', 'торфяной', 'техногенный', 'природный']),
        area: `${rndInt(10, 50000)} га`, intensity: rndInt(30, 99),
        value: rndInt(12, 26), icon: '🔥'
    })
));

// crucix-floods
save('crucix-floods.json', pickN(hotspots, 18).map(h => {
    const coords = [
        [h.lon - 0.5, h.lat - 0.5], [h.lon + 0.5, h.lat - 0.5],
        [h.lon + 0.7, h.lat + 0.3], [h.lon - 0.3, h.lat + 0.5], [h.lon - 0.5, h.lat - 0.5]
    ];
    return poly(coords, {
        label: `Наводнение: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        floodType: pick(['половодье', 'паводок', 'подтопление', 'цунами']),
        level: `${rndInt(1, 8)} м`, area: `${rndInt(10, 5000)} км²`,
        value: rndInt(15, 28), icon: '🌊'
    });
}));

// crucix-anomalies-geo
save('crucix-anomalies-geo.json', pickN(hotspots, 20).map(h =>
    pt(h.lon + rnd(-3,3), h.lat + rnd(-3,3), {
        label: `Геоаномалия: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        anomalyType: pick(['температурная', 'магнитная', 'гравитационная', 'сейсмоаномалия', 'газовыделение']),
        value: rndInt(12, 25), icon: '⚠️'
    })
));

// crucix-weather
save('crucix-weather.json', pickN(hotspots, 25).map(h =>
    pt(h.lon + rnd(-1,1), h.lat + rnd(-1,1), {
        label: `Погода: ${h.city}`, region: regions[h.country] || h.country, country: h.country,
        weatherType: pick(['шторм', 'ураган', 'жара', 'холод', 'туман', 'осадки']),
        temperature: rndInt(-40, 50), wind: `${rndInt(0, 200)} км/ч`,
        value: rndInt(8, 20), icon: '🌤️'
    })
));

// ============================================================
//  ИТОГ
// ============================================================
const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.json'));
console.log(`\n✅ Готово! Создано ${files.length} файлов в папке ${OUT_DIR}/`);
console.log(`   Скопируй все файлы в dashboard/public/data/`);
