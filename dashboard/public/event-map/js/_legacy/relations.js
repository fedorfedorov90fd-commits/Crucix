// ============================================================
// RELATIONS.JS — Модуль связей и графа для Crucix
// Строит связи между объектами на карте по гео-правилам
// ============================================================

console.log('🔗 RELATIONS.JS загружен: модуль связей Crucix');

// --- Типы объектов (классификация Crucix) ---
const OBJECT_TYPES = {
    // Разведка и сенсоры
    'radar':              { type: 'sensor',     label: 'РЛС' },
    'satellite-recon':    { type: 'satellite',  label: 'Спутник' },
    'sigint':             { type: 'sensor',     label: 'SIGINT' },
    'humint':             { type: 'agent',      label: 'Агент' },
    'osint':              { type: 'source',     label: 'OSINT' },
    'imint':              { type: 'imagery',    label: 'Снимок' },
    'masint':             { type: 'sensor',     label: 'MASINT' },
    'geoint':             { type: 'geo',        label: 'GEO' },
    'electronic-warfare':  { type: 'ew',         label: 'РЭБ' },
    'drone-recon':        { type: 'drone',      label: 'БПЛА' },

    // Военные объекты
    'units':              { type: 'unit',       label: 'Подразделение' },
    'equipment':          { type: 'equipment',  label: 'Техника' },
    'personnel':          { type: 'personnel',  label: 'Личный состав' },
    'bases':              { type: 'base',       label: 'База' },
    'movements':          { type: 'movement',   label: 'Перемещение' },
    'supply-lines':       { type: 'supply',     label: 'Снабжение' },
    'air-defense':        { type: 'airdef',     label: 'ПВО' },
    'naval':              { type: 'vessel',     label: 'Корабль' },
    'aviation-mil':       { type: 'aircraft',   label: 'Авиация' },
    'missile':            { type: 'missile',    label: 'Ракета' },
    'target-list':        { type: 'target',     label: 'Цель' },

    // Кибер и инфраструктура
    'cyber-nodes':        { type: 'node',       label: 'Сетевой узел' },
    'cyber-links':         { type: 'link',       label: 'Сетевая связь' },
    'cyber-attacks':      { type: 'attack',     label: 'Кибератака' },
    'cyber-infrastructure':{ type: 'infra',     label: 'Киберинфра' },
    'datacenters':        { type: 'datacenter', label: 'ЦОД' },
    'undersea-cables':    { type: 'cable',      label: 'Кабель' },
    'pipelines':          { type: 'pipeline',   label: 'Труба' },
    'power-grid':         { type: 'power',      label: 'Электросеть' },

    // Твои существующие слои Crucix (оставь как есть)
    'cisa':          { type: 'advisory',  label: 'CISA' },
    'cve':           { type: 'vuln',      label: 'Уязвимость' },
    'gdelt':         { type: 'event',     label: 'Событие' },
    'opensky':       { type: 'flight',    label: 'Рейс' },
    'shodan':        { type: 'scan',      label: 'Сканирование' },
    'ofac':          { type: 'sanction',  label: 'Санкции' },
    'acled':         { type: 'conflict',  label: 'Конфликт' },
};

// --- Типы связей (семантика) ---
const LINK_TYPES = {
    located_in:        { label: 'находится в',     color: '#888888', directed: true },
    part_of:           { label: 'часть',           color: '#aaaa44', directed: true },
    supplied_by:       { label: 'снабжается',      color: '#44aa44', directed: true },
    monitored_by:      { label: 'наблюдается',     color: '#4488ff', directed: true },
    attacked_by:       { label: 'атакован',        color: '#ff4444', directed: true },
    attributed_to:     { label: 'атрибутирован',   color: '#ff00aa', directed: true },
    linked_to:         { label: 'связан с',        color: '#888888', directed: false },
    controls:          { label: 'контролирует',    color: '#ff8800', directed: true },
    communicates_with: { label: 'обменивается',    color: '#00ccff', directed: false },
    near:              { label: 'рядом',           color: '#666666', directed: false }
};

// --- Граф (хранилище связей) ---
let graph = {
    nodes: new Map(),   // id → объект
    links: new Map()    // linkId → связь
};

// --- Добавить объект в граф ---
function addNode(feature, layerId) {
    if (!feature || !feature.properties) return null;

    const id = feature.id || `${layerId}_${Math.random().toString(36).slice(2, 8)}`;
    const objType = OBJECT_TYPES[layerId] || { type: 'unknown', label: layerId };

    const coords = feature.geometry?.coordinates || [0, 0];
    // Для линий и полигонов берем первую точку для центроида
    if (Array.isArray(coords[0]) && coords.length > 1) {
        coords = coords[0];
    }

    const node = {
        id: id,
        layerId: layerId,
        type: objType.type,
        typeLabel: objType.label,
        label: feature.properties.label || 'Без названия',
        props: feature.properties,
        lat: coords[1] || 0,
        lon: coords[0] || 0,
        feature: feature
    };

    graph.nodes.set(id, node);
    return node;
}

// --- Добавить связь ---
function addLink(sourceId, targetId, linkType, props = {}) {
    if (!graph.nodes.has(sourceId) || !graph.nodes.has(targetId)) return null;
    const linkId = `${sourceId}_${linkType}_${targetId}`;
    if (graph.links.has(linkId)) return graph.links.get(linkId);

    const lt = LINK_TYPES[linkType] || { label: linkType, color: '#888', directed: false };
    const link = {
        id: linkId,
        source: sourceId,
        target: targetId,
        type: linkType,
        label: lt.label,
        color: lt.color,
        directed: lt.directed,
        props: props
    };
    graph.links.set(linkId, link);
    return link;
}

// --- Формула расстояния (Haversine) ---
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371; // км
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// --- Построить граф из активных слоев ---
function buildGraphFromLayers() {
    graph.nodes.clear();
    graph.links.clear();

    if (!window.layerCache) {
        console.warn('[relations] layerCache пуст');
        return;
    }

    let nodeCount = 0;
    // 1. Загружаем все объекты в граф
    for (const [layerId, features] of Object.entries(window.layerCache)) {
        for (const feature of features) {
            const node = addNode(feature, layerId);
            if (node) nodeCount++;
        }
    }
    console.log(`[relations] Узлов загружено: ${nodeCount}`);

    // 2. Автоматически строим связи по правилам
    let linkCount = 0;
    for (const [id, node] of graph.nodes) {

        // Правило 1: Объект рядом со спутником/радаром/БПЛА -> monitored_by
        if (['base', 'unit', 'vessel', 'aircraft', 'nuclear', 'datacenter', 'port'].includes(node.type)) {
            for (const [otherId, other] of graph.nodes) {
                if (otherId === id) continue;
                if (['satellite', 'sensor', 'drone', 'ew'].includes(other.type)) {
                    const dist = haversine(node.lat, node.lon, other.lat, other.lon);
                    if (dist < 500) { // 500 км радиус наблюдения
                        addLink(id, otherId, 'monitored_by', { distance: Math.round(dist) });
                        linkCount++;
                    }
                }
            }
        }

        // Правило 2: ЦОД/Инфра рядом с кибератакой -> attacked_by
        if (['datacenter', 'node', 'infra', 'power', 'telecom'].includes(node.type)) {
            for (const [otherId, other] of graph.nodes) {
                if (otherId === id) continue;
                if (other.type === 'attack') {
                    const dist = haversine(node.lat, node.lon, other.lat, other.lon);
                    if (dist < 200) {
                        addLink(id, otherId, 'attacked_by', { distance: Math.round(dist) });
                        linkCount++;
                    }
                }
            }
        }

        // Правило 3: База рядом с трубой/маршрутом -> supplied_by
        if (['base', 'unit', 'port', 'airport'].includes(node.type)) {
            for (const [otherId, other] of graph.nodes) {
                if (otherId === id) continue;
                if (['pipeline', 'supply', 'trade'].includes(other.type)) {
                    const dist = haversine(node.lat, node.lon, other.lat, other.lon);
                    if (dist < 100) {
                        addLink(id, otherId, 'supplied_by', { distance: Math.round(dist) });
                        linkCount++;
                    }
                }
            }
        }

        // Правило 4: Любые разные объекты рядом -> near
        const nearby = [];
        for (const [otherId, other] of graph.nodes) {
            if (otherId === id) continue;
            const dist = haversine(node.lat, node.lon, other.lat, other.lon);
            if (dist <= 50 && other.type !== node.type) {
                nearby.push({ node: other, distance: dist });
            }
        }
        // Сортируем по расстоянию и берем топ-5
        nearby.sort((a, b) => a.distance - b.distance).slice(0, 5).forEach(n => {
            addLink(id, n.node.id, 'near', { distance: Math.round(n.distance) });
            linkCount++;
        });
    }

    console.log(`[relations] Связей построено: ${linkCount}`);
    return { nodes: graph.nodes.size, links: graph.links.size };
}

// --- Показать связи объекта (рисует линии на карте) ---
function showNodeLinks(nodeId) {
    const node = graph.nodes.get(nodeId);
    if (!node) return;

    const links = [];
    // Ищем все связи, где есть этот узел
    for (const link of graph.links.values()) {
        if (link.source === nodeId || link.target === nodeId) {
            const otherId = link.source === nodeId ? link.target : link.source;
            const other = graph.nodes.get(otherId);
            if (other) links.push({ link, node: other });
        }
    }

    if (links.length === 0) {
        console.log('[relations] Нет связей для', node.label);
        return null; // Возвращаем null, чтобы показать обычный попап
    }

    // Рисуем линии
    if (window.linkLines) {
        window.linkLines.forEach(l => window.map.removeLayer(l));
    }
    window.linkLines = [];

    for (const { link, node: target } of links) {
        const line = L.polyline(
            [[node.lat, node.lon], [target.lat, target.lon]],
            { color: link.color, weight: 2, opacity: 0.7, dashArray: '5,5' }
        ).addTo(window.map);
        line.bindTooltip(`${link.label}: ${target.label}`, { sticky: true });
    window.linkLines.push(line);
    }

    // Возвращаем HTML для попапа
    let html = `<div style="font-family:system-ui; min-width:220px;">`;
    html += `<div style="font-weight:700; font-size:14px; color:#5bc0f8;">${node.typeLabel}: ${node.label}</div>`;
    html += `<div style="color:#888; font-size:11px; margin-bottom:6px;">📍 ${node.props.region || ''} ${node.props.country || ''}</div>`;
    html += `<div style="font-size:11px; color:#aaa; margin-bottom:4px;">🔗 Связей: ${links.length}</div>`;
    html += `<div style="max-height:200px; overflow-y:auto;">`;

    for (const { link, node: target } of links.slice(0, 15)) {
        const dist = link.props.distance ? ` (${link.props.distance} км)` : '';
        const conf = link.props.confidence ? ` [${link.props.confidence}%]` : '';
        html += `<div style="font-size:11px; padding:2px 0; border-bottom:1px solid rgba(255,255,255,0.05);">`;
        html += `<span style="color:${link.color};">●</span> `;
        html += `<span style="color:#ccc;">${link.label}</span> → `;
        html += `<span style="color:#fff; font-weight:500;">${target.label}</span>`;
        html += `<span style="color:#666;">${dist}${conf}</span>`;
        html += `</div>`;
    }

    if (links.length > 15) {
        html += `<div style="font-size:10px; color:#666; padding:4px 0;">...и ещё ${links.length - 15}</div>`;
    }

    html += `</div></div>`;
    return html;
}

// --- Загрузить слой в граф ---
async function loadLayerIntoGraph(layerId) {
    if (window.layerCache && window.layerCache[layerId]) {
        for (const feature of window.layerCache[layerId]) {
            addNode(feature, layerId);
        }
        return;
    }
    try {
        const resp = await fetch(`/api/layers/${layerId}`);
        if (!resp.ok) return;
        const data = await resp.json();
        if (data.features) {
            window.layerCache = window.layerCache || {};
            window.layerCache[layerId] = data.features;
            for (const feature of data.features) {
                addNode(feature, layerId);
            }
        }
    } catch (err) {
        console.warn(`[relations] Не загрузился ${layerId}:`, err.message);
    }
}

// --- Перестроить граф из активных слоёв ---
async function rebuildGraph() {
    const activeIds = Array.from(window.activeLayerIds || []);
    graph.nodes.clear();
    graph.links.clear();

    for (const layerId of activeIds) {
        await loadLayerIntoGraph(layerId);
    }

    const stats = buildGraphFromLayers();
    console.log('[relations] Граф перестроен:', stats);
    return stats;
}

// --- Перехват клика по объекту ---
function setupGraphInteractions() {
    if (!window.map) {
        setTimeout(setupGraphInteractions, 1000);
        return;
    }

    window.map.on('popupopen', async (e) => {
        const popup = e.popup;
        const feature = popup._source?.feature;
        if (!feature) return;

        // Находим слой, которому принадлежит объект
        let layerId = null;
        for (const [lid, features] of Object.entries(window.layerCache || {})) {
            if (features.includes(feature)) {
                layerId = lid;
                break;
            }
        }
        if (!layerId) return;

        // Добавляем в граф (если ещё нет)
        const node = addNode(feature, layerId);
        if (!node) return;

        // Показываем связи
        const linksHtml = showNodeLinks(node.id);
        if (linksHtml) {
            popup.setContent(linksHtml);
        }
    });

    console.log('[relations] Перехват кликов настроен');
}

// --- Инициализация ---
function initRelations() {
    setupGraphInteractions();
    console.log('✅ RELATIONS.JS готов');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRelations);
} else {
    initRelations();
}

// --- Экспорт ---
window.relations = {
    graph,
    OBJECT_TYPES,
    LINK_TYPES,
    addNode,
    addLink,
    getLinks,
    findNearby,
    buildGraphFromLayers,
    showNodeLinks,
    rebuildGraph,
    loadLayerIntoGraph
};

console.log('✅ relations экспортирован в window.relations');
