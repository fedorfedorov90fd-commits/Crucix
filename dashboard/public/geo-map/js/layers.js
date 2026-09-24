// ============================================================
// LAYERS.JS — 195 СЛОЁВ, 18 КАТЕГОРИЙ
// ============================================================

console.log('📚 LAYERS.JS загружен');

const DEMO_LAYERS = [
    // === БАЗОВЫЕ СЛОИ ===
    { id: "timeline", name: "⏳ Временная шкала", color: "#44aaff", icon: "⏳", category: "intelligence", vizType: "marker" },
    { id: "animations", name: "🎬 Анимация изменений", color: "#ff66ff", icon: "🎬", category: "intelligence", vizType: "marker" },
    { id: "export-map", name: "📤 Экспорт карты", color: "#00cc88", icon: "📤", category: "intelligence", vizType: "marker" },
    { id: "geopolitical", name: "🌍 Geopolitical Risk", color: "#ff4444", icon: "🌍", category: "geopolitical", vizType: "marker" },
    { id: "military", name: "⚔️ Military", color: "#ff2200", icon: "⚔️", category: "military", vizType: "marker" },
    { id: "economic", name: "💹 Economic", color: "#00cc44", icon: "💹", category: "economics", vizType: "marker" },
    { id: "financial", name: "💰 Financial", color: "#ffcc00", icon: "💰", category: "finance", vizType: "marker" },
    { id: "energy", name: "⚡ Energy", color: "#ff8800", icon: "⚡", category: "energy", vizType: "marker" },
    { id: "space", name: "🚀 Space", color: "#8800ff", icon: "🚀", category: "space", vizType: "marker" },
    { id: "health", name: "🏥 Health", color: "#ff0066", icon: "🏥", category: "health", vizType: "marker" },
    { id: "social", name: "👥 Social", color: "#ff66ff", icon: "👥", category: "esg", vizType: "marker" },
    { id: "esg", name: "🌱 ESG", color: "#00ff88", icon: "🌱", category: "esg", vizType: "marker" },
    { id: "intelligence", name: "🧠 Intelligence", color: "#6600cc", icon: "🧠", category: "threats", vizType: "marker" },
    { id: "ssi", name: "📊 Индекс напряженности", color: "#ff6600", icon: "📈", category: "threats", vizType: "marker" },
    { id: "anomalies", name: "⚠️ Аномалии", color: "#ff00ff", icon: "🚨", category: "threats", vizType: "marker" },
    { id: "predict", name: "🔮 Прогноз атак", color: "#ff2200", icon: "⚠️", category: "threats", vizType: "marker" },
    { id: "hackernews", name: "Hacker News", color: "#ff6600", icon: "💬", category: "news", vizType: "marker" },
    { id: "mediacloud", name: "Media Cloud", color: "#00aaff", icon: "📡", category: "news", vizType: "marker" },
    { id: "opensky", name: "OpenSky Aviation", color: "#ffaa00", icon: "✈️", category: "transport", vizType: "marker" },
    { id: "cisa", name: "CISA Advisories", color: "#ff0000", icon: "🛡️", category: "cyber", vizType: "marker" },
    { id: "ofac", name: "OFAC Sanctions", color: "#990000", icon: "⚠️", category: "threats", vizType: "marker" },
    { id: "usgs", name: "USGS Earthquakes", color: "#ff8800", icon: "🌋", category: "ecological", vizType: "marker" },
    { id: "shodan", name: "Shodan Сканы", color: "#ff6600", icon: "🔍", category: "cyber", vizType: "marker" },
    { id: "github", name: "GitHub События", color: "#6e5494", icon: "🐙", category: "cyber", vizType: "marker" },
    { id: "reddit", name: "Reddit Обсуждения", color: "#ff4500", icon: "🤖", category: "news", vizType: "marker" },
    { id: "weather", name: "Погода", color: "#00aaff", icon: "🌤️", category: "ecological", vizType: "marker" },
    { id: "cve", name: "CVE Уязвимости", color: "#ff4444", icon: "🛡️", category: "cyber", vizType: "marker" },
    { id: "gdelt", name: "GDELT Новости", color: "#4d6bfe", icon: "📰", category: "news", vizType: "marker" },

    // === 1. ЭКОНОМИКА (economics) — 11 слоёв ===
    { id: 'inflation', name: 'Инфляция', color: '#ff8800', icon: '📈', category: 'economics', vizType: 'choropleth' },
    { id: 'unemployment', name: 'Безработица', color: '#ff4444', icon: '📊', category: 'economics', vizType: 'choropleth' },
    { id: 'gdp', name: 'ВВП', color: '#44dd88', icon: '📊', category: 'economics', vizType: 'choropleth' },
    { id: 'pmi', name: 'PMI', color: '#ff8800', icon: '📊', category: 'economics', vizType: 'choropleth' },
    { id: 'recession', name: 'Рецессия', color: '#ff4400', icon: '📊', category: 'economics', vizType: 'choropleth' },
    { id: 'trade-balance', name: 'Торговый баланс', color: '#ffaa00', icon: '📊', category: 'economics', vizType: 'choropleth' },
    { id: 'fred', name: 'FRED Экономика', color: '#44dd88', icon: '📊', category: 'economics', vizType: 'choropleth' },
    { id: 'bls', name: 'BLS Труд', color: '#ffcc44', icon: '📋', category: 'economics', vizType: 'choropleth' },
    { id: 'comtrade', name: 'Comtrade Торговля', color: '#44aaff', icon: '📊', category: 'economics', vizType: 'choropleth' },
    { id: 'debt-gdp', name: 'Долг/ВВП', color: '#ff4444', icon: '📊', category: 'economics', vizType: 'choropleth' },
    { id: 'consumer-confidence', name: 'Потребительское доверие', color: '#44ccff', icon: '📈', category: 'economics', vizType: 'choropleth' },

    // === 2. ФИНАНСЫ (finance) — 20 слоёв ===
    { id: 'vix', name: 'VIX (Индекс страха)', color: '#ff0000', icon: '📈', category: 'finance', vizType: 'marker' },
    { id: 'vxx', name: 'VXX (Волатильность)', color: '#ff44aa', icon: '📊', category: 'finance', vizType: 'marker' },
    { id: 'dxy', name: 'Индекс доллара DXY', color: '#00cc88', icon: '💵', category: 'finance', vizType: 'choropleth' },
    { id: 'tips', name: 'Реальные ставки TIPS', color: '#ff66aa', icon: '📊', category: 'finance', vizType: 'choropleth' },
    { id: 'ovx', name: 'Волатильность нефти OVX', color: '#ff6600', icon: '📊', category: 'finance', vizType: 'marker' },
    { id: 'hy-spread', name: 'Корпоративные спреды', color: '#ff4400', icon: '📊', category: 'finance', vizType: 'choropleth' },
    { id: 'bdi', name: 'BDI (Балтийский индекс)', color: '#0088ff', icon: '📊', category: 'finance', vizType: 'marker' },
    { id: 'copper-gold', name: 'Медь/Золото', color: '#cc8800', icon: '🏗️', category: 'finance', vizType: 'choropleth' },
    { id: 'gold-oil', name: 'Золото/Нефть', color: '#ffaa00', icon: '📈', category: 'finance', vizType: 'choropleth' },
    { id: 'gold-silver', name: 'Золото/Серебро', color: '#ffcc44', icon: '📈', category: 'finance', vizType: 'choropleth' },
    { id: 'crypto-fear', name: 'Крипто-страх', color: '#ff8800', icon: '📉', category: 'finance', vizType: 'marker' },
    { id: 'sp500-vix', name: 'S&P/VIX', color: '#44aaff', icon: '📊', category: 'finance', vizType: 'marker' },
    { id: 'yield-curve', name: 'Кривая доходности', color: '#ff44ff', icon: '📊', category: 'finance', vizType: 'choropleth' },
    { id: 'big-mac', name: 'Индекс Биг-Мак', color: '#ff6600', icon: '🍔', category: 'finance', vizType: 'choropleth' },
    { id: 'big-mac-alt', name: 'Биг-Мак (альт.)', color: '#ff8800', icon: '🍔', category: 'finance', vizType: 'choropleth' },
    { id: 'big-mac-main', name: 'Биг-Мак (осн.)', color: '#ffaa00', icon: '🍔', category: 'finance', vizType: 'choropleth' },
    { id: 'uranium', name: 'Цена урана', color: '#44ff44', icon: '☢️', category: 'finance', vizType: 'choropleth' },
    { id: 'gold-price', name: '🥇 Золото (цена)', color: '#ffd700', icon: '🥇', category: 'finance', vizType: 'marker' },
    { id: 'oil-price', name: '🛢️ Нефть (цена)', color: '#004400', icon: '🛢️', category: 'finance', vizType: 'marker' },
    { id: 'heatmap-risk', name: '🔥 Тепловая карта риска', color: '#ff2200', icon: '🔥', category: 'finance', vizType: 'marker' },

    // === 3. ВОЕННЫЙ (military) — 9 слоёв ===
    { id: 'conflict-zones', name: 'Зоны конфликтов', color: '#ff0000', icon: '🔥', category: 'military', vizType: 'marker' },
    { id: 'exercises', name: 'Военные учения', color: '#ffaa00', icon: '⚔️', category: 'military', vizType: 'marker' },
    { id: 'military-bases', name: 'Военные базы', color: '#ff4444', icon: '🏰', category: 'military', vizType: 'marker' },
    { id: 'military-exercises', name: 'Военные маневры', color: '#ff6600', icon: '⚔️', category: 'military', vizType: 'marker' },
    { id: 'military-spending', name: 'Военные расходы', color: '#ff4400', icon: '💰', category: 'military', vizType: 'choropleth' },
    { id: 'notam', name: 'NOTAM', color: '#ff4444', icon: '✈️', category: 'military', vizType: 'marker' },
    { id: 'nuclear-monitor', name: 'Ядерный мониторинг', color: '#ff00ff', icon: '☢️', category: 'military', vizType: 'marker' },
    { id: 'war-preparation', name: 'Индекс подготовки к войне', color: '#ff2200', icon: '⚔️', category: 'military', vizType: 'choropleth' },
    { id: 'gps-jamming', name: 'GPS-глушение', color: '#ff8800', icon: '📡', category: 'military', vizType: 'marker' },

    // === 4. ГЕОПОЛИТИКА (geopolitical) — 5 слоёв ===
    { id: 'acled', name: 'ACLED Конфликты', color: '#ff4444', icon: '⚔️', category: 'geopolitical', vizType: 'marker' },
    { id: 'gdelt-geo', name: 'GDELT События', color: '#ffaa00', icon: '📰', category: 'geopolitical', vizType: 'marker' },
    { id: 'social-unrest', name: 'Социальная напряженность', color: '#ff4400', icon: '👥', category: 'geopolitical', vizType: 'choropleth' },
    { id: 'corruption', name: 'Индекс коррупции', color: '#ff4444', icon: '💼', category: 'geopolitical', vizType: 'choropleth' },
    { id: 'democracy', name: 'Индекс демократии', color: '#44ccff', icon: '🗳️', category: 'geopolitical', vizType: 'choropleth' },

    // === 5. ЭКОЛОГИЯ (ecological) — 17 слоёв ===
    { id: 'air-quality', name: 'Качество воздуха', color: '#88aa44', icon: '🌫️', category: 'ecological', vizType: 'marker' },
    { id: 'climate', name: 'Климатические данные', color: '#44ccff', icon: '🌡️', category: 'ecological', vizType: 'marker' },
    { id: 'earthquakes', name: 'Землетрясения USGS', color: '#ff8800', icon: '🌍', category: 'ecological', vizType: 'marker' },
    { id: 'fires', name: 'Пожары FIRMS', color: '#ff4400', icon: '🔥', category: 'ecological', vizType: 'marker' },
    { id: 'firms', name: 'FIRMS Пожары', color: '#ff4400', icon: '🔥', category: 'ecological', vizType: 'marker' },
    { id: 'floods', name: 'Наводнения', color: '#44aaff', icon: '🌊', category: 'ecological', vizType: 'marker' },
    { id: 'forests', name: 'Леса', color: '#22aa44', icon: '🌲', category: 'ecological', vizType: 'marker' },
    { id: 'noaa', name: 'NOAA Погода', color: '#00ccff', icon: '☁️', category: 'ecological', vizType: 'marker' },
    { id: 'ocean', name: 'Океанические данные', color: '#0044ff', icon: '🌊', category: 'ecological', vizType: 'marker' },
    { id: 'safecast', name: 'Safecast Радиация', color: '#ff00ff', icon: '☢️', category: 'ecological', vizType: 'marker' },
    { id: 'thermal', name: 'Термальные данные', color: '#ff6600', icon: '🌡️', category: 'ecological', vizType: 'marker' },
    { id: 'usgs-eco', name: 'USGS Землетрясения', color: '#ff6600', icon: '🌍', category: 'ecological', vizType: 'marker' },
    { id: 'viirs', name: 'Ночные огни VIIRS', color: '#ffff44', icon: '🌃', category: 'ecological', vizType: 'marker' },
    { id: 'agriculture', name: 'Сельское хозяйство', color: '#44cc44', icon: '🌾', category: 'ecological', vizType: 'marker' },
    { id: 'drought', name: 'Засуха', color: '#ffaa00', icon: '☀️', category: 'ecological', vizType: 'marker' },
    { id: 'volcanoes', name: 'Вулканы', color: '#ff4400', icon: '🌋', category: 'ecological', vizType: 'marker' },
    { id: 'wildfires', name: 'Лесные пожары', color: '#ff2200', icon: '🔥', category: 'ecological', vizType: 'marker' },

    // === 6. КИБЕР (cyber) — 9 слоёв ===
    { id: 'botnets', name: 'Ботнеты', color: '#ff6600', icon: '🤖', category: 'cyber', vizType: 'marker' },
    { id: 'cisa-cyber', name: 'CISA Киберугрозы', color: '#44ccff', icon: '🛡️', category: 'cyber', vizType: 'marker' },
    { id: 'cve-cyber', name: 'Уязвимости CVE', color: '#ffaa00', icon: '🔓', category: 'cyber', vizType: 'choropleth' },
    { id: 'cyber-attacks', name: 'Кибератаки', color: '#ff0044', icon: '💻', category: 'cyber', vizType: 'marker' },
    { id: 'darkweb', name: 'Даркнет', color: '#4400ff', icon: '🌐', category: 'cyber', vizType: 'marker' },
    { id: 'ddos', name: 'DDoS атаки', color: '#ff4400', icon: '💥', category: 'cyber', vizType: 'marker' },
    { id: 'malware', name: 'Вредоносы', color: '#ff2200', icon: '💻', category: 'cyber', vizType: 'marker' },
    { id: 'phishing', name: 'Фишинговые сайты', color: '#ff8800', icon: '🎣', category: 'cyber', vizType: 'marker' },
    { id: 'ransomware', name: 'Ransomware атаки', color: '#ff0044', icon: '💻', category: 'cyber', vizType: 'marker' },

    // === 7. КОСМОС (space) — 7 слоёв ===
    { id: 'aurora', name: 'Полярное сияние', color: '#44ffaa', icon: '✨', category: 'space', vizType: 'marker' },
    { id: 'oneweb', name: 'OneWeb', color: '#44aaff', icon: '🛰️', category: 'space', vizType: 'marker' },
    { id: 'satellites', name: 'Спутники', color: '#88ccff', icon: '🛰️', category: 'space', vizType: 'marker' },
    { id: 'space-data', name: 'Космические данные', color: '#aa44ff', icon: '🚀', category: 'space', vizType: 'marker' },
    { id: 'space-debris', name: 'Космический мусор', color: '#ff4444', icon: '🛰️', category: 'space', vizType: 'marker' },
    { id: 'starlink', name: 'Starlink', color: '#44ff44', icon: '🛰️', category: 'space', vizType: 'marker' },
    { id: 'spaceports', name: 'Космодромы', color: '#ff44ff', icon: '🚀', category: 'space', vizType: 'marker' },

    // === 8. НОВОСТИ (news) — 7 слоёв ===
    { id: 'bbc', name: 'BBC News', color: '#44aaff', icon: '📰', category: 'news', vizType: 'marker' },
    { id: 'gdelt-news', name: 'GDELT Новости', color: '#ffaa00', icon: '📰', category: 'news', vizType: 'marker' },
    { id: 'google-trends', name: 'Google Trends', color: '#ff8800', icon: '📊', category: 'news', vizType: 'choropleth' },
    { id: 'interfax', name: 'Интерфакс', color: '#ff8800', icon: '📰', category: 'news', vizType: 'marker' },
    { id: 'ria', name: 'РИА Новости', color: '#ff6600', icon: '📰', category: 'news', vizType: 'marker' },
    { id: 'rss', name: 'RSS Новости', color: '#44aaff', icon: '📰', category: 'news', vizType: 'marker' },
    { id: 'tass', name: 'ТАСС Новости', color: '#ff4444', icon: '📰', category: 'news', vizType: 'marker' },

    // === 9. ESG (esg) — 15 слоёв ===
    { id: 'happiness', name: 'Индекс счастья', color: '#44ff44', icon: '😊', category: 'esg', vizType: 'choropleth' },
    { id: 'happiness-alt', name: 'Индекс счастья (альт.)', color: '#88ff44', icon: '😊', category: 'esg', vizType: 'choropleth' },
    { id: 'population', name: 'Плотность населения', color: '#ff8844', icon: '👥', category: 'esg', vizType: 'choropleth' },
    { id: 'refugees', name: 'Беженцы', color: '#ffaa44', icon: '🧳', category: 'esg', vizType: 'choropleth' },
    { id: 'urbanization', name: 'Урбанизация', color: '#44aaff', icon: '🏙️', category: 'esg', vizType: 'choropleth' },
    { id: 'humanitarian', name: 'Гуманитарная помощь', color: '#44cc44', icon: '🤝', category: 'esg', vizType: 'marker' },
    { id: 'who', name: 'WHO Здравоохранение', color: '#ff44aa', icon: '🏥', category: 'esg', vizType: 'choropleth' },
    { id: 'covid', name: 'COVID-19', color: '#ff0000', icon: '🦠', category: 'esg', vizType: 'choropleth' },
    { id: 'healthcare', name: 'Здравоохранение', color: '#ff44aa', icon: '🏥', category: 'esg', vizType: 'choropleth' },
    { id: 'education', name: 'Образование', color: '#44ff88', icon: '📚', category: 'esg', vizType: 'choropleth' },
    { id: 'freedom', name: 'Индекс свободы', color: '#44ff44', icon: '🕊️', category: 'esg', vizType: 'choropleth' },
    { id: 'hdi', name: 'Индекс человеческого развития', color: '#44cc44', icon: '📈', category: 'esg', vizType: 'choropleth' },
    { id: 'inequality', name: 'Неравенство', color: '#ff8800', icon: '📊', category: 'esg', vizType: 'choropleth' },
    { id: 'poverty', name: 'Бедность', color: '#ff4444', icon: '📊', category: 'esg', vizType: 'choropleth' },
    { id: 'press-freedom', name: 'Свобода прессы', color: '#44ccff', icon: '📰', category: 'esg', vizType: 'choropleth' },

    // === 10. УГРОЗЫ (threats) — 7 слоёв ===
    { id: 'cyber-attacks-threat', name: 'Кибератаки', color: '#ff0044', icon: '💻', category: 'threats', vizType: 'marker' },
    { id: 'ddos-threat', name: 'DDoS атаки', color: '#ff4400', icon: '💥', category: 'threats', vizType: 'marker' },
    { id: 'malware-threat', name: 'Вредоносы', color: '#ff2200', icon: '💻', category: 'threats', vizType: 'marker' },
    { id: 'phishing-threat', name: 'Фишинг', color: '#ff8800', icon: '🎣', category: 'threats', vizType: 'marker' },
    { id: 'ransomware-threat', name: 'Ransomware', color: '#ff0044', icon: '💻', category: 'threats', vizType: 'marker' },
    { id: 'cve-threat', name: 'Уязвимости CVE', color: '#ffaa00', icon: '🔓', category: 'threats', vizType: 'choropleth' },
    { id: 'botnets-threat', name: 'Ботнеты', color: '#ff6600', icon: '🤖', category: 'threats', vizType: 'marker' },

    // === 11. ЗДОРОВЬЕ (health) — 4 слоя ===
    { id: 'who-health', name: 'WHO Здравоохранение', color: '#ff44aa', icon: '🏥', category: 'health', vizType: 'choropleth' },
    { id: 'covid-health', name: 'COVID-19', color: '#ff0000', icon: '🦠', category: 'health', vizType: 'choropleth' },
    { id: 'healthcare-health', name: 'Здравоохранение', color: '#ff44aa', icon: '🏥', category: 'health', vizType: 'choropleth' },
    { id: 'epidemics', name: 'Эпидемии', color: '#ff4400', icon: '🦠', category: 'health', vizType: 'marker' },

    // === 12. ЭНЕРГЕТИКА (energy) — 8 слоёв ===
    { id: 'energy-grid', name: 'Энергосети', color: '#ffcc00', icon: '⚡', category: 'energy', vizType: 'marker' },
    { id: 'eia', name: 'EIA Энергетика', color: '#ff6600', icon: '⛽', category: 'energy', vizType: 'choropleth' },
    { id: 'nuclear', name: 'Атомная энергетика', color: '#ff44ff', icon: '☢️', category: 'energy', vizType: 'choropleth' },
    { id: 'renewable', name: 'Возобновляемая энергия', color: '#44ff44', icon: '☀️', category: 'energy', vizType: 'choropleth' },
    { id: 'oil-gas', name: 'Нефть/Газ', color: '#ff8800', icon: '⛽', category: 'energy', vizType: 'choropleth' },
    { id: 'pipelines', name: 'Трубопроводы', color: '#ffaa00', icon: '🏗️', category: 'energy', vizType: 'marker' },
    { id: 'power-grid', name: 'Электросети', color: '#ffcc00', icon: '⚡', category: 'energy', vizType: 'marker' },
    { id: 'oil-energy', name: '🛢️ Нефть (энерг.)', color: '#004400', icon: '🛢️', category: 'energy', vizType: 'marker' },

    // === 13. ТРАНСПОРТ (transport) — 10 слоёв ===
    { id: 'aviation', name: 'Авиация', color: '#ff6600', icon: '✈️', category: 'transport', vizType: 'marker' },
    { id: 'opensky-transport', name: 'OpenSky Авиация', color: '#44ccff', icon: '✈️', category: 'transport', vizType: 'marker' },
    { id: 'ships', name: 'Суда (AIS)', color: '#00aaff', icon: '🚢', category: 'transport', vizType: 'marker' },
    { id: 'shipping-lanes', name: 'Морские маршруты', color: '#44aaff', icon: '🚢', category: 'transport', vizType: 'marker' },
    { id: 'shipping-route', name: 'Морские пути (дет.)', color: '#0066ff', icon: '🚢', category: 'transport', vizType: 'marker' },
    { id: 'ports', name: 'Порты', color: '#44cc44', icon: '⚓', category: 'transport', vizType: 'marker' },
    { id: 'ports-maritime', name: 'Морские порты', color: '#44cc44', icon: '⚓', category: 'transport', vizType: 'marker' },
    { id: 'railways', name: 'Железные дороги', color: '#888888', icon: '🚂', category: 'transport', vizType: 'marker' },
    { id: 'highways', name: 'Автомагистрали', color: '#ff8800', icon: '🛣️', category: 'transport', vizType: 'marker' },
    { id: 'maritime', name: 'Морские данные', color: '#44aaff', icon: '🚢', category: 'transport', vizType: 'marker' },

    // === 14. ДРУГИЕ (other) — 8 слоёв ===
    { id: 'cables_34', name: 'Подводные кабели', color: '#00ddff', icon: '🌊', category: 'other', vizType: 'marker' },
    { id: 'datacenters', name: 'Дата-центры', color: '#44aaff', icon: '🏢', category: 'other', vizType: 'marker' },
    { id: 'exchanges', name: 'Фондовые биржи', color: '#44dd88', icon: '🏛️', category: 'other', vizType: 'marker' },
    { id: 'undersea-cables', name: 'Подводные кабели связи', color: '#00ccff', icon: '🌊', category: 'other', vizType: 'marker' },
    { id: 'dark-ships', name: 'Тёмные суда', color: '#ff2200', icon: '🚢', category: 'other', vizType: 'marker' },
    { id: 'fleet', name: 'Военные корабли', color: '#ff4444', icon: '🚢', category: 'other', vizType: 'marker' },
    { id: 'internet', name: 'Интернет-доступ', color: '#44aaff', icon: '🌐', category: 'other', vizType: 'choropleth' },
    { id: 'mobile', name: 'Мобильная связь', color: '#44cc44', icon: '📱', category: 'other', vizType: 'choropleth' },

    // === 15. НОВЫЕ СЛОИ (Crucix) — 6 слоёв ===
    { id: 'map-layer-economy', name: 'Экономические зоны', color: '#44dd88', icon: '🏭', category: 'economics', vizType: 'marker' },
    { id: 'map-layer-energy', name: 'Энергетические потоки', color: '#ffcc00', icon: '⚡', category: 'energy', vizType: 'marker' },
    { id: 'map-layer-cyber', name: 'Киберугрозы', color: '#ff0044', icon: '💻', category: 'cyber', vizType: 'marker' },
    { id: 'map-layer-social', name: 'Социальная напряжённость', color: '#ff4400', icon: '👥', category: 'geopolitical', vizType: 'marker' },
    { id: 'map-layer-sanctions', name: 'Санкционные зоны', color: '#ff00ff', icon: '⛔', category: 'geopolitical', vizType: 'marker' },
    { id: 'map-layer-military-zones', name: 'Военные зоны', color: '#ff2200', icon: '🛡️', category: 'military', vizType: 'marker' },

    // ============================================================
    // === ПАЛАНТИР — 64 СЛОЯ, 8 КАТЕГОРИЙ (заглушки) ===
    // === Crucix Gotham Structure Recreation ===
    // ============================================================

    // --- 1. РАЗВЕДКА (intelligence) — 12 слоёв ---
    { id: 'crucix-radar', name: '🎯 Радиолокационная разведка', color: '#ff4400', icon: '📡', category: 'intelligence', vizType: 'marker', crucix: true },
    { id: 'crucix-satellite-recon', name: '🛰️ Спутниковая разведка', color: '#4444ff', icon: '🛰️', category: 'intelligence', vizType: 'marker', crucix: true },
    { id: 'crucix-sigint', name: '📻 Радиоразведка (SIGINT)', color: '#ff00aa', icon: '📻', category: 'intelligence', vizType: 'marker', crucix: true },
    { id: 'crucix-humint', name: '👤 Агентурная разведка', color: '#880044', icon: '🕵️', category: 'intelligence', vizType: 'marker', crucix: true },
    { id: 'crucix-osint', name: '🌐 Открытые источники (OSINT)', color: '#0088ff', icon: '🌐', category: 'intelligence', vizType: 'marker', crucix: true },
    { id: 'crucix-imint', name: '📸 Видеоразведка (IMINT)', color: '#ff8800', icon: '📸', category: 'intelligence', vizType: 'marker', crucix: true },
    { id: 'crucix-masint', name: '🔬 Измерительная разведка', color: '#aa00ff', icon: '🔬', category: 'intelligence', vizType: 'marker', crucix: true },
    { id: 'crucix-geoint', name: '🗺️ Геопространственная разведка', color: '#0044aa', icon: '🗺️', category: 'intelligence', vizType: 'marker', crucix: true },
    { id: 'crucix-electronic-warfare', name: '⚡ Радиоэлектронная борьба', color: '#ff2200', icon: '⚡', category: 'intelligence', vizType: 'marker', crucix: true },
    { id: 'crucix-drone-recon', name: '🛩️ Разведка БПЛА', color: '#ff6600', icon: '🛩️', category: 'intelligence', vizType: 'marker', crucix: true },
    { id: 'crucix-communication-intercept', name: '📡 Перехват коммуникаций', color: '#ff00ff', icon: '📡', category: 'intelligence', vizType: 'marker', crucix: true },
    { id: 'crucix-pattern-life', name: '📊 Шаблоны поведения', color: '#4466ff', icon: '📊', category: 'intelligence', vizType: 'choropleth', crucix: true },

    // --- 2. ВОЕННЫЙ (military) — 11 слоёв ---
    { id: 'crucix-units', name: '🎯 Воинские подразделения', color: '#ff0000', icon: '🎯', category: 'military', vizType: 'marker', crucix: true },
    { id: 'crucix-equipment', name: '🚙 Военная техника', color: '#ff4400', icon: '🚙', category: 'military', vizType: 'marker', crucix: true },
    { id: 'crucix-personnel', name: '👥 Личный состав', color: '#ff6600', icon: '👥', category: 'military', vizType: 'marker', crucix: true },
    { id: 'crucix-bases', name: '🏰 Военные базы', color: '#ff4444', icon: '🏰', category: 'military', vizType: 'marker', crucix: true },
    { id: 'crucix-movements', name: '📍 Перемещения войск', color: '#ff8800', icon: '📍', category: 'military', vizType: 'marker', crucix: true },
    { id: 'crucix-supply-lines', name: '🚛 Линии снабжения', color: '#ffaa00', icon: '🚛', category: 'military', vizType: 'marker', crucix: true },
    { id: 'crucix-air-defense', name: '🛡️ ПВО', color: '#ff2200', icon: '🛡️', category: 'military', vizType: 'marker', crucix: true },
    { id: 'crucix-naval', name: '🚢 Военно-морские силы', color: '#0044ff', icon: '🚢', category: 'military', vizType: 'marker', crucix: true },
    { id: 'crucix-aviation-mil', name: '✈️ Военная авиация', color: '#ff4400', icon: '✈️', category: 'military', vizType: 'marker', crucix: true },
    { id: 'crucix-missile', name: '🚀 Ракетные системы', color: '#ff0000', icon: '🚀', category: 'military', vizType: 'marker', crucix: true },
    { id: 'crucix-target-list', name: '🎯 Список целей (Target Workbench)', color: '#ff0044', icon: '🎯', category: 'military', vizType: 'marker', crucix: true },

    // --- 3. КИБЕР (cyber) — 8 слоёв ---
    { id: 'crucix-cyber-nodes', name: '🖥️ Сетевые узлы', color: '#44aaff', icon: '🖥️', category: 'cyber', vizType: 'marker', crucix: true },
    { id: 'crucix-cyber-links', name: '🔗 Сетевые связи', color: '#0088ff', icon: '🔗', category: 'cyber', vizType: 'marker', crucix: true },
    { id: 'crucix-cyber-attacks', name: '💻 Кибератаки', color: '#ff0044', icon: '💻', category: 'cyber', vizType: 'marker', crucix: true },
    { id: 'crucix-cyber-infrastructure', name: '🏗️ Киберинфраструктура', color: '#4466ff', icon: '🏗️', category: 'cyber', vizType: 'marker', crucix: true },
    { id: 'crucix-cyber-anomalies', name: '⚠️ Сетевые аномалии', color: '#ff8800', icon: '⚠️', category: 'cyber', vizType: 'marker', crucix: true },
    { id: 'crucix-cyber-attribution', name: '🕵️ Атрибуция атак', color: '#aa00ff', icon: '🕵️', category: 'cyber', vizType: 'marker', crucix: true },
    { id: 'crucix-cyber-scan', name: '🔍 Сканирование сети', color: '#ff6600', icon: '🔍', category: 'cyber', vizType: 'marker', crucix: true },
    { id: 'crucix-cyber-darkweb', name: '🕸️ Даркнет-активность', color: '#4400ff', icon: '🕸️', category: 'cyber', vizType: 'marker', crucix: true },

    // --- 4. КОСМОС (space) — 6 слоёв ---
    { id: 'crucix-satellites', name: '🛰️ Спутники (реальное время)', color: '#44aaff', icon: '🛰️', category: 'space', vizType: 'marker', crucix: true },
    { id: 'crucix-orbits', name: '🌐 Орбитальные треки', color: '#88ccff', icon: '🌐', category: 'space', vizType: 'marker', crucix: true },
    { id: 'crucix-space-debris', name: '🛰️ Космический мусор', color: '#888888', icon: '🛰️', category: 'space', vizType: 'marker', crucix: true },
    { id: 'crucix-space-launch', name: '🚀 Пуски ракет', color: '#ff4400', icon: '🚀', category: 'space', vizType: 'marker', crucix: true },
    { id: 'crucix-gps-jamming', name: '📡 GPS-глушение', color: '#ff0000', icon: '📡', category: 'space', vizType: 'marker', crucix: true },
    { id: 'crucix-space-weather', name: '🌞 Космическая погода', color: '#ffaa00', icon: '🌞', category: 'space', vizType: 'marker', crucix: true },

    // --- 5. КРИТИЧЕСКАЯ ИНФРАСТРУКТУРА (infrastructure) — 10 слоёв ---
    { id: 'crucix-power-grid', name: '⚡ Электросети', color: '#ffcc00', icon: '⚡', category: 'infrastructure', vizType: 'marker', crucix: true },
    { id: 'crucix-pipelines', name: '🛢️ Трубопроводы', color: '#ff8800', icon: '🛢️', category: 'infrastructure', vizType: 'marker', crucix: true },
    { id: 'crucix-datacenters', name: '🏢 Дата-центры', color: '#44aaff', icon: '🏢', category: 'infrastructure', vizType: 'marker', crucix: true },
    { id: 'crucix-undersea-cables', name: '🌊 Подводные кабели', color: '#00aaff', icon: '🌊', category: 'infrastructure', vizType: 'marker', crucix: true },
    { id: 'crucix-telecom', name: '📡 Телекоммуникации', color: '#44ccff', icon: '📡', category: 'infrastructure', vizType: 'marker', crucix: true },
    { id: 'crucix-transport-hub', name: '🚂 Транспортные узлы', color: '#ff8800', icon: '🚂', category: 'infrastructure', vizType: 'marker', crucix: true },
    { id: 'crucix-ports-infra', name: '⚓ Порты', color: '#44cc44', icon: '⚓', category: 'infrastructure', vizType: 'marker', crucix: true },
    { id: 'crucix-airports', name: '✈️ Аэропорты', color: '#ffaa00', icon: '✈️', category: 'infrastructure', vizType: 'marker', crucix: true },
    { id: 'crucix-water-systems', name: '💧 Водоснабжение', color: '#0088ff', icon: '💧', category: 'infrastructure', vizType: 'marker', crucix: true },
    { id: 'crucix-nuclear-facilities', name: '☢️ Ядерные объекты', color: '#ff00ff', icon: '☢️', category: 'infrastructure', vizType: 'marker', crucix: true },

    // --- 6. ФИНАНСЫ И САНКЦИИ (finance) — 6 слоёв ---
    { id: 'crucix-fin-flows', name: '💸 Финансовые потоки', color: '#44dd88', icon: '💸', category: 'finance', vizType: 'marker', crucix: true },
    { id: 'crucix-sanctions', name: '⛔ Санкционные списки', color: '#ff00ff', icon: '⛔', category: 'finance', vizType: 'marker', crucix: true },
    { id: 'crucix-crypto-trace', name: '₿ Отслеживание крипты', color: '#ffaa00', icon: '₿', category: 'finance', vizType: 'marker', crucix: true },
    { id: 'crucix-shell-companies', name: '🏢 Фирмы-однодневки', color: '#ff4400', icon: '🏢', category: 'finance', vizType: 'marker', crucix: true },
    { id: 'crucix-banking', name: '🏦 Банковская активность', color: '#44cc44', icon: '🏦', category: 'finance', vizType: 'choropleth', crucix: true },
    { id: 'crucix-trade-routes', name: '📦 Торговые маршруты', color: '#0088ff', icon: '📦', category: 'finance', vizType: 'marker', crucix: true },

    // --- 7. СОЦИАЛЬНЫЕ И ДЕМОГРАФИЯ (social) — 6 слоёв ---
    { id: 'crucix-population-flow', name: '👥 Перемещение населения', color: '#ff8844', icon: '👥', category: 'social', vizType: 'choropleth', crucix: true },
    { id: 'crucix-refugees', name: '🧳 Беженцы', color: '#ffaa44', icon: '🧳', category: 'social', vizType: 'choropleth', crucix: true },
    { id: 'crucix-social-unrest', name: '🔥 Социальная напряжённость', color: '#ff4400', icon: '🔥', category: 'social', vizType: 'marker', crucix: true },
    { id: 'crucix-phone-activity', name: '📱 Активность телефонов', color: '#44ccff', icon: '📱', category: 'social', vizType: 'choropleth', crucix: true },
    { id: 'crucix-border-crossings', name: '🛂 Пограничные переходы', color: '#ff8800', icon: '🛂', category: 'social', vizType: 'marker', crucix: true },
    { id: 'crucix-media-narrative', name: '📰 Медиа-нарративы', color: '#4d6bfe', icon: '📰', category: 'social', vizType: 'marker', crucix: true },

    { id: 'country-instability', name: 'Индекс нестабильности стран', color: '#ff2200', icon: '🌍', category: 'geopolitical', vizType: 'choropleth' },

    { id: 'resilience-index', name: 'Индекс устойчивости стран', color: '#00cc66', icon: '🛡️', category: 'geopolitical', vizType: 'choropleth' },

    // --- 8. ЭКОЛОГИЯ И АНОМАЛИИ (ecological) — 5 слоёв ---
    { id: 'crucix-earthquakes', name: '🌋 Землетрясения', color: '#ff8800', icon: '🌋', category: 'ecological', vizType: 'marker', crucix: true },
    { id: 'crucix-fires', name: '🔥 Пожары', color: '#ff4400', icon: '🔥', category: 'ecological', vizType: 'marker', crucix: true },
    { id: 'crucix-floods', name: '🌊 Наводнения', color: '#0044ff', icon: '🌊', category: 'ecological', vizType: 'marker', crucix: true },
    { id: 'crucix-anomalies-geo', name: '⚠️ Геоаномалии', color: '#ff00ff', icon: '⚠️', category: 'ecological', vizType: 'marker', crucix: true },
    { id: 'crucix-weather', name: '🌤️ Погодные условия', color: '#44aaff', icon: '🌤️', category: 'ecological', vizType: 'marker', crucix: true }
  ,
  {
    id: 'strategic-risk-composite',
    name: 'Стратегический риск',
    nameEn: 'Strategic Risk',
    color: '#dc2626',
    icon: '🎯',
    category: 'geopolitical',
    vizType: 'choropleth',
    description: 'Композитный стратегический риск: инстабильность + дефицит устойчивости + инфраструктура + геополитика',
    apiPath: '/api/layers/strategic-risk-composite/featurecollection',
    weight: 100
  }
];

window.allLayers = DEMO_LAYERS.map((l, idx) => ({ ...l, number: String(idx + 1).padStart(2, '0') }));

console.log('✅ Загружено слоёв:', window.allLayers.length);

// ============================================================
// ПАНЕЛЬ СЛОЁВ
// ============================================================

function toggleLayerPanel() {
    const panel = document.getElementById('layer-panel');
    const container = document.getElementById('map-container');
    const toggleBtn = document.getElementById('panel-toggle-btn');
    if (!panel || !container || !toggleBtn) return;
    const isVisible = !panel.classList.contains('collapsed');
    panel.classList.toggle('collapsed', isVisible);
    container.classList.toggle('full', isVisible);
    toggleBtn.classList.toggle('visible', isVisible);
    setTimeout(() => { if (window.map) window.map.invalidateSize(); }, 300);
}

async function enableAllLayers() {
    document.querySelectorAll('.layer-btn').forEach(btn => {
        const id = btn.dataset.layerId;
        if (id && id !== 'all') {
            window.activeLayerIds.add(id);
            btn.classList.add('active');
        }
    });
    updateActiveCount();

    const layers = (window.allLayers || []).filter(l => l.id !== 'all');
    let ok = 0, empty = 0, fail = 0;
    const total = layers.length;

    if (typeof window.showNotification === 'function') {
        window.showNotification('🌍 Загрузка ' + total + ' слоёв...');
    }

    for (const layer of layers) {
        if (window.layerCache && window.layerCache[layer.id] &&
            window.layerCache[layer.id].length > 0) {
            ok++;
            continue;
        }
        try {
            await loadLayer(layer.id);
            const after = window.layerCache ? window.layerCache[layer.id] : null;
            if (after && after.length > 0) ok++;
            else if (after && after.length === 0) empty++;
            else fail++;
        } catch (e) {
            fail++;
            console.warn('[enableAllLayers] Ошибка слоя ' + layer.id + ':', e.message);
        }
        await new Promise(r => setTimeout(r, 30));
    }

    if (typeof window.showNotification === 'function') {
        window.showNotification('🌍 Готово: ' + ok + ' с данными, ' + empty + ' пусто, ' + fail + ' ошибок');
    }
    console.log('[enableAllLayers] Всего: ' + total + ', с данными: ' + ok + ', пусто: ' + empty + ', ошибок: ' + fail);
}

function disableAllLayers() {
    document.querySelectorAll('.layer-btn').forEach(btn => {
        const id = btn.dataset.layerId;
        if (id && id !== 'all') {
            window.activeLayerIds.delete(id);
            btn.classList.remove('active');
        }
    });
    updateActiveCount();
    window.currentLayer = 'all';
    if (typeof updateMarkers === 'function') updateMarkers(window.markerData || []);
    if (typeof updateLegend === 'function') updateLegend();
    if (typeof window.showNotification === 'function') {
        window.showNotification('Все слои выключены');
    }
}

function updateActiveCount() {
    const count = window.activeLayerIds.size;
    const el = document.getElementById('active-layers-count');
    if (el) el.textContent = count + ' активных';
}

function filterLayers() {
    const query = document.getElementById('layer-search')?.value?.toLowerCase()?.trim() || '';
    document.querySelectorAll('.layer-btn').forEach(btn => {
        const name = btn.querySelector('.name')?.textContent?.toLowerCase() || '';
        const id = btn.dataset.layerId?.toLowerCase() || '';
        btn.style.display = (!query || name.includes(query) || id.includes(query)) ? 'flex' : 'none';
    });
    document.querySelectorAll('.layer-category').forEach(cat => {
        const visibleBtns = cat.querySelectorAll('.layer-btn[style*="display: flex"]').length;
        cat.style.display = (visibleBtns === 0 && query) ? 'none' : 'block';
    });
}

function toggleCategory(cat) {
    const grid = document.getElementById('grid-' + cat);
    const header = document.querySelector('.layer-category[data-category="' + cat + '"] .layer-category-header');
    if (grid) grid.classList.toggle('hidden');
    if (header) {
        const arrow = header.querySelector('.arrow');
        if (arrow) arrow.classList.toggle('open');
    }
}

function renderLayerPanel(layers) {
    const container = document.getElementById('layer-list');
    if (!container) {
        console.warn('⚠️ Контейнер #layer-list не найден');
        return;
    }
    container.innerHTML = '';

    // Все слои
    const allDiv = document.createElement('div');
    allDiv.className = 'layer-category';
    allDiv.style.marginBottom = '6px';
    allDiv.style.borderBottom = '1px solid rgba(91,192,248,0.15)';
    allDiv.style.paddingBottom = '4px';

    const allHeader = document.createElement('div');
    allHeader.className = 'layer-category-header';
    allHeader.innerHTML = '<span class="arrow open">▶</span> <span id="all-layers">🌍 ВСЕ СЛОИ</span> <span class="badge">' + layers.length + '</span>';
    allHeader.onclick = () => loadLayer('all');
    allDiv.appendChild(allHeader);

    const allGrid = document.createElement('div');
    allGrid.className = 'layer-grid';
    const allBtn = document.createElement('button');
    allBtn.className = 'layer-btn active';
    allBtn.dataset.layerId = 'all';
    allBtn.innerHTML = '<span class="number">00</span><span class="dot" style="background:#5bc0f8"></span><span class="icon">🌍</span><span class="name">Все слои</span>';
    allBtn.onclick = () => loadLayer('all');
    allGrid.appendChild(allBtn);
    allDiv.appendChild(allGrid);
    container.appendChild(allDiv);

    // Категории
    const categories = {};
    const categoryIcons = {
        economics: '📊',
        finance: '💰',
        military: '🛡️',
        geopolitical: '🌍',
        ecological: '🌿',
        cyber: '🔒',
        space: '🚀',
        news: '📰',
        ai: '🧠',
        scientific: '🔬',
        esg: '🌱',
        threats: '⚡',
        health: '🏥',
        energy: '⛽',
        transport: '🚛',
        regions: '🌏',
        other: '📌',
        intelligence: '🧠',
        infrastructure: '🏗️',
        social: '👥'
    };
    const categoryNames = {
        economics: 'Экономика',
        finance: 'Финансы',
        military: 'Военный',
        geopolitical: 'Геополитика',
        ecological: 'Экология',
        cyber: 'Кибер',
        space: 'Космос',
        news: 'Новости',
        ai: 'AI',
        scientific: 'Наука',
        esg: 'ESG',
        threats: 'Угрозы',
        health: 'Здоровье',
        energy: 'Энергетика',
        transport: 'Транспорт',
        regions: 'Регионы',
        other: 'Другие',
        intelligence: 'Разведка',
        infrastructure: 'Инфраструктура',
        social: 'Социальные'
    };

    for (const layer of layers) {
        const cat = layer.category || 'other';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(layer);
    }

    const sortedCategories = Object.keys(categories).sort((a, b) => categories[b].length - categories[a].length);

    for (const cat of sortedCategories) {
        const items = categories[cat];
        const div = document.createElement('div');
        div.className = 'layer-category';
        div.dataset.category = cat;

        const header = document.createElement('div');
        header.className = 'layer-category-header';
        header.innerHTML = '<span class="arrow open">▶</span> ' + (categoryIcons[cat] || '📌') + ' ' + (categoryNames[cat] || cat) + ' <span class="badge">' + items.length + '</span>';
        header.onclick = () => toggleCategory(cat);
        div.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'layer-grid';
        grid.id = 'grid-' + cat;

        items.sort((a, b) => a.name.localeCompare(b.name));

        for (const layer of items) {
            const btn = document.createElement('button');
            btn.className = 'layer-btn';
            btn.dataset.layerId = layer.id;
            btn.dataset.category = cat;
            if (window.activeLayerIds.has(layer.id)) {
                btn.classList.add('active');
            }
            const count = window.layerCache && window.layerCache[layer.id] ? window.layerCache[layer.id].length : 0;
            btn.innerHTML = '<span class="number">' + (layer.number || '00') + '</span><span class="dot" style="background:' + (layer.color || '#4a5a6a') + '"></span><span class="icon">' + (layer.icon || '📍') + '</span><span class="name">' + layer.name + '</span>';
            btn.onclick = () => loadLayer(layer.id);
            grid.appendChild(btn);
        }

        div.appendChild(grid);
        container.appendChild(div);
    }

    const countEl = document.getElementById('layer-count');
    if (countEl) countEl.textContent = layers.length;

    updateActiveCount();
    if (typeof updateLegend === 'function') updateLegend();
}

// ============================================================
// ЗАГРУЗКА СЛОЯ (TOGGLE — ВКЛ/ВЫКЛ)
// ============================================================

let vixLayer = null;
let activeLayers = {};

async function loadLayer(layerId) {
    // --- Toggle: если слой уже активен — выключаем ---
    if (layerId !== 'all' && window.activeLayerIds.has(layerId)) {
        window.activeLayerIds.delete(layerId);
        document.querySelectorAll('.layer-btn').forEach(btn => {
            if (btn.dataset.layerId === layerId) {
                btn.classList.remove('active');
            }
        });
        updateActiveCount();
        if (typeof updateLegend === 'function') updateLegend();

        if (activeLayers[layerId]) {
            if (window.map) window.map.removeLayer(activeLayers[layerId]);
            delete activeLayers[layerId];
        }

        if (window.activeLayerIds.size === 0) {
            if (typeof updateMarkers === 'function') updateMarkers([]);
            if (typeof window.showNotification === 'function') {
                window.showNotification('❌ Все слои выключены');
            }
            return;
        }

        let all = [];
        for (const id of window.activeLayerIds) {
            if (window.layerCache && window.layerCache[id]) {
                all = all.concat(window.layerCache[id]);
            }
        }
        if (all.length === 0) all = window.markerData || [];
        if (typeof updateMarkers === 'function') updateMarkers(all);
        if (typeof window.showNotification === 'function') {
            window.showNotification(`🌍 Активных слоёв: ${window.activeLayerIds.size}`);
        }
        return;
    }

    // --- Включение слоя ---
    if (layerId !== 'all') {
        window.activeLayerIds.add(layerId);
    } else {
        document.querySelectorAll('.layer-btn').forEach(btn => {
            const id = btn.dataset.layerId;
            if (id && id !== 'all') {
                window.activeLayerIds.add(id);
                btn.classList.add('active');
            }
        });
        updateActiveCount();
        if (typeof updateLegend === 'function') updateLegend();

        let all = [];
        for (const id of window.activeLayerIds) {
            if (window.layerCache && window.layerCache[id]) {
                all = all.concat(window.layerCache[id]);
            }
        }
        if (all.length === 0) all = window.markerData || [];
        if (typeof updateMarkers === 'function') updateMarkers(all);
        if (typeof window.showNotification === 'function') {
            window.showNotification('🌍 Все слои включены');
        }
        return;
    }

    updateActiveCount();
    if (typeof updateLegend === 'function') updateLegend();

    window.currentLayer = layerId;
    localStorage.setItem('crucix-active-layer', layerId);

    // Загружаем данные слоя с сервера
    try {
        const resp = await fetch(`/api/layers/${layerId}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();

        if (!data.features || data.features.length === 0) {
            if (typeof window.showNotification === 'function') {
                window.showNotification('⚠️ Нет данных для слоя');
            }
            return;
        }

        const layer = L.geoJSON(data, {
            pointToLayer: function(feature, latlng) {
                const value = feature.properties.value || 0;
                let color = '#4d6bfe';
                let radius = 12;
                if (value > 25) { color = '#ef4444'; radius = 18; }
                else if (value > 18) { color = '#f59e0b'; radius = 15; }
                return L.circleMarker(latlng, {
                    radius: radius,
                    fillColor: color,
                    color: '#fff',
                    weight: 1.5,
                    opacity: 0.8,
                    fillOpacity: 0.7
                });
            },
            onEachFeature: function(feature, layer) {
                const props = feature.properties;
                const popupContent = `
                    <div style="font-family: system-ui; min-width: 160px;">
                        <div style="font-weight: 600; font-size: 15px;">${props.label || 'Событие'}</div>
                        <div style="color: #666; font-size: 12px;">📍 ${props.region || 'Неизвестно'}</div>
                        <div style="color: #888; font-size: 11px;">🕐 ${new Date(props.timestamp).toLocaleString()}</div>
                        ${props.value ? `<div style="color: #888; font-size: 12px;">📊 Значение: ${props.value}</div>` : ''}
                    </div>
                `;
                layer.bindPopup(popupContent);
            }
        });

        if (window.map) {
            layer.addTo(window.map);
            activeLayers[layerId] = layer;
            if (typeof window.showNotification === 'function') {
                window.showNotification(`✅ ${layerId}: ${data.features.length} объектов`);
            }
        }

        window.layerCache = window.layerCache || {};
        window.layerCache[layerId] = data.features;

    } catch (err) {
        console.error(`[loadLayer] Ошибка загрузки ${layerId}:`, err);
        if (typeof window.showNotification === 'function') {
            window.showNotification('❌ Ошибка загрузки слоя');
        }
    }
}

// ============================================================
// ЭКСПОРТ
// ============================================================

window.renderLayerPanel = renderLayerPanel;
window.loadLayer = loadLayer;
window.toggleLayerPanel = toggleLayerPanel;
window.enableAllLayers = enableAllLayers;
window.disableAllLayers = disableAllLayers;
window.filterLayers = filterLayers;
window.toggleCategory = toggleCategory;
window.updateActiveCount = updateActiveCount;

console.log('✅ LAYERS.JS готов (' + window.allLayers.length + ' слоёв, 18 категорий, toggle-логика)');

// Алиас для совместимости с geo-map.html (кнопки Включить/Выключить все)
window.updateMapLayers = function() {
    const ids = [...(window.activeLayerIds || [])];
    let all = [];
    for (const id of ids) {
        if (window.layerCache && window.layerCache[id]) {
            all = all.concat(window.layerCache[id]);
        }
    }
    if (all.length === 0) all = window.markerData || [];
    if (typeof updateMarkers === "function") updateMarkers(all);
    if (typeof updateActiveCount === "function") updateActiveCount();
    if (typeof window.showNotification === "function") {
        window.showNotification("Активных слоёв: " + ids.length);
    }
};
console.log("✅ layers.js: window.updateMapLayers установлен");
