console.log('layer-panel.js загружен');
var categoryStates = {};
var panelVisible = true;

function renderLayerPanel(layers) {
    var container = document.getElementById('layer-list');
    if (!container) { console.warn('layer-list не найден'); return; }
    container.innerHTML = '';

    var catIcons = {
        military:'\u2694\ufe0f', financial:'\ud83d\udcb0', ecological:'\ud83c\udf3f',
        infrastructure:'\ud83d\udc1d', social:'\ud83d\udc65', space:'\ud83d\ude80',
        cyber:'\ud83d\udcbb', news:'\ud83d\udcf0', energy:'\u26fd', maritime:'\ud83d\udea2',
        transport:'\ud83d\ude9b', health:'\ud83c\udfe5', economic:'\ud83d\udcca',
        intelligence:'\ud83d\udce1', semantic:'\ud83e\udde0', other:'\ud83d\udccc'
    };
    var catNames = {
        military:'Военные', financial:'Финансы', ecological:'Экология',
        infrastructure:'Инфраструктура', social:'Социальные', space:'Космос',
        cyber:'Кибер', news:'Новости', energy:'Энергетика', maritime:'Морские',
        transport:'Транспорт', health:'Здоровье', economic:'Экономика',
        intelligence:'Разведка', semantic:'Семантика', other:'Другие'
    };

    // Кнопка "ВСЕ"
    var allDiv = document.createElement('div');
    allDiv.style.cssText = 'margin-bottom:6px;border-bottom:1px solid rgba(91,192,248,0.15);padding-bottom:4px;';
    var allBtn = document.createElement('button');
    allBtn.className = 'layer-btn active';
    allBtn.dataset.layerId = 'all';
    allBtn.style.cssText = 'display:flex;align-items:center;gap:6px;width:100%;padding:5px 8px;background:rgba(91,192,248,0.12);border:1px solid rgba(91,192,248,0.2);border-radius:4px;color:#c8d0d8;font-size:12px;cursor:pointer;';
    allBtn.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:#5bc0f8;"></span> Все слои (' + layers.length + ')';
    allBtn.onclick = function() { loadLayer('all'); };
    allDiv.appendChild(allBtn);
    container.appendChild(allDiv);

    // Категории
    var cats = {};
    for (var i = 0; i < layers.length; i++) {
        var c = layers[i].category || 'other';
        if (!cats[c]) cats[c] = [];
        cats[c].push(layers[i]);
    }
    var keys = Object.keys(cats).sort(function(a,b) { return cats[b].length - cats[a].length; });

    for (var k = 0; k < keys.length; k++) {
        var cat = keys[k];
        var items = cats[cat];
        var div = document.createElement('div');
        div.style.cssText = 'padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);';

        var header = document.createElement('div');
        header.style.cssText = 'cursor:pointer;padding:4px;font-size:11px;color:#8899aa;display:flex;align-items:center;gap:4px;';
        header.innerHTML = (catIcons[cat]||'\ud83d\udccc') + ' ' + (catNames[cat]||cat) + ' (' + items.length + ')';
        header.onclick = function() { toggleCategory(this.dataset.cat); };
        header.dataset.cat = cat;
        div.appendChild(header);

        var grid = document.createElement('div');
        grid.id = 'grid-' + cat;
        grid.style.cssText = 'display:flex;flex-direction:column;gap:2px;margin-top:4px;padding-left:8px;';

        for (var j = 0; j < items.length; j++) {
            var layer = items[j];
            var btn = document.createElement('button');
            btn.className = 'layer-btn';
            btn.dataset.layerId = layer.id;
            btn.dataset.category = cat;
            btn.style.cssText = 'display:flex;align-items:center;gap:5px;padding:4px 8px;background:transparent;border:1px solid transparent;border-radius:4px;color:#c8d0d8;font-size:11px;cursor:pointer;text-align:left;';
            btn.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:' + (layer.color||'#4a5a6a') + ';flex-shrink:0;"></span>' + (layer.name||layer.id);
            btn.onclick = function() { loadLayer(this.dataset.layerId); };
            grid.appendChild(btn);
        }
        div.appendChild(grid);
        container.appendChild(div);
        categoryStates[cat] = true;
    }
    console.log('[layer-panel] Отрендерено: ' + layers.length + ' слоёв');
}

function toggleCategory(cat) {
    categoryStates[cat] = !categoryStates[cat];
    var grid = document.getElementById('grid-' + cat);
    if (grid) grid.style.display = categoryStates[cat] ? 'flex' : 'none';
}

function loadLayer(layerId) {
    var btns = document.querySelectorAll('.layer-btn');
    for (var i = 0; i < btns.length; i++) {
        var active = btns[i].dataset.layerId === layerId;
        btns[i].style.background = active ? 'rgba(91,192,248,0.15)' : 'transparent';
        btns[i].style.borderColor = active ? 'rgba(91,192,248,0.3)' : 'transparent';
    }
    localStorage.setItem('crucix-active-layer', layerId);

    var all = window.markerData || [];
    if (layerId === 'all') {
        if (typeof updateMarkers === 'function') updateMarkers(all);
        showNotification('Все слои: ' + all.length + ' маркеров');
        return;
    }
    var filtered = [];
    for (var i = 0; i < all.length; i++) {
        if (all[i].layer === layerId) filtered.push(all[i]);
    }
    if (typeof updateMarkers === 'function') updateMarkers(filtered);
    showNotification(filtered.length + ' маркеров');
}

function toggleLayerPanel() {
    panelVisible = !panelVisible;
    var panel = document.getElementById('layer-panel');
    var sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('collapsed', !panelVisible);
    if (window.leafletMap) setTimeout(function() { window.leafletMap.invalidateSize(); }, 300);
}

window.renderLayerPanel = renderLayerPanel;
window.toggleCategory = toggleCategory;
window.loadLayer = loadLayer;
window.toggleLayerPanel = toggleLayerPanel;
console.log('layer-panel.js готов');
