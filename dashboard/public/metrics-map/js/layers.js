// ============================================================
// LAYERS.JS — 75 слоёв Metrics Map
// ============================================================
// Автономная карта: только свои слои (R3).
// Категории: economics, finance, esg, cyber, energy, health,
//            social, geopolitical, military, threats,
//            intelligence, news, other.
//
// ВЕРСИЯ: 1.4 (2026-09-28)
// ИЗМЕНЕНИЯ против 1.3:
//  - enableAllLayers: единая реализация вместо дублирования
//    (базовая v1.1 + override v1.3). Override v1.3 удалён —
//    его логика встроена в основную функцию.
//  - enableAllLayers: блoк глушения визуализации — полный no-op
//    (не пишет в layerCache). Кеш заполняет только renderFallback
//    внутри MetricsMap.interceptLoad.
//  - enableAllLayers: финальный рендер — последний choropleth
//    с данными в кеше (по порядку allLayers).
//  - enableAllLayers: счётчик обновляется в #active-layers-count
//    (было #active-layers-count — несуществующий элемент).
//  - enableAllLayers: прямой вызов MetricsMap.interceptLoad(layer.id)
//    без обхода через loadLayer. Единая точка входа для данных.
//  - loadLayer (строка 453): убран мёртвый второй аргумент
//    activeLayers из вызова interceptLoad.
//  - Остальной функционал (DEMO_LAYERS, renderLayerPanel, loadLayer,
//    disableAllLayers, updateActiveCount, filterLayers, toggleCategory,
//    toggleLayerPanel) — сохранён полностью.
// ============================================================

console.log('📚 LAYERS.JS загружен (75 слоёв, карта: metrics)');

const DEMO_LAYERS = [
    // ========== ECONOMICS (15) ==========
    { id: "inflation", name: "Инфляция", color: "#ff8800", icon: "📈", category: "economics", vizType: "choropleth" },
    { id: "unemployment", name: "Безработица", color: "#ff4444", icon: "📊", category: "economics", vizType: "choropleth" },
    { id: "gdp", name: "ВВП", color: "#44dd88", icon: "📊", category: "economics", vizType: "choropleth" },
    { id: "pmi", name: "PMI", color: "#ff8800", icon: "📊", category: "economics", vizType: "choropleth" },
    { id: "recession", name: "Рецессия", color: "#ff4400", icon: "📊", category: "economics", vizType: "choropleth" },
    { id: "trade-balance", name: "Торговый баланс", color: "#ffaa00", icon: "📊", category: "economics", vizType: "choropleth" },
    { id: "fred", name: "FRED Экономика", color: "#44dd88", icon: "📊", category: "economics", vizType: "choropleth" },
    { id: "bls", name: "BLS Труд", color: "#ffcc44", icon: "📋", category: "economics", vizType: "choropleth" },
    { id: "comtrade", name: "Comtrade Торговля", color: "#44aaff", icon: "📊", category: "economics", vizType: "choropleth" },
    { id: "debt-gdp", name: "Долг/ВВП", color: "#ff4444", icon: "📊", category: "economics", vizType: "choropleth" },
    { id: "consumer-confidence", name: "Потребительское доверие", color: "#44ccff", icon: "📈", category: "economics", vizType: "choropleth" },
    { id: "business-optimism-api", name: "Индекс делового оптимизма (FRED)", color: "#0891b2", icon: "💼", category: "economics", vizType: "series" },
    { id: "consumer-expectations-api", name: "Индекс потребительских ожиданий (FRED)", color: "#a855f7", icon: "🛍️", category: "economics", vizType: "series" },
    { id: "pmi-api", name: "PMI — менеджеры по закупкам (порог 50)", color: "#ff8800", icon: "📊", category: "economics", vizType: "series" },
    { id: "recession-api", name: "Вероятность рецессии (0–100%)", color: "#ff4400", icon: "📉", category: "economics", vizType: "series" },

    // ========== FINANCE (26) ==========
    { id: "dxy", name: "Индекс доллара DXY", color: "#00cc88", icon: "💵", category: "finance", vizType: "choropleth" },
    { id: "tips", name: "Реальные ставки TIPS", color: "#ff66aa", icon: "📊", category: "finance", vizType: "choropleth" },
    { id: "hy-spread", name: "Корпоративные спреды", color: "#ff4400", icon: "📊", category: "finance", vizType: "choropleth" },
    { id: "copper-gold", name: "Медь/Золото", color: "#cc8800", icon: "🏗️", category: "finance", vizType: "choropleth" },
    { id: "gold-oil", name: "Золото/Нефть", color: "#ffaa00", icon: "📈", category: "finance", vizType: "choropleth" },
    { id: "gold-silver", name: "Золото/Серебро", color: "#ffcc44", icon: "📈", category: "finance", vizType: "choropleth" },
    { id: "yield-curve", name: "Кривая доходности", color: "#ff44ff", icon: "📊", category: "finance", vizType: "choropleth" },
    { id: "big-mac", name: "Индекс Биг-Мак", color: "#ff6600", icon: "🍔", category: "finance", vizType: "choropleth" },
    { id: "big-mac-alt", name: "Биг-Мак (альт.)", color: "#ff8800", icon: "🍔", category: "finance", vizType: "choropleth" },
    { id: "big-mac-main", name: "Биг-Мак (осн.)", color: "#ffaa00", icon: "🍔", category: "finance", vizType: "choropleth" },
    { id: "uranium", name: "Цена урана", color: "#44ff44", icon: "☢️", category: "finance", vizType: "choropleth" },
    { id: "crucix-banking", name: "🏦 Банковская активность", color: "#44cc44", icon: "🏦", category: "finance", vizType: "choropleth", crucix: true },
    { id: "copper-gold-ratio-api", name: "Отношение меди к золоту (опережающий)", color: "#c2410c", icon: "🟠", category: "finance", vizType: "series" },
    { id: "hy-spread-api", name: "HY OAS — спред высокодоходных облигаций", color: "#ff4400", icon: "📊", category: "finance", vizType: "series" },
    { id: "ovx-api", name: "OVX — волатильность нефти", color: "#ff6600", icon: "📊", category: "finance", vizType: "series" },
    { id: "rublev-dubai-api", name: "Рубль в Дубае — реальный курс RUB/USDT", color: "#eab308", icon: "💱", category: "finance", vizType: "series" },
    { id: "sp500-vix-api", name: "S&P 500 / VIX Ratio (risk-on/risk-off)", color: "#44aaff", icon: "📈", category: "finance", vizType: "series" },
    { id: "vxx-api", name: "VXX — VIX Short-Term Futures ETN", color: "#ff44aa", icon: "📉", category: "finance", vizType: "series" },
    { id: "yield-curve-api", name: "Кривая доходности US Treasury (10Y-2Y)", color: "#ff44ff", icon: "📈", category: "finance", vizType: "series" },
    { id: "crypto-fear-api", name: "Крипто-страх: BTC, ETH, ratio", color: "#ff8800", icon: "📉", category: "finance", vizType: "series" },
    { id: "vix-futures", name: "VIX фьючерсы", color: "#ff66cc", icon: "📊", category: "finance", vizType: "marker" },
    { id: "cftc-cot", name: "CFTC COT — позиции фондов", color: "#ffaa88", icon: "📊", category: "finance", vizType: "marker" },
    { id: "insider-trading", name: "Инсайдерская торговля", color: "#cc6688", icon: "🕵️", category: "finance", vizType: "marker" },
    { id: "sec-filings", name: "SEC filings", color: "#88aacc", icon: "📄", category: "finance", vizType: "marker" },
    { id: "short-interest", name: "Short interest", color: "#aa66cc", icon: "📉", category: "finance", vizType: "marker" },
    { id: "bankruptcy-filings", name: "Банкротства", color: "#ff6666", icon: "⚠️", category: "finance", vizType: "marker" },

    // ========== ESG (8) ==========
    { id: "happiness", name: "Индекс счастья", color: "#44ff44", icon: "😊", category: "esg", vizType: "choropleth" },
    { id: "happiness-alt", name: "Индекс счастья (альт.)", color: "#88ff44", icon: "😊", category: "esg", vizType: "choropleth" },
    { id: "population", name: "Плотность населения", color: "#ff8844", icon: "👥", category: "esg", vizType: "choropleth" },
    { id: "refugees", name: "Беженцы", color: "#ffaa44", icon: "🧳", category: "esg", vizType: "choropleth" },
    { id: "urbanization", name: "Урбанизация", color: "#44aaff", icon: "🏙️", category: "esg", vizType: "choropleth" },
    { id: "who", name: "WHO Здравоохранение", color: "#ff44aa", icon: "🏥", category: "esg", vizType: "choropleth" },
    { id: "covid", name: "COVID-19", color: "#ff0000", icon: "🦠", category: "esg", vizType: "choropleth" },
    { id: "hdi", name: "Индекс человеческого развития", color: "#44cc44", icon: "📈", category: "esg", vizType: "choropleth" },

    // ========== GEOPOLITICAL (6) ==========
    { id: "social-unrest", name: "Социальная напряженность", color: "#ff4400", icon: "👥", category: "geopolitical", vizType: "choropleth" },
    { id: "corruption", name: "Индекс коррупции", color: "#ff4444", icon: "💼", category: "geopolitical", vizType: "choropleth" },
    { id: "democracy", name: "Индекс демократии", color: "#44ccff", icon: "🗳️", category: "geopolitical", vizType: "choropleth" },
    { id: "country-instability", name: "Индекс нестабильности стран", color: "#ff2200", icon: "🌍", category: "geopolitical", vizType: "choropleth" },
    { id: "resilience-index", name: "Индекс устойчивости стран", color: "#00cc66", icon: "🛡️", category: "geopolitical", vizType: "choropleth" },
    { id: "strategic-risk-composite", name: "Стратегический риск (композитный)", nameEn: "Strategic Risk", color: "#dc2626", icon: "🎯", category: "geopolitical", vizType: "choropleth", description: "Композитный стратегический риск", weight: 100 },

    // ========== ENERGY (5) ==========
    { id: "eia", name: "EIA Энергетика", color: "#ff6600", icon: "⛽", category: "energy", vizType: "choropleth" },
    { id: "nuclear", name: "Атомная энергетика", color: "#ff44ff", icon: "☢️", category: "energy", vizType: "choropleth" },
    { id: "renewable", name: "Возобновляемая энергия", color: "#44ff44", icon: "☀️", category: "energy", vizType: "choropleth" },
    { id: "oil-gas", name: "Нефть/Газ", color: "#ff8800", icon: "⛽", category: "energy", vizType: "choropleth" },
    { id: "wti-brent-spread-api", name: "Спред WTI/Brent (геополит. напряжение)", color: "#0891b2", icon: "🛢️", category: "energy", vizType: "series" },

    // ========== HEALTH (3) ==========
    { id: "who-health", name: "WHO Здравоохранение", color: "#ff44aa", icon: "🏥", category: "health", vizType: "choropleth" },
    { id: "covid-health", name: "COVID-19 статистика", color: "#ff0000", icon: "🦠", category: "health", vizType: "choropleth" },
    { id: "healthcare-health", name: "Медицинская инфраструктура", color: "#ff88bb", icon: "🏥", category: "health", vizType: "choropleth" },

    // ========== SOCIAL (3) ==========
    { id: "crucix-population-flow", name: "👥 Перемещение населения", color: "#ff8844", icon: "👥", category: "social", vizType: "choropleth", crucix: true },
    { id: "crucix-refugees", name: "🧳 Беженцы (crucix)", color: "#ffaa44", icon: "🧳", category: "social", vizType: "choropleth", crucix: true },
    { id: "crucix-phone-activity", name: "📱 Активность телефонов", color: "#44ccff", icon: "📱", category: "social", vizType: "choropleth", crucix: true },

    // ========== CYBER (2) ==========
    { id: "cve-cyber", name: "Уязвимости CVE", color: "#ffaa00", icon: "🔓", category: "cyber", vizType: "choropleth" },
    { id: "cyber-threat-index-api", name: "Композитный индекс киберугроз", color: "#dc2626", icon: "🛡️", category: "cyber", vizType: "series" },

    // ========== MILITARY (2) ==========
    { id: "military-spending", name: "Военные расходы", color: "#ff4400", icon: "💰", category: "military", vizType: "choropleth" },
    { id: "war-preparation", name: "Индекс подготовки к войне", color: "#ff2200", icon: "⚔️", category: "military", vizType: "choropleth" },

    // ========== THREATS (1) ==========
    { id: "cve-threat", name: "Уязвимости CVE (threat)", color: "#ffaa00", icon: "🔓", category: "threats", vizType: "choropleth" },

    // ========== INTELLIGENCE (1) ==========
    { id: "crucix-pattern-life", name: "📊 Шаблоны поведения", color: "#4466ff", icon: "📊", category: "intelligence", vizType: "choropleth", crucix: true },

    // ========== NEWS (1) ==========
    { id: "google-trends", name: "Google Trends", color: "#ff8800", icon: "📊", category: "news", vizType: "choropleth" },

    // ========== OTHER (2) ==========
    { id: "internet", name: "Интернет-доступ", color: "#44aaff", icon: "🌐", category: "other", vizType: "choropleth" },
    { id: "mobile", name: "Мобильная связь", color: "#44cc44", icon: "📱", category: "other", vizType: "choropleth" }
];

window.allLayers = DEMO_LAYERS.map((l, idx) => ({
    ...l,
    number: String(idx + 1).padStart(2, '0')
}));

console.log('✅ Загружено слоёв:', window.allLayers.length, '(карта: metrics)');

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

// ============================================================
// ENABLE-ALL — ЕДИНАЯ РЕАЛИЗАЦИЯ v1.4
// ============================================================
// Назначение: загрузить все 75 слоёв в layerCache (плоские массивы),
// отметить все как активные, отобразить последний choropleth.
//
// Принципы:
//   - Прямой вызов MetricsMap.interceptLoad(layer.id) — единая точка
//     получения данных. Не обходим через loadLayer (там toggle-логика).
//   - Блок глушения визуализации: applyChoropleth/updateMarkers/
//     renderLayerPanel временно становятся полным no-op. Это
//     предотвращает 75 перерисовок карты и 75 перерисовок панели.
//   - Кеш заполняет только renderFallback внутри interceptLoad —
//     плоские массивы. Инвариант: Array.isArray(layerCache[id]).
//   - Финальный рендер: последний choropleth с данными в кеше.
// ============================================================

async function enableAllLayers() {
    if (window._enableAllInProgress) {
        console.warn('[enableAllLayers] Уже выполняется, пропуск');
        return;
    }
    window._enableAllInProgress = true;

    const layers = window.allLayers || [];
    const total = layers.length;

    let ok = 0, empty = 0, fail = 0, skipped = 0;

    console.log('[enableAllLayers v1.4] Старт (слоёв: ' + total + ')');

    if (typeof window.showNotification === 'function') {
        window.showNotification('🌍 Загрузка ' + total + ' слоёв...');
    }

    // Сохраняем оригиналы для восстановления в finally
    const origApplyChoropleth = window.applyChoropleth;
    const origUpdateMarkers = window.updateMarkers;
    const origRenderLayerPanel = window.renderLayerPanel;

    // Заглушаем визуализацию — полный no-op.
    // ВАЖНО: глушённый applyChoropleth НЕ пишет в layerCache.
    // Кеш заполняет только renderFallback внутри interceptLoad.
    window.applyChoropleth = function() {};
    window.updateMarkers = function() {};
    window.renderLayerPanel = function() {};

    try {
        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            const idx = i + 1;

            // Уже загружен и в наборе — пропускаем
            if (window.layerCache && Array.isArray(window.layerCache[layer.id]) &&
                window.layerCache[layer.id].length > 0 &&
                window.activeLayerIds.has(layer.id)) {
                ok++;
                skipped++;
                const btnSkip = document.querySelector('.layer-btn[data-layer-id="' + layer.id + '"]');
                if (btnSkip) btnSkip.classList.add('active');
                continue;
            }

            // Убираем из activeLayerIds на всякий случай — не даём toggle-логике
            // loadLayer перехватить управление. Хотя мы вызываем interceptLoad
            // напрямую, эта страховка бесплатна.
            if (window.activeLayerIds) window.activeLayerIds.delete(layer.id);

            try {
                // Прямой вызов диспетчера данных.
                // interceptLoad сам маршрутизирует по vizType и решает,
                // какой fallback применить.
                if (window.MetricsMap && typeof window.MetricsMap.interceptLoad === 'function') {
                    await window.MetricsMap.interceptLoad(layer.id);
                }

                const cached = window.layerCache ? window.layerCache[layer.id] : null;

                if (Array.isArray(cached) && cached.length > 0) {
                    ok++;
                    if (window.activeLayerIds) window.activeLayerIds.add(layer.id);
                    const btn = document.querySelector('.layer-btn[data-layer-id="' + layer.id + '"]');
                    if (btn) btn.classList.add('active');
                } else if (Array.isArray(cached)) {
                    empty++;
                } else {
                    fail++;
                }

                console.log('[enableAllLayers v1.4] ' + idx + '/' + total + ': ' + layer.id +
                            ' → ' + (Array.isArray(cached) ? cached.length : '×'));

            } catch (e) {
                fail++;
                console.warn('[enableAllLayers v1.4] Ошибка слоя ' + layer.id + ': ' + e.message);
            }

            // Microtask yield — не троттлится в фоновой вкладке
            await Promise.resolve();
        }
    } finally {
        // Восстанавливаем визуализацию
        window.applyChoropleth = origApplyChoropleth;
        window.updateMarkers = origUpdateMarkers;
        window.renderLayerPanel = origRenderLayerPanel;
    }

    // Подсветить кнопку "all"
    const allBtn = document.querySelector('.layer-btn[data-layer-id="all"]');
    if (allBtn) allBtn.classList.add('active');

    // Финальный рендер — последний choropleth с данными в кеше
    // (по порядку allLayers, идём с конца)
    let rendered = null;
    for (let k = layers.length - 1; k >= 0; k--) {
        const l = layers[k];
        if (l.vizType === 'marker') continue;
        const cached = window.layerCache ? window.layerCache[l.id] : null;
        if (Array.isArray(cached) && cached.length > 0 && origApplyChoropleth) {
            origApplyChoropleth({ features: cached }, l);
            rendered = l;
            break;
        }
    }
    if (rendered) {
        console.log('[enableAllLayers v1.4] Финальный рендер: ' + rendered.id +
                    ' (' + window.layerCache[rendered.id].length + ' объектов)');
    }

    // Обновляем счётчик активных
    updateActiveCount();

    // Обновляем легенду
    if (typeof updateLegend === 'function') updateLegend();

    // Финальная статистика
    const cacheSize = Object.keys(window.layerCache || {}).length;
    let byteSize = 0;
    for (const key of Object.keys(window.layerCache || {})) {
        const d = window.layerCache[key];
        if (Array.isArray(d)) byteSize += JSON.stringify(d).length;
    }

    console.log('[enableAllLayers v1.4] Всего: ' + total +
                ', с данными: ' + ok +
                ', пусто: ' + empty +
                ', ошибок: ' + fail +
                ', пропущено (уже было): ' + skipped +
                ', в кеше: ' + cacheSize +
                ', объём: ~' + Math.round(byteSize / 1024) + ' КБ');

    if (typeof window.showNotification === 'function') {
        window.showNotification('🌍 Готово: ' + ok + ' с данными, ' + empty + ' пусто, ' + fail + ' ошибок');
    }

    window._enableAllInProgress = false;
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

    // Защита от вызова без аргумента (правило: не падать)
    if (!Array.isArray(layers)) {
        layers = window.allLayers || [];
    }

    container.innerHTML = '';

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

    const categories = {};
    const categoryIcons = {
        economics: '📊', finance: '💰', military: '🛡️', geopolitical: '🌍',
        ecological: '🌿', cyber: '🔒', space: '🚀', news: '📰', ai: '🧠',
        scientific: '🔬', esg: '🌱', threats: '⚡', health: '🏥', energy: '⛽',
        transport: '🚛', regions: '🌏', other: '📌', intelligence: '🧠',
        infrastructure: '🏗️', social: '👥'
    };
    const categoryNames = {
        economics: 'Экономика', finance: 'Финансы', military: 'Военный',
        geopolitical: 'Геополитика', ecological: 'Экология', cyber: 'Кибер',
        space: 'Космос', news: 'Новости', ai: 'AI', scientific: 'Наука',
        esg: 'ESG', threats: 'Угрозы', health: 'Здоровье', energy: 'Энергетика',
        transport: 'Транспорт', regions: 'Регионы', other: 'Другие',
        intelligence: 'Разведка', infrastructure: 'Инфраструктура', social: 'Социальные'
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

        items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        for (const layer of items) {
            const btn = document.createElement('button');
            btn.className = 'layer-btn';
            btn.dataset.layerId = layer.id;
            btn.dataset.category = cat;
            if (window.activeLayerIds.has(layer.id)) {
                btn.classList.add('active');
            }
            btn.innerHTML = '<span class="number">' + (layer.number || '00') + '</span>' +
                            '<span class="dot" style="background:' + (layer.color || '#4a5a6a') + '"></span>' +
                            '<span class="icon">' + (layer.icon || '📍') + '</span>' +
                            '<span class="name">' + (layer.name || '—') + '</span>';
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
// ЗАГРУЗКА СЛОЯ (TOGGLE — ВКЛ/ВЫКЛ) — перехватывается MetricsMap
// ============================================================

let activeLayers = {};

async function loadLayer(layerId) {
    // === TOGGLE OFF ===
    if (layerId !== 'all' && window.activeLayerIds.has(layerId)) {
        window.activeLayerIds.delete(layerId);
        document.querySelectorAll('.layer-btn').forEach(btn => {
            if (btn.dataset.layerId === layerId) btn.classList.remove('active');
        });
        updateActiveCount();
        if (typeof updateLegend === 'function') updateLegend();
        if (activeLayers[layerId]) {
            if (window.map) window.map.removeLayer(activeLayers[layerId]);
            delete activeLayers[layerId];
        }
        if (window.activeLayerIds.size === 0) {
            if (typeof updateMarkers === 'function') updateMarkers([]);
            if (typeof window.showNotification === 'function') window.showNotification('❌ Все слои выключены');
            return;
        }
        let all = [];
        for (const id of window.activeLayerIds) {
            if (window.layerCache && window.layerCache[id]) all = all.concat(window.layerCache[id]);
        }
        if (all.length === 0) all = window.markerData || [];
        if (typeof updateMarkers === 'function') updateMarkers(all);
        if (typeof window.showNotification === 'function') window.showNotification(`🌍 Активных слоёв: ${window.activeLayerIds.size}`);
        return;
    }

    // === ENABLE: конкретный слой ===
    if (layerId !== 'all') {
        window.activeLayerIds.add(layerId);
        const btn = document.querySelector('.layer-btn[data-layer-id="' + layerId + '"]');
        if (btn) btn.classList.add('active');
    } else {
        // === ENABLE: все слои ===
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
            if (window.layerCache && window.layerCache[id]) all = all.concat(window.layerCache[id]);
        }
        if (all.length === 0) all = window.markerData || [];
        if (typeof updateMarkers === 'function') updateMarkers(all);
        if (typeof window.showNotification === 'function') window.showNotification('🌍 Все слои включены');
        return;
    }

    updateActiveCount();
    if (typeof updateLegend === 'function') updateLegend();
    window.currentLayer = layerId;
    localStorage.setItem('crucix-active-layer', layerId);

    // ПЕРЕХВАТ: MetricsMap (без второго аргумента — он мёртвый)
    if (window.MetricsMap && window.MetricsMap.interceptLoad) {
        const handled = await window.MetricsMap.interceptLoad(layerId);
        if (handled) return;
    }

    // Fallback: обычная загрузка (non-intercepted path)
    try {
        const resp = await fetch(`/api/layers/${layerId}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        if (!data.features || data.features.length === 0) {
            if (typeof window.showNotification === 'function') window.showNotification('⚠️ Нет данных для слоя');
            return;
        }
        const layer = L.geoJSON(data, {
            pointToLayer: function(feature, latlng) {
                const value = feature.properties.value || 0;
                let color = '#4d6bfe'; let radius = 12;
                if (value > 25) { color = '#ef4444'; radius = 18; }
                else if (value > 18) { color = '#f59e0b'; radius = 15; }
                return L.circleMarker(latlng, { radius: radius, fillColor: color, color: '#fff', weight: 1.5, opacity: 0.8, fillOpacity: 0.7 });
            },
            onEachFeature: function(feature, layer) {
                layer.bindPopup('<div style="padding:4px 0;"><strong style="color:#e8f0f8;">' + (feature.properties.name || '—') + '</strong><div style="color:#fbbf24;font-size:12px;margin-top:4px;">📊 ' + (feature.properties.value || '—') + '</div></div>');
            }
        });
        if (window.map) layer.addTo(window.map);
        activeLayers[layerId] = layer;
        window.layerCache = window.layerCache || {};
        window.layerCache[layerId] = data.features;
        let all = [];
        for (const id of window.activeLayerIds) {
            if (window.layerCache && window.layerCache[id]) all = all.concat(window.layerCache[id]);
        }
        if (typeof updateMarkers === 'function') updateMarkers(all);
        if (typeof window.showNotification === 'function') window.showNotification('✅ Слой загружен: ' + layerId);
    } catch (e) {
        console.warn('[loadLayer] Ошибка:', e.message);
        if (typeof window.showNotification === 'function') window.showNotification('❌ Ошибка загрузки слоя');
    }
}

window.renderLayerPanel = renderLayerPanel;
window.loadLayer = loadLayer;
window.toggleLayerPanel = toggleLayerPanel;
window.enableAllLayers = enableAllLayers;
window.disableAllLayers = disableAllLayers;
window.filterLayers = filterLayers;
window.toggleCategory = toggleCategory;
window.updateActiveCount = updateActiveCount;
window.activeLayersRef = activeLayers;

console.log('✅ LAYERS.JS готов (' + window.allLayers.length + ' слоёв, версия 1.4)');
