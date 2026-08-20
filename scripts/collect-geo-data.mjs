#!/usr/bin/env node

// ============================================================
// СБОРЩИК ГЕО-ДАННЫХ ДЛЯ КОРЗИНЫ
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASKET_DIR = join(ROOT, 'data', 'basket');

// ============================================================
// 1. ВСЕ СТРАНЫ МИРА (192)
// ============================================================

const COUNTRIES = {
  // ЕВРОПА
  albania: { name: "Албания", status: "inactive", lat: 41.2, lng: 20.2 },
  andorra: { name: "Андорра", status: "inactive", lat: 42.5, lng: 1.6 },
  austria: { name: "Австрия", status: "inactive", lat: 47.5, lng: 14.2 },
  belarus: { name: "Беларусь", status: "medium", lat: 53.7, lng: 27.6 },
  belgium: { name: "Бельгия", status: "inactive", lat: 50.5, lng: 4.5 },
  bosnia: { name: "Босния", status: "inactive", lat: 44.0, lng: 17.7 },
  bulgaria: { name: "Болгария", status: "inactive", lat: 42.7, lng: 25.5 },
  croatia: { name: "Хорватия", status: "inactive", lat: 45.1, lng: 15.2 },
  cyprus: { name: "Кипр", status: "inactive", lat: 35.1, lng: 33.4 },
  czechia: { name: "Чехия", status: "inactive", lat: 49.8, lng: 15.5 },
  denmark: { name: "Дания", status: "inactive", lat: 56.2, lng: 10.2 },
  estonia: { name: "Эстония", status: "high", lat: 58.6, lng: 25.0 },
  finland: { name: "Финляндия", status: "inactive", lat: 64.0, lng: 26.0 },
  france: { name: "Франция", status: "medium", lat: 46.6, lng: 2.2 },
  germany: { name: "Германия", status: "medium", lat: 51.0, lng: 10.0 },
  greece: { name: "Греция", status: "inactive", lat: 39.0, lng: 22.0 },
  hungary: { name: "Венгрия", status: "inactive", lat: 47.0, lng: 20.0 },
  iceland: { name: "Исландия", status: "inactive", lat: 65.0, lng: -18.0 },
  ireland: { name: "Ирландия", status: "inactive", lat: 53.0, lng: -8.0 },
  italy: { name: "Италия", status: "inactive", lat: 41.9, lng: 12.6 },
  kosovo: { name: "Косово", status: "inactive", lat: 42.6, lng: 20.9 },
  latvia: { name: "Латвия", status: "high", lat: 56.9, lng: 24.6 },
  liechtenstein: { name: "Лихтенштейн", status: "inactive", lat: 47.2, lng: 9.5 },
  lithuania: { name: "Литва", status: "high", lat: 55.2, lng: 23.9 },
  luxembourg: { name: "Люксембург", status: "inactive", lat: 49.8, lng: 6.1 },
  malta: { name: "Мальта", status: "inactive", lat: 35.9, lng: 14.5 },
  moldova: { name: "Молдова", status: "inactive", lat: 47.0, lng: 28.5 },
  monaco: { name: "Монако", status: "inactive", lat: 43.7, lng: 7.4 },
  montenegro: { name: "Черногория", status: "inactive", lat: 42.7, lng: 19.3 },
  netherlands: { name: "Нидерланды", status: "inactive", lat: 52.1, lng: 5.3 },
  north_macedonia: { name: "Северная Македония", status: "inactive", lat: 41.6, lng: 21.7 },
  norway: { name: "Норвегия", status: "inactive", lat: 60.5, lng: 8.5 },
  poland: { name: "Польша", status: "high", lat: 52.0, lng: 19.0 },
  portugal: { name: "Португалия", status: "inactive", lat: 39.5, lng: -8.0 },
  romania: { name: "Румыния", status: "inactive", lat: 46.0, lng: 25.0 },
  russia: { name: "Россия", status: "pre-war", lat: 61.5, lng: 105.0 },
  san_marino: { name: "Сан-Марино", status: "inactive", lat: 43.9, lng: 12.5 },
  serbia: { name: "Сербия", status: "inactive", lat: 44.0, lng: 21.0 },
  slovakia: { name: "Словакия", status: "inactive", lat: 48.7, lng: 19.5 },
  slovenia: { name: "Словения", status: "inactive", lat: 46.1, lng: 14.8 },
  spain: { name: "Испания", status: "inactive", lat: 40.4, lng: -3.7 },
  sweden: { name: "Швеция", status: "inactive", lat: 60.1, lng: 18.6 },
  switzerland: { name: "Швейцария", status: "inactive", lat: 46.8, lng: 8.2 },
  ukraine: { name: "Украина", status: "critical", lat: 48.4, lng: 31.2 },
  uk: { name: "Великобритания", status: "medium", lat: 55.4, lng: -3.4 },
  vatican: { name: "Ватикан", status: "inactive", lat: 41.9, lng: 12.5 },

  // АЗИЯ
  afghanistan: { name: "Афганистан", status: "high", lat: 33.9, lng: 67.7 },
  armenia: { name: "Армения", status: "high", lat: 40.2, lng: 45.0 },
  azerbaijan: { name: "Азербайджан", status: "high", lat: 40.4, lng: 47.5 },
  bahrain: { name: "Бахрейн", status: "inactive", lat: 26.0, lng: 50.5 },
  bangladesh: { name: "Бангладеш", status: "inactive", lat: 23.7, lng: 90.4 },
  bhutan: { name: "Бутан", status: "inactive", lat: 27.5, lng: 90.4 },
  brunei: { name: "Бруней", status: "inactive", lat: 4.5, lng: 114.7 },
  cambodia: { name: "Камбоджа", status: "inactive", lat: 12.6, lng: 104.0 },
  china: { name: "Китай", status: "medium", lat: 35.0, lng: 105.0 },
  georgia: { name: "Грузия", status: "inactive", lat: 42.0, lng: 43.5 },
  india: { name: "Индия", status: "medium", lat: 20.5, lng: 78.9 },
  indonesia: { name: "Индонезия", status: "inactive", lat: -0.8, lng: 113.8 },
  iran: { name: "Иран", status: "critical", lat: 32.4, lng: 53.7 },
  iraq: { name: "Ирак", status: "high", lat: 33.2, lng: 43.7 },
  israel: { name: "Израиль", status: "critical", lat: 31.0, lng: 34.8 },
  japan: { name: "Япония", status: "high", lat: 36.2, lng: 138.3 },
  jordan: { name: "Иордания", status: "inactive", lat: 31.0, lng: 36.0 },
  kazakhstan: { name: "Казахстан", status: "inactive", lat: 48.0, lng: 68.0 },
  kuwait: { name: "Кувейт", status: "inactive", lat: 29.4, lng: 47.6 },
  kyrgyzstan: { name: "Кыргызстан", status: "inactive", lat: 41.2, lng: 74.8 },
  laos: { name: "Лаос", status: "inactive", lat: 18.0, lng: 105.0 },
  lebanon: { name: "Ливан", status: "high", lat: 33.8, lng: 35.8 },
  malaysia: { name: "Малайзия", status: "inactive", lat: 2.5, lng: 112.5 },
  maldives: { name: "Мальдивы", status: "inactive", lat: 3.2, lng: 73.2 },
  mongolia: { name: "Монголия", status: "inactive", lat: 46.0, lng: 105.0 },
  myanmar: { name: "Мьянма", status: "critical", lat: 21.9, lng: 95.9 },
  nepal: { name: "Непал", status: "inactive", lat: 28.0, lng: 84.0 },
  north_korea: { name: "Северная Корея", status: "pre-war", lat: 40.3, lng: 127.0 },
  oman: { name: "Оман", status: "inactive", lat: 21.0, lng: 57.0 },
  pakistan: { name: "Пакистан", status: "high", lat: 30.3, lng: 71.0 },
  palestine: { name: "Палестина", status: "critical", lat: 31.9, lng: 35.2 },
  philippines: { name: "Филиппины", status: "inactive", lat: 12.8, lng: 122.0 },
  qatar: { name: "Катар", status: "inactive", lat: 25.3, lng: 51.2 },
  saudi: { name: "Саудовская Аравия", status: "medium", lat: 23.8, lng: 45.0 },
  singapore: { name: "Сингапур", status: "inactive", lat: 1.3, lng: 103.8 },
  south_korea: { name: "Южная Корея", status: "high", lat: 36.5, lng: 127.8 },
  sri_lanka: { name: "Шри-Ланка", status: "inactive", lat: 7.9, lng: 80.7 },
  syria: { name: "Сирия", status: "critical", lat: 34.8, lng: 38.0 },
  taiwan: { name: "Тайвань", status: "inactive", lat: 23.5, lng: 121.0 },
  tajikistan: { name: "Таджикистан", status: "inactive", lat: 38.5, lng: 71.0 },
  thailand: { name: "Таиланд", status: "inactive", lat: 15.0, lng: 101.0 },
  turkey: { name: "Турция", status: "medium", lat: 38.9, lng: 35.0 },
  turkmenistan: { name: "Туркменистан", status: "inactive", lat: 39.0, lng: 60.0 },
  uae: { name: "ОАЭ", status: "inactive", lat: 24.0, lng: 54.0 },
  uzbekistan: { name: "Узбекистан", status: "inactive", lat: 41.5, lng: 64.0 },
  vietnam: { name: "Вьетнам", status: "inactive", lat: 16.0, lng: 108.0 },
  yemen: { name: "Йемен", status: "critical", lat: 15.5, lng: 48.0 },

  // АФРИКА
  algeria: { name: "Алжир", status: "inactive", lat: 28.0, lng: 3.0 },
  angola: { name: "Ангола", status: "inactive", lat: -12.0, lng: 18.0 },
  benin: { name: "Бенин", status: "inactive", lat: 9.3, lng: 2.3 },
  botswana: { name: "Ботсвана", status: "inactive", lat: -22.3, lng: 24.7 },
  burkina: { name: "Буркина-Фасо", status: "inactive", lat: 12.2, lng: -1.5 },
  burundi: { name: "Бурунди", status: "inactive", lat: -3.4, lng: 29.9 },
  cameroon: { name: "Камерун", status: "inactive", lat: 7.4, lng: 12.4 },
  cape_verde: { name: "Кабо-Верде", status: "inactive", lat: 15.1, lng: -23.6 },
  car: { name: "ЦАР", status: "inactive", lat: 6.6, lng: 20.5 },
  chad: { name: "Чад", status: "inactive", lat: 15.5, lng: 19.0 },
  comoros: { name: "Коморы", status: "inactive", lat: -12.2, lng: 43.2 },
  congo: { name: "Конго", status: "inactive", lat: -0.2, lng: 16.6 },
  drc: { name: "ДР Конго", status: "inactive", lat: -4.0, lng: 22.0 },
  djibouti: { name: "Джибути", status: "inactive", lat: 11.5, lng: 43.0 },
  egypt: { name: "Египет", status: "medium", lat: 26.8, lng: 30.0 },
  eritrea: { name: "Эритрея", status: "inactive", lat: 15.2, lng: 39.8 },
  eswatini: { name: "Эсватини", status: "inactive", lat: -26.5, lng: 31.5 },
  ethiopia: { name: "Эфиопия", status: "critical", lat: 9.1, lng: 40.5 },
  gabon: { name: "Габон", status: "inactive", lat: -0.8, lng: 11.8 },
  gambia: { name: "Гамбия", status: "inactive", lat: 13.5, lng: -15.5 },
  ghana: { name: "Гана", status: "inactive", lat: 8.0, lng: -1.0 },
  guinea: { name: "Гвинея", status: "inactive", lat: 10.0, lng: -10.0 },
  guinea_bissau: { name: "Гвинея-Бисау", status: "inactive", lat: 12.0, lng: -15.0 },
  ivory_coast: { name: "Кот-д'Ивуар", status: "inactive", lat: 7.5, lng: -5.5 },
  kenya: { name: "Кения", status: "inactive", lat: -1.3, lng: 36.8 },
  lesotho: { name: "Лесото", status: "inactive", lat: -29.5, lng: 28.2 },
  liberia: { name: "Либерия", status: "inactive", lat: 6.5, lng: -9.5 },
  libya: { name: "Ливия", status: "inactive", lat: 27.0, lng: 17.0 },
  madagascar: { name: "Мадагаскар", status: "inactive", lat: -18.8, lng: 46.8 },
  malawi: { name: "Малави", status: "inactive", lat: -13.5, lng: 34.0 },
  mali: { name: "Мали", status: "inactive", lat: 17.5, lng: -3.5 },
  mauritania: { name: "Мавритания", status: "inactive", lat: 20.0, lng: -12.0 },
  mauritius: { name: "Маврикий", status: "inactive", lat: -20.3, lng: 57.5 },
  morocco: { name: "Марокко", status: "inactive", lat: 31.8, lng: -7.1 },
  mozambique: { name: "Мозамбик", status: "inactive", lat: -18.7, lng: 35.5 },
  namibia: { name: "Намибия", status: "inactive", lat: -22.0, lng: 17.0 },
  niger: { name: "Нигер", status: "inactive", lat: 17.5, lng: 8.0 },
  nigeria: { name: "Нигерия", status: "inactive", lat: 10.0, lng: 10.0 },
  rwanda: { name: "Руанда", status: "inactive", lat: -2.0, lng: 30.0 },
  sao_tome: { name: "Сан-Томе", status: "inactive", lat: 0.3, lng: 6.6 },
  senegal: { name: "Сенегал", status: "inactive", lat: 14.5, lng: -14.5 },
  seychelles: { name: "Сейшелы", status: "inactive", lat: -4.7, lng: 55.5 },
  sierra_leone: { name: "Сьерра-Леоне", status: "inactive", lat: 8.5, lng: -11.5 },
  somalia: { name: "Сомали", status: "critical", lat: 5.2, lng: 46.2 },
  south_africa: { name: "ЮАР", status: "inactive", lat: -30.5, lng: 22.5 },
  sudan: { name: "Судан", status: "critical", lat: 15.5, lng: 32.5 },
  tanzania: { name: "Танзания", status: "inactive", lat: -6.0, lng: 35.0 },
  togo: { name: "Того", status: "inactive", lat: 8.5, lng: 1.0 },
  tunisia: { name: "Тунис", status: "inactive", lat: 34.0, lng: 9.0 },
  uganda: { name: "Уганда", status: "inactive", lat: 1.0, lng: 32.0 },
  zambia: { name: "Замбия", status: "inactive", lat: -15.0, lng: 28.0 },
  zimbabwe: { name: "Зимбабве", status: "inactive", lat: -19.0, lng: 29.0 },

  // СЕВЕРНАЯ АМЕРИКА
  antigua: { name: "Антигуа", status: "inactive", lat: 17.1, lng: -61.8 },
  bahamas: { name: "Багамы", status: "inactive", lat: 25.0, lng: -77.4 },
  barbados: { name: "Барбадос", status: "inactive", lat: 13.2, lng: -59.5 },
  belize: { name: "Белиз", status: "inactive", lat: 17.2, lng: -88.5 },
  canada: { name: "Канада", status: "inactive", lat: 56.1, lng: -106.3 },
  costa_rica: { name: "Коста-Рика", status: "inactive", lat: 9.9, lng: -84.1 },
  cuba: { name: "Куба", status: "inactive", lat: 22.0, lng: -80.0 },
  dominica: { name: "Доминика", status: "inactive", lat: 15.4, lng: -61.3 },
  dominican: { name: "Доминикана", status: "inactive", lat: 19.0, lng: -70.7 },
  el_salvador: { name: "Сальвадор", status: "inactive", lat: 13.8, lng: -88.9 },
  grenada: { name: "Гренада", status: "inactive", lat: 12.1, lng: -61.7 },
  guatemala: { name: "Гватемала", status: "inactive", lat: 15.8, lng: -90.2 },
  haiti: { name: "Гаити", status: "inactive", lat: 19.0, lng: -72.3 },
  honduras: { name: "Гондурас", status: "inactive", lat: 15.2, lng: -86.2 },
  jamaica: { name: "Ямайка", status: "inactive", lat: 18.1, lng: -77.3 },
  mexico: { name: "Мексика", status: "inactive", lat: 23.6, lng: -102.0 },
  nicaragua: { name: "Никарагуа", status: "inactive", lat: 12.8, lng: -85.2 },
  panama: { name: "Панама", status: "inactive", lat: 8.5, lng: -80.0 },
  trinidad: { name: "Тринидад", status: "inactive", lat: 10.7, lng: -61.3 },
  us: { name: "США", status: "medium", lat: 39.8, lng: -98.5 },

  // ЮЖНАЯ АМЕРИКА
  argentina: { name: "Аргентина", status: "inactive", lat: -38.4, lng: -63.6 },
  bolivia: { name: "Боливия", status: "inactive", lat: -16.3, lng: -63.6 },
  brazil: { name: "Бразилия", status: "inactive", lat: -14.2, lng: -51.9 },
  chile: { name: "Чили", status: "inactive", lat: -33.5, lng: -70.6 },
  colombia: { name: "Колумбия", status: "high", lat: 4.6, lng: -74.1 },
  ecuador: { name: "Эквадор", status: "inactive", lat: -1.8, lng: -78.2 },
  guyana: { name: "Гайана", status: "inactive", lat: 4.8, lng: -59.0 },
  paraguay: { name: "Парагвай", status: "inactive", lat: -23.4, lng: -58.4 },
  peru: { name: "Перу", status: "inactive", lat: -9.2, lng: -75.0 },
  suriname: { name: "Суринам", status: "inactive", lat: 3.9, lng: -56.0 },
  uruguay: { name: "Уругвай", status: "inactive", lat: -32.8, lng: -55.6 },
  venezuela: { name: "Венесуэла", status: "high", lat: 6.4, lng: -66.6 },

  // ОКЕАНИЯ
  australia: { name: "Австралия", status: "inactive", lat: -25.3, lng: 133.8 },
  fiji: { name: "Фиджи", status: "inactive", lat: -17.7, lng: 178.0 },
  kiribati: { name: "Кирибати", status: "inactive", lat: 0.0, lng: -160.0 },
  marshall: { name: "Маршаллы", status: "inactive", lat: 7.1, lng: 171.2 },
  micronesia: { name: "Микронезия", status: "inactive", lat: 6.9, lng: 158.2 },
  nauru: { name: "Науру", status: "inactive", lat: -0.5, lng: 166.9 },
  new_zealand: { name: "Новая Зеландия", status: "inactive", lat: -40.9, lng: 174.8 },
  palau: { name: "Палау", status: "inactive", lat: 7.5, lng: 134.6 },
  papua: { name: "Папуа-Новая Гвинея", status: "inactive", lat: -6.0, lng: 147.0 },
  samoa: { name: "Самоа", status: "inactive", lat: -13.8, lng: -172.0 },
  solomon: { name: "Соломоны", status: "inactive", lat: -9.6, lng: 160.0 },
  tonga: { name: "Тонга", status: "inactive", lat: -21.1, lng: -175.0 },
  tuvalu: { name: "Тувалу", status: "inactive", lat: -7.1, lng: 177.6 },
  vanuatu: { name: "Вануату", status: "inactive", lat: -15.4, lng: 166.8 }
};

// ============================================================
// 2. МАРКЕРЫ С ЛАЙЕРАМИ
// ============================================================

const MARKERS = [
  // СЛОЙ: Конфликты (conflict)
  { id: 1, name: "Конфликт в Украине", lat: 48.4, lng: 31.2, type: "conflict", status: "critical", layer: "conflict" },
  { id: 11, name: "Военный конфликт в Израиле", lat: 31.0, lng: 34.8, type: "conflict", status: "critical", layer: "conflict" },
  { id: 12, name: "Гуманитарный кризис в Судане", lat: 15.5, lng: 32.5, type: "humanitarian", status: "critical", layer: "conflict" },

  // СЛОЙ: Протесты (protest)
  { id: 2, name: "Протесты в Иране", lat: 35.7, lng: 51.4, type: "protest", status: "critical", layer: "protest" },
  { id: 13, name: "Протесты в Армении", lat: 40.2, lng: 45.0, type: "protest", status: "high", layer: "protest" },

  // СЛОЙ: Экономика (economy)
  { id: 5, name: "Экономический кризис", lat: 25.2, lng: 55.3, type: "economic", status: "medium", layer: "economy" },
  { id: 14, name: "Торговый конфликт США-Китай", lat: 35.0, lng: 105.0, type: "economic", status: "medium", layer: "economy" },
  { id: 9, name: "Санкции против России", lat: 55.0, lng: 37.0, type: "sanctions", status: "pre-war", layer: "economy" },

  // СЛОЙ: Военные (military)
  { id: 3, name: "Военные учения США", lat: 38.9, lng: -77.0, type: "military", status: "medium", layer: "military" },

  // СЛОЙ: Природа (disaster)
  { id: 4, name: "Землетрясение в Турции", lat: 37.0, lng: 35.3, type: "disaster", status: "high", layer: "disaster" },
  { id: 6, name: "Пожары в Сибири", lat: 60.0, lng: 90.0, type: "fire", status: "high", layer: "disaster" },
  { id: 7, name: "Наводнение в Пакистане", lat: 30.0, lng: 70.0, type: "disaster", status: "high", layer: "disaster" },

  // СЛОЙ: Кибер (cyber)
  { id: 8, name: "Кибератака на Европу", lat: 50.0, lng: 10.0, type: "cyber", status: "medium", layer: "cyber" },

  // СЛОЙ: Дипломатия (diplomacy)
  { id: 10, name: "Переговоры в Китае", lat: 35.0, lng: 105.0, type: "diplomacy", status: "low", layer: "diplomacy" }
];

// ============================================================
// 3. ОПИСАНИЕ СЛОЁВ
// ============================================================

const LAYERS = {
  all: { name: "Все", icon: "🌍", color: "#44ccff", active: true },
  conflict: { name: "Конфликты", icon: "⚔️", color: "#ef4444", active: true },
  protest: { name: "Протесты", icon: "✊", color: "#f97316", active: true },
  economy: { name: "Экономика", icon: "💰", color: "#eab308", active: true },
  military: { name: "Военные", icon: "🎯", color: "#f59e0b", active: true },
  disaster: { name: "Природа", icon: "🌋", color: "#22c55e", active: true },
  cyber: { name: "Кибер", icon: "💻", color: "#3b82f6", active: true },
  diplomacy: { name: "Дипломатия", icon: "🤝", color: "#a78bfa", active: true }
};

// ============================================================
// 4. СОХРАНЕНИЕ
// ============================================================

async function collectGeoData() {
  console.log('[Geo Collector] Запуск...');
  console.log(`  Стран: ${Object.keys(COUNTRIES).length}`);
  console.log(`  Маркеров: ${MARKERS.length}`);
  console.log(`  Слоёв: ${Object.keys(LAYERS).length}`);

  try {
    await fs.mkdir(BASKET_DIR, { recursive: true });

    const data = {
      timestamp: new Date().toISOString(),
      version: '2.0',
      countries: COUNTRIES,
      markers: MARKERS,
      layers: LAYERS,
      total_countries: Object.keys(COUNTRIES).length,
      total_markers: MARKERS.length,
      total_layers: Object.keys(LAYERS).length
    };

    await fs.writeFile(join(BASKET_DIR, 'geo-data.json'), JSON.stringify(data, null, 2));
    await fs.writeFile(join(BASKET_DIR, 'geo-countries.json'), JSON.stringify(COUNTRIES, null, 2));
    await fs.writeFile(join(BASKET_DIR, 'geo-markers.json'), JSON.stringify(MARKERS, null, 2));
    await fs.writeFile(join(BASKET_DIR, 'geo-layers.json'), JSON.stringify(LAYERS, null, 2));

    console.log('[Geo Collector] ✅ Данные сохранены:');
    console.log(`  - Стран: ${data.total_countries}`);
    console.log(`  - Маркеров: ${data.total_markers}`);
    console.log(`  - Слоёв: ${data.total_layers}`);

    return data;
  } catch (e) {
    console.error('[Geo Collector] Ошибка:', e);
    throw e;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  collectGeoData().catch(() => process.exit(1));
}

export { collectGeoData, COUNTRIES, MARKERS, LAYERS };
