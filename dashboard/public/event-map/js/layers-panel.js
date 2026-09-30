// ============================================================
//  EVENT MAP — LAYERS PANEL
//  Одна задача: рендер панели слоёв, toggle, поиск.
//  Слушает crucix:layers-loaded. Не знает о карте и маркерах.
// ============================================================

(function() {
  'use strict';

  // Состояние активных слоёв — только здесь.
  if (!window.activeLayerIds) window.activeLayerIds = new Set();

  var _panelReady = false;

  function renderLayerPanel() {
    var grid = document.getElementById('layer-grid');
    if (!grid) return;

    grid.innerHTML = '';

    // Группировка по категориям.
    var byCategory = {};
    window.allLayers.forEach(function(layer) {
      if (!byCategory[layer.category]) byCategory[layer.category] = [];
      byCategory[layer.category].push(layer);
    });

    // Сортировка категорий по алфавиту.
    var cats = Object.keys(byCategory).sort();

    cats.forEach(function(cat) {
      var header = document.createElement('div');
      header.className = 'layer-category-header';
      header.textContent = cat + ' (' + byCategory[cat].length + ')';
      grid.appendChild(header);

      byCategory[cat].forEach(function(layer) {
        var btn = document.createElement('button');
        btn.className = 'layer-btn' + (window.activeLayerIds.has(layer.id) ? ' active' : '');
        btn.style.borderLeftColor = layer.color || '#888';
        btn.dataset.layerId = layer.id;
        btn.innerHTML = '<span class="icon">' + (layer.icon || '•') + '</span> <span class="name">' + layer.name + '</span>';
        btn.addEventListener('click', function() {
          toggleLayer(layer.id);
        });
        grid.appendChild(btn);
      });
    });

    updateLayerCount();
    _panelReady = true;

    document.dispatchEvent(new CustomEvent('crucix:panel-rendered', {
      detail: { count: window.allLayers.length }
    }));
    console.log('[layers-panel] панель отрисована, ' + window.allLayers.length + ' слоёв');
  }

  function toggleLayer(id) {
    if (window.activeLayerIds.has(id)) {
      window.activeLayerIds.delete(id);
      document.dispatchEvent(new CustomEvent('crucix:layer-disabled', { detail: { id: id } }));
    } else {
      window.activeLayerIds.add(id);
      document.dispatchEvent(new CustomEvent('crucix:layer-enabled', { detail: { id: id } }));
    }
    updateButtonState(id);
    updateLayerCount();

    // Оповестить остальные модули
    document.dispatchEvent(new CustomEvent('crucix:layer-toggled', {
      detail: { id: id, active: window.activeLayerIds.has(id) }
    }));
  }

  function updateButtonState(id) {
    var btn = document.querySelector('.layer-btn[data-layer-id="' + id + '"]');
    if (!btn) return;
    if (window.activeLayerIds.has(id)) btn.classList.add('active');
    else btn.classList.remove('active');
  }

  function updateLayerCount() {
    var el = document.getElementById('layer-count');
    if (el) el.textContent = window.allLayers.length;
    var active = document.getElementById('active-count');
    if (active) active.textContent = window.activeLayerIds.size + ' active';
  }

  function enableAllLayers() {
    window.allLayers.forEach(function(l) {
      if (!window.activeLayerIds.has(l.id)) toggleLayer(l.id);
    });
  }

  function disableAllLayers() {
    Array.from(window.activeLayerIds).forEach(function(id) { toggleLayer(id); });
  }

  function filterLayers(query) {
    var q = (query || '').toLowerCase().trim();
    document.querySelectorAll('.layer-btn').forEach(function(btn) {
      var match = !q || btn.textContent.toLowerCase().indexOf(q) >= 0;
      btn.style.display = match ? '' : 'none';
    });
  }

  function toggleLayerPanel() {
    var p = document.getElementById('layer-panel');
    if (!p) return;
    p.classList.toggle('collapsed');
  }

  // Экспорт в window — точки входа для onclick в HTML
  window.renderLayerPanel = renderLayerPanel;
  window.toggleLayer = toggleLayer;
  window.enableAllLayers = enableAllLayers;
  window.disableAllLayers = disableAllLayers;
  window.filterLayers = filterLayers;
  window.toggleLayerPanel = toggleLayerPanel;

  // Автозапуск: ждём событие layers-loaded
  document.addEventListener('crucix:layers-loaded', function() {
    if (!_panelReady) renderLayerPanel();
  });

  console.log('[layers-panel] модуль загружен, ожидает crucix:layers-loaded');
})();
