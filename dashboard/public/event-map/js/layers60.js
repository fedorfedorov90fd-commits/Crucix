// ============================================================
// LAYERS.JS — УПРАВЛЯЕМЫЙ ФАЙЛ СЛОЁВ
// ============================================================
// Автоматически загружает все layer_*.json из /data/
// Группирует по категориям для панели слоёв
// Версия: 2.0 (совместима с Crucix 08.09.2026)
// ============================================================

console.log('📚 LAYERS.JS загружен (управляемая версия)');

// --- 1. КОНФИГУРАЦИЯ КАТЕГОРИЙ ---
// Здесь ты можешь добавлять/удалять категории и менять их отображение

const CATEGORY_CONFIG = {
  economy: {
    id: 'economy',
    label: 'Экономика и ресурсы',
    icon: '💵',
    color: '#FF6347',
    fileRange: [0, 7]  // layer_00.json ... layer_07.json
  },
  social: {
    id: 'social',
    label: 'Социальные индикаторы',
    icon: '👥',
    color: '#4682B4',
    fileRange: [8, 13] // layer_08.json ... layer_13.json
  },
  ecology: {
    id: 'ecology',
    label: 'Экология и ЧС',
    icon: '🌿',
    color: '#32CD32',
    fileRange: [14, 19] // layer_14.json ... layer_19.json
  },
  politics: {
    id: 'politics',
    label: 'Политика и институты',
    icon: '⚖️',
    color: '#8B0000',
    fileRange: [20, 25] // layer_20.json ... layer_25.json
  },
  science: {
    id: 'science',
    label: 'Наука и технологии',
    icon: '🧪',
    color: '#FFD700',
    fileRange: [26, 31] // layer_26.json ... layer_31.json
  },
  military: {
    id: 'military',
    label: 'Военные объекты',
    icon: '🛡️',
    color: '#DC143C',
    fileRange: [32, 37] // layer_32.json ... layer_37.json
  },
  infrastructure: {
    id: 'infrastructure',
    label: 'Инфраструктура',
    icon: '🏭',
    color: '#FF8C00',
    fileRange: [38, 43] // layer_38.json ... layer_43.json
  },
  cyber: {
    id: 'cyber',
    label: 'Кибербезопасность',
    icon: '🔐',
    color: '#00BFFF',
    fileRange: [44, 49] // layer_44.json ... layer_49.json
  },
  space: {
    id: 'space',
    label: 'Космическая активность',
    icon: '🌌',
    color: '#9370DB',
    fileRange: [50, 55] // layer_50.json ... layer_55.json
  },
  other: {
    id: 'other',
    label: 'Прочие данные',
    icon: '📊',
    color: '#A9A9A9',
    fileRange: [56, 63] // layer_56.json ... layer_63.json
  }
};

// --- 2. ГЕНЕРАЦИЯ СПИСКА СЛОЁВ ---
// Автоматически создаёт DEMO_LAYERS из всех layer_*.json

function generateLayers() {
  const layers = [];
  let counter = 0;

  for (const [catId, cat] of Object.entries(CATEGORY_CONFIG)) {
    const [start, end] = cat.fileRange;
    const count = end - start + 1;

    for (let i = 0; i < count; i++) {
      const fileNum = start + i;
      const fileName = `layer_${String(fileNum).padStart(2, '0')}.json`;

      // Используем имена: категория + номер
      const displayName = `${cat.icon} ${cat.label} (${i + 1}/${count})`;

      layers.push({
        id: fileName.replace('.json', ''),
        name: displayName,
        color: cat.color,
        icon: cat.icon,
        category: catId,
        vizType: 'marker',
        file: fileName,
        // Поля для реестра и фильтрации
        moduleId: `crucix_${catId}`,
        layerCategory: catId
      });

      counter++;
    }
  }

  console.log(`✅ Сгенерировано слоёв: ${layers.length}`);
  return layers;
}

// --- 3. СОЗДАЁМ DEMO_LAYERS ---
const DEMO_LAYERS = generateLayers();

// Добавляем legacy-слои (если они нужны) — можно раскомментировать
// Но сейчас мы полностью заменяем старые слои на новые из layer_*.json

// --- 4. ЭКСПОРТЫ ДЛЯ СОВМЕСТИМОСТИ ---
window.allLayers = DEMO_LAYERS.map((l, idx) => ({
  ...l,
  number: String(idx + 1).padStart(2, '0')
}));

console.log('✅ Загружено слоёв:', window.allLayers.length);
console.log('📋 Доступные категории:', Object.keys(CATEGORY_CONFIG).join(', '));

// ============================================================
// ПАНЕЛЬ СЛОЁВ (совместимость с существующим кодом)
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

function enableAllLayers() {
  document.querySelectorAll('.layer-btn').forEach(btn => {
    const id = btn.dataset.layerId;
    if (id && id !== 'all') {
      window.activeLayerIds.add(id);
      btn.classList.add('active');
    }
  });
  updateActiveCount();
  loadLayer('all');
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
    economy: '💵',
    social: '👥',
    ecology: '🌿',
    politics: '⚖️',
    science: '🧪',
    military: '🛡️',
    infrastructure: '🏭',
    cyber: '🔐',
    space: '🌌',
    other: '📊',
    // Совместимость со старыми категориями
    economics: '📊',
    finance: '💰',
    geopolitical: '🌍',
    ecological: '🌿',
    cyber: '🔒',
    space: '🚀',
    news: '📰',
    esg: '🌱',
    threats: '⚡',
    health: '🏥',
    energy: '⛽',
    transport: '🚛',
    regions: '🌏',
    intelligence: '🧠',
    infrastructure: '🏗️',
    social: '👥'
  };
  const categoryNames = {
    economy: 'Экономика',
    social: 'Социальные',
    ecology: 'Экология',
    politics: 'Политика',
    science: 'Наука',
    military: 'Военный',
    infrastructure: 'Инфраструктура',
    cyber: 'Кибер',
    space: 'Космос',
    other: 'Прочие',
    // Совместимость со старыми категориями
    economics: 'Экономика',
    finance: 'Финансы',
    geopolitical: 'Геополитика',
    ecological: 'Экология',
    cyber: 'Кибер',
    space: 'Космос',
    news: 'Новости',
    esg: 'ESG',
    threats: 'Угрозы',
    health: 'Здоровье',
    energy: 'Энергетика',
    transport: 'Транспорт',
    regions: 'Регионы',
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

console.log('✅ LAYERS.JS готов (' + window.allLayers.length + ' слоёв, ' + Object.keys(CATEGORY_CONFIG).length + ' категорий)');
console.log('📋 Категории:', Object.keys(CATEGORY_CONFIG).join(', '));
