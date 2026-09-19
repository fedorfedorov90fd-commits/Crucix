// ============================================================
// LAYERS.JS — 60 СЛОЁВ, 12 КАТЕГОРИЙ
// Конфигурация отображения слоёв Crucix на панели управления
// ============================================================

console.log('📚 LAYERS.JS загружен (60 слоёв, 12 категорий)');

export const layersConfig = [
  {
    id: 'economy',
    name: 'Экономика',
    icon: '💹',
    prefix: 'crucix_economy',
    files: [
      'layer_00.json', 'layer_01.json', 'layer_02.json', 'layer_03.json'
    ]
  },
  {
    id: 'social',
    name: 'Социальные',
    icon: '👥',
    prefix: 'crucix_social',
    files: [
      'layer_04.json', 'layer_05.json', 'layer_06.json', 'layer_07.json'
    ]
  },
  {
    id: 'ecology',
    name: 'Экология',
    icon: '🌿',
    prefix: 'crucix_ecology',
    files: [
      'layer_08.json', 'layer_09.json', 'layer_10.json', 'layer_11.json'
    ]
  },
  {
    id: 'finance',
    name: 'Финансы',
    icon: '💰',
    prefix: 'crucix_finance',
    files: [
      'layer_12.json', 'layer_13.json', 'layer_14.json', 'layer_15.json'
    ]
  },
  {
    id: 'geopolitics',
    name: 'Геополитика',
    icon: '🌍',
    prefix: 'crucix_geopolitics',
    files: [
      'layer_16.json', 'layer_17.json', 'layer_18.json', 'layer_19.json'
    ]
  },
  {
    id: 'news',
    name: 'Новости и медиа',
    icon: '📰',
    prefix: 'crucix_news',
    files: [
      'layer_20.json', 'layer_21.json', 'layer_22.json', 'layer_23.json',
      'layer_24.json', 'layer_25.json'
    ]
  },
  {
    id: 'science',
    name: 'Наука и технологии',
    icon: '🧪',
    prefix: 'crucix_science',
    files: [
      'layer_26.json', 'layer_27.json', 'layer_28.json', 'layer_29.json',
      'layer_30.json', 'layer_31.json'
    ]
  },
  {
    id: 'military',
    name: 'Военные объекты',
    icon: '🛡️',
    prefix: 'crucix_military',
    files: [
      'layer_32.json', 'layer_33.json', 'layer_34.json', 'layer_35.json',
      'layer_36.json', 'layer_37.json'
    ]
  },
  {
    id: 'infrastructure',
    name: 'Инфраструктура',
    icon: '🏭',
    prefix: 'crucix_infra',
    files: [
      'layer_38.json', 'layer_39.json', 'layer_40.json', 'layer_41.json',
      'layer_42.json', 'layer_43.json'
    ]
  },
  {
    id: 'cyber',
    name: 'Кибербезопасность',
    icon: '🔐',
    prefix: 'crucix_cyber',
    files: [
      'layer_44.json', 'layer_45.json', 'layer_46.json', 'layer_47.json',
      'layer_48.json', 'layer_49.json'
    ]
  },
  {
    id: 'space',
    name: 'Космическая активность',
    icon: '🌌',
    prefix: 'crucix_space',
    files: [
      'layer_50.json', 'layer_51.json', 'layer_52.json', 'layer_53.json',
      'layer_54.json', 'layer_55.json'
    ]
  },
  {
    id: 'other',
    name: 'Прочие данные',
    icon: '📊',
    prefix: 'crucix_other',
    files: [
      'layer_56.json', 'layer_57.json', 'layer_58.json', 'layer_59.json'
    ]
  }
];

// ============================================================
// ИКОНКИ И НАЗВАНИЯ КАТЕГОРИЙ (для панели)
// ============================================================

const categoryIcons = {
  economy: '💹',
  social: '👥',
  ecology: '🌿',
  finance: '💰',
  geopolitics: '🌍',
  news: '📰',
  science: '🧪',
  military: '🛡️',
  infrastructure: '🏭',
  cyber: '🔐',
  space: '🌌',
  other: '📊'
};

const categoryNames = {
  economy: 'Экономика',
  social: 'Социальные',
  ecology: 'Экология',
  finance: 'Финансы',
  geopolitics: 'Геополитика',
  news: 'Новости и медиа',
  science: 'Наука и технологии',
  military: 'Военные объекты',
  infrastructure: 'Инфраструктура',
  cyber: 'Кибербезопасность',
  space: 'Космическая активность',
  other: 'Прочие данные'
};

// ============================================================
// АКТИВНЫЕ СЛОИ — управление состоянием
// ============================================================

window.activeLayerIds = new Set();
window.layerCache = {};
window.markerData = [];
window.currentLayer = null;

// ============================================================
// ЗАГРУЗКА СЛОЯ (TOGGLE — ВКЛ/ВЫКЛ)
// ============================================================

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

    // Удаляем слой с карты
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

    // Показываем остальные активные слои
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
    // Включаем все слои
    document.querySelectorAll('.layer-btn').forEach(btn => {
      const id = btn.dataset.layerId;
      if (id && id !== 'all') {
        window.activeLayerIds.add(id);
        btn.classList.add('active');
      }
    });
    updateActiveCount();
    if (typeof updateLegend === 'function') updateLegend();
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

    // Кэшируем данные
    window.layerCache[layerId] = data.features;

    // Создаём GeoJSON-слой
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

    if (window.map) layer.addTo(window.map);
    activeLayers[layerId] = layer;

    // Обновляем маркеры
    let all = [];
    for (const id of window.activeLayerIds) {
      if (window.layerCache[id]) {
        all = all.concat(window.layerCache[id]);
      }
    }
    if (typeof updateMarkers === 'function') updateMarkers(all);
    if (typeof window.showNotification === 'function') {
      window.showNotification(`✅ Слой включён: ${layerId}`);
    }
  } catch (err) {
    console.error(`Ошибка загрузки слоя ${layerId}:`, err);
    if (typeof window.showNotification === 'function') {
      window.showNotification(`❌ Ошибка загрузки: ${err.message}`);
    }
  }
}

// ============================================================
// ОБНОВЛЕНИЕ СЧЁТЧИКА АКТИВНЫХ СЛОЁВ
// ============================================================

function updateActiveCount() {
  const countEl = document.getElementById('active-count');
  if (countEl) {
    countEl.textContent = window.activeLayerIds.size;
  }
}

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

  // Кнопка "Все слои"
  const allDiv = document.createElement('div');
  allDiv.className = 'layer-category';
  allDiv.style.marginBottom = '6px';
  allDiv.style.borderBottom = '1px solid rgba(91,192,248,0.15)';
  allDiv.style.paddingBottom = '4px';

  const allBtn = document.createElement('button');
  allBtn.className = 'layer-btn';
  allBtn.dataset.layerId = 'all';
  allBtn.innerHTML = '<span class="layer-icon">🌐</span> Все слои';
  allBtn.onclick = () => loadLayer('all');
  allDiv.appendChild(allBtn);
  container.appendChild(allDiv);

  // Группируем слои по категориям
  const categories = {};
  layers.forEach(l => {
    if (!categories[l.category]) categories[l.category] = [];
    categories[l.category].push(l);
  });

  // Рендерим каждую категорию
  for (const [catId, catLayers] of Object.entries(categories)) {
    const catDiv = document.createElement('div');
    catDiv.className = 'layer-category';
    catDiv.dataset.category = catId;

    const header = document.createElement('div');
    header.className = 'layer-category-header';
    header.onclick = () => toggleCategory(catId);
    header.innerHTML = `
      <span class="arrow open">▼</span>
      <span class="cat-icon">${categoryIcons[catId] || '📌'}</span>
      <span class="cat-name">${categoryNames[catId] || catId}</span>
      <span class="cat-count">(${catLayers.length})</span>
    `;
    catDiv.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'layer-grid';
    grid.id = 'grid-' + catId;

    catLayers.forEach(layer => {
      const btn = document.createElement('button');
      btn.className = 'layer-btn';
      btn.dataset.layerId = layer.id;
      btn.innerHTML = `<span class="layer-icon">${layer.icon || '📍'}</span> ${layer.name || layer.id}`;
      btn.onclick = () => loadLayer(layer.id);
      grid.appendChild(btn);
    });

    catDiv.appendChild(grid);
    container.appendChild(catDiv);
  }
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

function initLayers() {
  // Собираем все слои из layersConfig
  const allLayers = [];
  layersConfig.forEach(cat => {
    cat.files.forEach((file, idx) => {
      allLayers.push({
        id: `${cat.prefix}_${idx}`,
        name: `${cat.name} ${idx + 1}`,
        icon: cat.icon,
        category: cat.id,
        file: file
      });
    });
  });

  if (typeof renderLayerPanel === 'function') {
    renderLayerPanel(allLayers);
  }
  updateActiveCount();
}

// Авто-инициализация
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLayers);
} else {
  initLayers();
}

console.log('✅ LAYERS.JS готов (60 слоёв, 12 категорий, toggle-логика)');
