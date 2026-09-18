// ============================================================
// DASHBOARD-CONFIG.JS — Универсальный конфиг для всех дашбордов
// ============================================================
// Используется в каждом дашборде для CARD_CONFIG
// ============================================================

// --- 1. КОМАНДНЫЙ ЦЕНТР (25 индикаторов) ---
export const COMMAND_CENTER = [
  { id: 'notam', number: '01', icon: '🛩️', name: 'NOTAM', source: 'ICAO', url: '/notam-monitor', api: '/api/notam/', key: 'id' },
  { id: 'gps', number: '02', icon: '📡', name: 'GPS-глушение', source: 'OpenSky', url: '/gps-jamming', api: '/api/gps-jamming/', key: 'id' },
  { id: 'trends', number: '03', icon: '📊', name: 'Google Trends', source: 'Google', url: '/google-trends', api: '/api/google-trends/', key: 'score' },
  { id: 'vix', number: '04', icon: '📈', name: 'VIX (страх)', source: 'CBOE', url: '/vix', api: '/api/vix/', key: 'value' },
  { id: 'yield', number: '05', icon: '📉', name: 'Кривая доходности', source: 'FRED', url: '/yield-curve', api: '/api/yield-curve/', key: 'spread' },
  { id: 'gold-oil', number: '06', icon: '💰', name: 'Золото/Нефть', source: 'FRED', url: '/gold-oil-ratio', api: '/api/gold-oil-ratio/', key: 'ratio' },
  { id: 'copper-gold', number: '07', icon: '🏗️', name: 'Медь/Золото', source: 'FRED', url: '/copper-gold', api: '/api/copper-gold/', key: 'ratio' },
  { id: 'bdi', number: '08', icon: '🚢', name: 'BDI', source: 'Baltic Ex.', url: '/bdi', api: '/api/bdi/', key: 'value' },
  { id: 'viirs', number: '09', icon: '🌃', name: 'Ночные огни', source: 'NASA', url: '/viirs', api: '/api/viirs/', key: 'value' },
  { id: 'uranium', number: '10', icon: '☢️', name: 'Уран', source: 'UxC', url: '/uranium', api: '/api/uranium/', key: 'value' },
  { id: 'big-mac', number: '11', icon: '🍔', name: 'Биг-Мак', source: 'Economist', url: '/big-mac', api: '/api/big-mac/', key: 'price' },
  { id: 'debt-gdp', number: '12', icon: '📊', name: 'ВВП/Долг', source: 'IMF', url: '/debt-gdp', api: '/api/debt-gdp/', key: 'value' },
  { id: 'sp500-vix', number: '13', icon: '📈', name: 'S&P/VIX', source: 'S&P', url: '/sp500-vix', api: '/api/sp500-vix/', key: 'ratio' },
  { id: 'crypto-fear', number: '14', icon: '📊', name: 'Крипто-страх', source: 'CoinMarketCap', url: '/crypto-fear', api: '/api/crypto-fear/', key: 'ratio' },
  { id: 'oil-gas', number: '15', icon: '🛢️', name: 'Нефть/Газ', source: 'EIA', url: '/oil-gas', api: '/api/oil-gas/', key: 'ratio' },
  { id: 'gold-silver', number: '16', icon: '💰', name: 'Золото/Серебро', source: 'FRED', url: '/gold-silver', api: '/api/gold-silver/', key: 'ratio' },
  { id: 'happiness', number: '17', icon: '😊', name: 'Индекс счастья', source: 'UN', url: '/happiness', api: '/api/happiness/', key: 'score' },
  { id: 'big-mac-alt', number: '18', icon: '🍔', name: 'Биг-Мак Alt', source: 'World Bank', url: '/big-mac-alt', api: '/api/big-mac-alt/', key: 'price' },
  { id: 'big-mac-main', number: '19', icon: '🍔', name: 'Биг-Мак (осн.)', source: 'Economist', url: '/big-mac-main', api: '/api/big-mac-main/', key: 'price' },
  { id: 'vxx', number: '20', icon: '📊', name: 'VXX (страх)', source: 'CBOE', url: '/vxx', api: '/api/vxx/', key: 'value' },
  { id: 'happiness-alt', number: '21', icon: '😊', name: 'Счастье Alt', source: 'WHO', url: '/happiness-alt', api: '/api/happiness-alt/', key: 'score' },
  { id: 'inflation', number: '22', icon: '📈', name: 'Инфляция', source: 'BLS', url: '/inflation', api: '/api/inflation/', key: 'value' },
  { id: 'unemployment', number: '23', icon: '📊', name: 'Безработица', source: 'BLS', url: '/unemployment', api: '/api/unemployment/', key: 'value' },
  { id: 'pmi', number: '24', icon: '🏭', name: 'PMI', source: 'S&P Global', url: '/pmi', api: '/api/pmi/', key: 'value' },
  { id: 'recession', number: '25', icon: '⚠️', name: 'Рецессия', source: 'ФРС', url: '/recession', api: '/api/recession/', key: 'value' }
];

// --- 2. ФИНАНСОВЫЙ ДАШБОРД (30 индикаторов) ---
export const FINANCIAL = [
  { id: 'vix', number: '01', icon: '📈', name: 'VIX (страх)', source: 'CBOE', url: '/vix', api: '/api/vix/', key: 'value' },
  { id: 'vxx', number: '02', icon: '📊', name: 'VXX (страх)', source: 'CBOE', url: '/vxx', api: '/api/vxx/', key: 'value' },
  { id: 'dxy', number: '03', icon: '💵', name: 'Индекс доллара', source: 'FRED', url: '/dxy', api: '/api/dxy/', key: 'value' },
  { id: 'ovx', number: '04', icon: '🛢️', name: 'OVX (нефть)', source: 'CBOE', url: '/ovx', api: '/api/ovx/', key: 'value' },
  { id: 'hy-spread', number: '05', icon: '📊', name: 'HY Spread', source: 'FRED', url: '/hy-spread', api: '/api/hy-spread/', key: 'value' },
  { id: 'gold-oil', number: '06', icon: '💰', name: 'Золото/Нефть', source: 'FRED', url: '/gold-oil-ratio', api: '/api/gold-oil-ratio/', key: 'ratio' },
  { id: 'copper-gold', number: '07', icon: '🏗️', name: 'Медь/Золото', source: 'FRED', url: '/copper-gold', api: '/api/copper-gold/', key: 'ratio' },
  { id: 'gold-silver', number: '08', icon: '💰', name: 'Золото/Серебро', source: 'FRED', url: '/gold-silver', api: '/api/gold-silver/', key: 'ratio' },
  { id: 'oil-gas', number: '09', icon: '🛢️', name: 'Нефть/Газ', source: 'EIA', url: '/oil-gas', api: '/api/oil-gas/', key: 'ratio' },
  { id: 'bdi', number: '10', icon: '🚢', name: 'BDI', source: 'Baltic Ex.', url: '/bdi', api: '/api/bdi/', key: 'value' },
  { id: 'uranium', number: '11', icon: '☢️', name: 'Уран', source: 'UxC', url: '/uranium', api: '/api/uranium/', key: 'value' },
  { id: 'crypto-fear', number: '12', icon: '📊', name: 'Крипто-страх', source: 'CoinMarketCap', url: '/crypto-fear', api: '/api/crypto-fear/', key: 'ratio' },
  { id: 'sp500-vix', number: '13', icon: '📈', name: 'S&P/VIX', source: 'S&P', url: '/sp500-vix', api: '/api/sp500-vix/', key: 'ratio' },
  { id: 'yield-curve', number: '14', icon: '📉', name: 'Кривая доходности', source: 'FRED', url: '/yield-curve', api: '/api/yield-curve/', key: 'spread' },
  { id: 'tips', number: '15', icon: '📉', name: 'Реальные ставки', source: 'FRED', url: '/tips', api: '/api/tips/', key: 'value' },
  { id: 'inflation', number: '16', icon: '📈', name: 'Инфляция', source: 'BLS', url: '/inflation', api: '/api/inflation/', key: 'value' },
  { id: 'unemployment', number: '17', icon: '📊', name: 'Безработица', source: 'BLS', url: '/unemployment', api: '/api/unemployment/', key: 'value' },
  { id: 'pmi', number: '18', icon: '🏭', name: 'PMI', source: 'S&P Global', url: '/pmi', api: '/api/pmi/', key: 'value' },
  { id: 'recession', number: '19', icon: '⚠️', name: 'Рецессия', source: 'ФРС', url: '/recession', api: '/api/recession/', key: 'value' },
  { id: 'debt-gdp', number: '20', icon: '📊', name: 'ВВП/Долг', source: 'IMF', url: '/debt-gdp', api: '/api/debt-gdp/', key: 'value' },
  { id: 'happiness', number: '21', icon: '😊', name: 'Индекс счастья', source: 'UN', url: '/happiness', api: '/api/happiness/', key: 'score' },
  { id: 'happiness-alt', number: '22', icon: '😊', name: 'Счастье Alt', source: 'WHO', url: '/happiness-alt', api: '/api/happiness-alt/', key: 'score' },
  { id: 'big-mac', number: '23', icon: '🍔', name: 'Биг-Мак', source: 'Economist', url: '/big-mac', api: '/api/big-mac/', key: 'price' },
  { id: 'big-mac-alt', number: '24', icon: '🍔', name: 'Биг-Мак Alt', source: 'World Bank', url: '/big-mac-alt', api: '/api/big-mac-alt/', key: 'price' },
  { id: 'big-mac-main', number: '25', icon: '🍔', name: 'Биг-Мак (осн.)', source: 'Economist', url: '/big-mac-main', api: '/api/big-mac-main/', key: 'price' },
  // Запасные (26-30) — дублируем ключевые индикаторы
  { id: 'vix-dup', number: '26', icon: '📈', name: 'VIX (альт.)', source: 'CBOE', url: '/vix', api: '/api/vix/', key: 'value' },
  { id: 'gold-oil-dup', number: '27', icon: '💰', name: 'Золото/Нефть (альт.)', source: 'FRED', url: '/gold-oil-ratio', api: '/api/gold-oil-ratio/', key: 'ratio' },
  { id: 'bdi-dup', number: '28', icon: '🚢', name: 'BDI (альт.)', source: 'Baltic Ex.', url: '/bdi', api: '/api/bdi/', key: 'value' },
  { id: 'uranium-dup', number: '29', icon: '☢️', name: 'Уран (альт.)', source: 'UxC', url: '/uranium', api: '/api/uranium/', key: 'value' },
  { id: 'inflation-dup', number: '30', icon: '📈', name: 'Инфляция (альт.)', source: 'BLS', url: '/inflation', api: '/api/inflation/', key: 'value' }
];

// --- 3. ВОЕННЫЙ ДАШБОРД (30 индикаторов) ---
export const MILITARY = [
  { id: 'notam', number: '01', icon: '🛩️', name: 'NOTAM', source: 'ICAO', url: '/notam-monitor', api: '/api/notam/', key: 'id' },
  { id: 'gps-jamming', number: '02', icon: '📡', name: 'GPS-глушение', source: 'OpenSky', url: '/gps-jamming', api: '/api/gps-jamming/', key: 'id' },
  { id: 'war-preparation', number: '03', icon: '⚔️', name: 'Подготовка к войне', source: 'OSINT', url: '/war-preparation', api: '/api/war-preparation/', key: 'value' },
  { id: 'nuclear-monitor', number: '04', icon: '☢️', name: 'Ядерный мониторинг', source: 'IAEA', url: '/nuclear-monitor', api: '/api/nuclear-monitor/', key: 'value' },
  { id: 'uranium', number: '05', icon: '☢️', name: 'Уран', source: 'UxC', url: '/uranium', api: '/api/uranium/', key: 'value' },
  { id: 'viirs', number: '06', icon: '🌃', name: 'Ночные огни (VIIRS)', source: 'NASA', url: '/viirs', api: '/api/viirs/', key: 'value' },
  { id: 'social-unrest', number: '07', icon: '👥', name: 'Социальная напряжённость', source: 'OSINT', url: '/social-unrest', api: '/api/social-unrest/', key: 'value' },
  { id: 'silence', number: '08', icon: '🔇', name: 'Информационная тишина', source: 'Crucix', url: '/silence', api: '/api/silence/', key: 'value' },
  // Запасные (09-30) — дублируем ключевые индикаторы
  { id: 'notam-dup', number: '09', icon: '🛩️', name: 'NOTAM (альт.)', source: 'ICAO', url: '/notam-monitor', api: '/api/notam/', key: 'id' },
  { id: 'gps-dup', number: '10', icon: '📡', name: 'GPS (альт.)', source: 'OpenSky', url: '/gps-jamming', api: '/api/gps-jamming/', key: 'id' },
  { id: 'war-dup', number: '11', icon: '⚔️', name: 'Подготовка (альт.)', source: 'OSINT', url: '/war-preparation', api: '/api/war-preparation/', key: 'value' },
  { id: 'nuclear-dup', number: '12', icon: '☢️', name: 'Ядерный (альт.)', source: 'IAEA', url: '/nuclear-monitor', api: '/api/nuclear-monitor/', key: 'value' },
  { id: 'uranium-dup', number: '13', icon: '☢️', name: 'Уран (альт.)', source: 'UxC', url: '/uranium', api: '/api/uranium/', key: 'value' },
  { id: 'viirs-dup', number: '14', icon: '🌃', name: 'VIIRS (альт.)', source: 'NASA', url: '/viirs', api: '/api/viirs/', key: 'value' },
  { id: 'social-dup', number: '15', icon: '👥', name: 'Социальная (альт.)', source: 'OSINT', url: '/social-unrest', api: '/api/social-unrest/', key: 'value' },
  { id: 'silence-dup', number: '16', icon: '🔇', name: 'Тишина (альт.)', source: 'Crucix', url: '/silence', api: '/api/silence/', key: 'value' },
  // Ещё запасные (17-30)
  { id: 'vix-mil', number: '17', icon: '📈', name: 'VIX (страх)', source: 'CBOE', url: '/vix', api: '/api/vix/', key: 'value' },
  { id: 'bdi-mil', number: '18', icon: '🚢', name: 'BDI', source: 'Baltic Ex.', url: '/bdi', api: '/api/bdi/', key: 'value' },
  { id: 'gold-oil-mil', number: '19', icon: '💰', name: 'Золото/Нефть', source: 'FRED', url: '/gold-oil-ratio', api: '/api/gold-oil-ratio/', key: 'ratio' },
  { id: 'copper-gold-mil', number: '20', icon: '🏗️', name: 'Медь/Золото', source: 'FRED', url: '/copper-gold', api: '/api/copper-gold/', key: 'ratio' },
  { id: 'inflation-mil', number: '21', icon: '📈', name: 'Инфляция', source: 'BLS', url: '/inflation', api: '/api/inflation/', key: 'value' },
  { id: 'unemployment-mil', number: '22', icon: '📊', name: 'Безработица', source: 'BLS', url: '/unemployment', api: '/api/unemployment/', key: 'value' },
  { id: 'pmi-mil', number: '23', icon: '🏭', name: 'PMI', source: 'S&P Global', url: '/pmi', api: '/api/pmi/', key: 'value' },
  { id: 'recession-mil', number: '24', icon: '⚠️', name: 'Рецессия', source: 'ФРС', url: '/recession', api: '/api/recession/', key: 'value' },
  { id: 'debt-gdp-mil', number: '25', icon: '📊', name: 'ВВП/Долг', source: 'IMF', url: '/debt-gdp', api: '/api/debt-gdp/', key: 'value' },
  { id: 'happiness-mil', number: '26', icon: '😊', name: 'Индекс счастья', source: 'UN', url: '/happiness', api: '/api/happiness/', key: 'score' },
  { id: 'happiness-alt-mil', number: '27', icon: '😊', name: 'Счастье Alt', source: 'WHO', url: '/happiness-alt', api: '/api/happiness-alt/', key: 'score' },
  { id: 'big-mac-mil', number: '28', icon: '🍔', name: 'Биг-Мак', source: 'Economist', url: '/big-mac', api: '/api/big-mac/', key: 'price' },
  { id: 'big-mac-alt-mil', number: '29', icon: '🍔', name: 'Биг-Мак Alt', source: 'World Bank', url: '/big-mac-alt', api: '/api/big-mac-alt/', key: 'price' },
  { id: 'big-mac-main-mil', number: '30', icon: '🍔', name: 'Биг-Мак (осн.)', source: 'Economist', url: '/big-mac-main', api: '/api/big-mac-main/', key: 'price' }
];

// --- 4. ЭКОНОМИЧЕСКИЙ ДАШБОРД (30 индикаторов) ---
export const ECONOMIC = [
  { id: 'inflation', number: '01', icon: '📈', name: 'Инфляция', source: 'BLS', url: '/inflation', api: '/api/inflation/', key: 'value' },
  { id: 'unemployment', number: '02', icon: '📊', name: 'Безработица', source: 'BLS', url: '/unemployment', api: '/api/unemployment/', key: 'value' },
  { id: 'pmi', number: '03', icon: '🏭', name: 'PMI', source: 'S&P Global', url: '/pmi', api: '/api/pmi/', key: 'value' },
  { id: 'recession', number: '04', icon: '⚠️', name: 'Рецессия', source: 'ФРС', url: '/recession', api: '/api/recession/', key: 'value' },
  { id: 'debt-gdp', number: '05', icon: '📊', name: 'ВВП/Долг', source: 'IMF', url: '/debt-gdp', api: '/api/debt-gdp/', key: 'value' },
  { id: 'big-mac', number: '06', icon: '🍔', name: 'Биг-Мак', source: 'Economist', url: '/big-mac', api: '/api/big-mac/', key: 'price' },
  { id: 'big-mac-alt', number: '07', icon: '🍔', name: 'Биг-Мак Alt', source: 'World Bank', url: '/big-mac-alt', api: '/api/big-mac-alt/', key: 'price' },
  { id: 'big-mac-main', number: '08', icon: '🍔', name: 'Биг-Мак (осн.)', source: 'Economist', url: '/big-mac-main', api: '/api/big-mac-main/', key: 'price' },
  { id: 'bdi', number: '09', icon: '🚢', name: 'BDI', source: 'Baltic Ex.', url: '/bdi', api: '/api/bdi/', key: 'value' },
  { id: 'gold-silver', number: '10', icon: '💰', name: 'Золото/Серебро', source: 'FRED', url: '/gold-silver', api: '/api/gold-silver/', key: 'ratio' },
  { id: 'happiness', number: '11', icon: '😊', name: 'Индекс счастья', source: 'UN', url: '/happiness', api: '/api/happiness/', key: 'score' },
  { id: 'happiness-alt', number: '12', icon: '😊', name: 'Счастье Alt', source: 'WHO', url: '/happiness-alt', api: '/api/happiness-alt/', key: 'score' },
  { id: 'dxy', number: '13', icon: '💵', name: 'Индекс доллара', source: 'FRED', url: '/dxy', api: '/api/dxy/', key: 'value' },
  { id: 'tips', number: '14', icon: '📉', name: 'Реальные ставки', source: 'FRED', url: '/tips', api: '/api/tips/', key: 'value' },
  { id: 'ovx', number: '15', icon: '🛢️', name: 'OVX (нефть)', source: 'CBOE', url: '/ovx', api: '/api/ovx/', key: 'value' },
  { id: 'hy-spread', number: '16', icon: '📊', name: 'HY Spread', source: 'FRED', url: '/hy-spread', api: '/api/hy-spread/', key: 'value' },
  { id: 'vix', number: '17', icon: '📈', name: 'VIX (страх)', source: 'CBOE', url: '/vix', api: '/api/vix/', key: 'value' },
  { id: 'yield-curve', number: '18', icon: '📉', name: 'Кривая доходности', source: 'FRED', url: '/yield-curve', api: '/api/yield-curve/', key: 'spread' },
  { id: 'gold-oil', number: '19', icon: '💰', name: 'Золото/Нефть', source: 'FRED', url: '/gold-oil-ratio', api: '/api/gold-oil-ratio/', key: 'ratio' },
  { id: 'copper-gold', number: '20', icon: '🏗️', name: 'Медь/Золото', source: 'FRED', url: '/copper-gold', api: '/api/copper-gold/', key: 'ratio' },
  { id: 'oil-gas', number: '21', icon: '🛢️', name: 'Нефть/Газ', source: 'EIA', url: '/oil-gas', api: '/api/oil-gas/', key: 'ratio' },
  { id: 'uranium', number: '22', icon: '☢️', name: 'Уран', source: 'UxC', url: '/uranium', api: '/api/uranium/', key: 'value' },
  { id: 'viirs', number: '23', icon: '🌃', name: 'Ночные огни', source: 'NASA', url: '/viirs', api: '/api/viirs/', key: 'value' },
  { id: 'vxx', number: '24', icon: '📊', name: 'VXX (страх)', source: 'CBOE', url: '/vxx', api: '/api/vxx/', key: 'value' },
  { id: 'sp500-vix', number: '25', icon: '📈', name: 'S&P/VIX', source: 'S&P', url: '/sp500-vix', api: '/api/sp500-vix/', key: 'ratio' },
  // Запасные (26-30)
  { id: 'crypto-fear-eco', number: '26', icon: '📊', name: 'Крипто-страх', source: 'CoinMarketCap', url: '/crypto-fear', api: '/api/crypto-fear/', key: 'ratio' },
  { id: 'social-unrest-eco', number: '27', icon: '👥', name: 'Социальная напряжённость', source: 'OSINT', url: '/social-unrest', api: '/api/social-unrest/', key: 'value' },
  { id: 'war-preparation-eco', number: '28', icon: '⚔️', name: 'Подготовка к войне', source: 'OSINT', url: '/war-preparation', api: '/api/war-preparation/', key: 'value' },
  { id: 'nuclear-monitor-eco', number: '29', icon: '☢️', name: 'Ядерный мониторинг', source: 'IAEA', url: '/nuclear-monitor', api: '/api/nuclear-monitor/', key: 'value' },
  { id: 'consumer-confidence-eco', number: '30', icon: '🛒', name: 'Потребительское доверие', source: 'FRED', url: '/consumer-confidence', api: '/api/consumer-confidence/', key: 'value' }
];
