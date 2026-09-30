// ============================================================
// LAYER-PANEL.JS — 3-й блок: управление слоями (121 шт.)
// ============================================================

import { getMap, getAllLayers, getCurrentLayer, setCurrentLayer, getAllMarkers, setMarkerData } from '../js/geo-map-core.js';
import { updateMarkers } from '../js/markers.js';

let layerCache = {};
let categoryStates = {};
let panelVisible = true;

export function renderLayerPanel(layers) {
    const container = document.getElementById('layer-list');
    container.innerHTML = '';

    // Кнопка "ВСЕ"
    const allDiv = document.createElement('div');
    allDiv.className = 'layer-category';
    allDiv.style.marginBottom = '6px';
    allDiv.style.borderBottom = '1px solid rgba(91,192,248,0.15)';
    allDiv.style.paddingBottom = '4px';
    
    const allHeader = document.createElement('div');
    allHeader.className = 'layer-category-header';
    allHeader.innerHTML = `<span class="arrow open">▶</span> 🌍 ВСЕ СЛОИ <span class="badge">${layers.length}</span>`;
    allHeader.onclick = () => loadLayer('all');
    allDiv.appendChild(allHeader);

    const allGrid = document.createElement('div');
    allGrid.className = 'layer-grid';
    const allBtn = document.createElement('button');
    allBtn.className = 'layer-btn active';
    allBtn.dataset.layerId = 'all';
    allBtn.innerHTML = `<span class="number">00</span><span class="dot" style="background:#5bc0f8"></span><span class="icon">🌍</span><span class="name">Все слои</span>`;
    allBtn.onclick = () => loadLayer('all');
    allGrid.appendChild(allBtn);
    allDiv.appendChild(allGrid);
    container.appendChild(allDiv);

    // Категории
    const categories = {};
    const categoryIcons = {
        military: '⚔️', financial: '💰', ecological: '🌿', infrastructure: '🏗️',
        social: '👥', space: '🚀', cyber: '💻', news: '📰',
        energy: '⛽', maritime: '🚢', transport: '🚛', health: '🏥',
        economic: '📊', other: '📌'
    };
    const categoryNames = {
        military: 'Военные', financial: 'Финансы', ecological: 'Экология',
        infrastructure: 'Инфраструктура', social: 'Социальные', space: 'Космос',
        cyber: 'Кибер', news: 'Новости', energy: 'Энергетика',
        maritime: 'Морские', transport: 'Транспорт', health: 'Здоровье',
        economic: 'Экономика', other: 'Другие'
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
        header.innerHTML = `
            <span class="arrow open">▶</span>
            ${categoryIcons[cat] || '📌'} ${categoryNames[cat] || cat}
            <span class="badge">${items.length}</span>
        `;
        header.onclick = () => toggleCategory(cat);
        div.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'layer-grid';
        grid.id = `grid-${cat}`;

        items.sort((a, b) => a.name.localeCompare(b.name));

        const currentLayer = getCurrentLayer();
        for (const layer of items) {
            const btn = document.createElement('button');
            btn.className = 'layer-btn';
            btn.dataset.layerId = layer.id;
            btn.dataset.category = cat;
            if (layer.id === currentLayer) {
                btn.classList.add('active');
            }
            btn.innerHTML = `
                <span class="number">${layer.number || '00'}</span>
                <span class="dot" style="background:${layer.color || '#4a5a6a'}"></span>
                <span class="icon">${layer.icon || '📍'}</span>
                <span class="name">${layer.name}</span>
            `;
            btn.onclick = () => loadLayer(layer.id);
            grid.appendChild(btn);
        }

        div.appendChild(grid);
        container.appendChild(div);
        categoryStates[cat] = true;
    }
}

export function toggleCategory(cat) {
    categoryStates[cat] = !categoryStates[cat];
    const grid = document.getElementById(`grid-${cat}`);
    const header = document.querySelector(`.layer-category[data-category="${cat}"] .layer-category-header`);
    if (grid) grid.classList.toggle('hidden', !categoryStates[cat]);
    if (header) {
        const arrow = header.querySelector('.arrow');
        if (arrow) arrow.classList.toggle('open', categoryStates[cat]);
    }
}

export function filterLayers() {
    const query = document.getElementById('layer-search').value.toLowerCase().trim();
    const allBtns = document.querySelectorAll('.layer-btn');
    allBtns.forEach(btn => {
        const name = btn.querySelector('.name')?.textContent?.toLowerCase() || '';
        const id = btn.dataset.layerId?.toLowerCase() || '';
        const match = !query || name.includes(query) || id.includes(query);
        btn.style.display = match ? 'flex' : 'none';
    });
    document.querySelectorAll('.layer-category').forEach(cat => {
        const visibleBtns = cat.querySelectorAll('.layer-btn[style*="display: flex"]').length;
        if (visibleBtns === 0 && query) {
            cat.style.display = 'none';
        } else {
            cat.style.display = 'block';
            if (query) {
                const grid = cat.querySelector('.layer-grid');
                if (grid) grid.classList.remove('hidden');
                const header = cat.querySelector('.layer-category-header');
                const arrow = header?.querySelector('.arrow');
                if (arrow) arrow.classList.add('open');
            }
        }
    });
}

export async function loadLayer(layerId) {
    document.querySelectorAll('.layer-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.layerId === layerId);
    });
    setCurrentLayer(layerId);
    localStorage.setItem('crucix-active-layer', layerId);

    const allMarkers = getAllMarkers();

    // Слой "ВСЕ"
    if (layerId === 'all') {
        updateMarkers(allMarkers);
        showNotification('🌍 Все слои — ' + allMarkers.length + ' маркеров');
        return;
    }

    // Кэш
    if (layerCache[layerId]) {
        updateMarkers(layerCache[layerId]);
        return;
    }

    try {
        const response = await fetch(`/api/layers/${layerId}`);
        const data = await response.json();
        if (data.success && data.data) {
            const features = data.data.features || [];
            const markers = features.map(f => ({
                lat: f.geometry?.coordinates?.[1] || 0,
                lng: f.geometry?.coordinates?.[0] || 0,
                name: f.properties?.name || 'Событие',
                status: f.properties?.severity || 'medium',
                layer: layerId,
                description: f.properties?.description || '',
                timestamp: f.properties?.timestamp || ''
            }));
            layerCache[layerId] = markers;
            updateMarkers(markers);
            const allLayers = getAllLayers();
            const layerName = allLayers.find(l => l.id === layerId)?.name || layerId;
            showNotification(`✅ ${layerName} — ${markers.length} маркеров`);
        }
    } catch (err) {
        console.error('Ошибка загрузки слоя:', err);
        showNotification('❌ Ошибка загрузки слоя');
    }
}

export function toggleLayerPanel() {
    panelVisible = !panelVisible;
    document.getElementById('layer-panel').classList.toggle('collapsed', !panelVisible);
    document.getElementById('map-container').classList.toggle('full', !panelVisible);
    document.getElementById('panel-toggle-btn').classList.toggle('visible', !panelVisible);
    const map = getMap();
    setTimeout(() => map && map.invalidateSize(), 300);
}

function showNotification(msg) {
    document.querySelectorAll('.notification').forEach(el => el.remove());
    const el = document.createElement('div');
    el.className = 'notification';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
}
