// ============================================================
// PRESETS.JS — Системные и пользовательские пресеты слоёв
// ============================================================

console.log('🎛️ PRESETS.JS загружен');

let systemPresets = {};
let userPresets = {};
let currentPreset = null;

// --- Загрузка системных пресетов из файла ---
async function loadSystemPresets() {
    try {
        const resp = await fetch('/data/presets.json');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        systemPresets = await resp.json();
        console.log('✅ Системные пресеты загружены:', Object.keys(systemPresets).length);
    } catch (err) {
        console.warn('⚠️ Не удалось загрузить presets.json:', err.message);
        systemPresets = {};
    }
}

// --- Загрузка пользовательских пресетов из localStorage ---
function loadUserPresets() {
    try {
        const raw = localStorage.getItem('crucix-presets');
        userPresets = raw ? JSON.parse(raw) : {};
        console.log('✅ Пользовательских пресетов:', Object.keys(userPresets).length);
    } catch {
        userPresets = {};
    }
}

// --- Сохранение пользовательских пресетов в localStorage ---
function saveUserPresets() {
    localStorage.setItem('crucix-presets', JSON.stringify(userPresets));
}

// --- Получить все пресеты (системные + пользовательские) ---
function getAllPresets() {
    return { ...systemPresets, ...userPresets };
}

// --- Применить пресет ---
function applyPreset(presetId) {
    const all = getAllPresets();
    const preset = all[presetId];
    if (!preset) {
        console.warn('Пресет не найден:', presetId);
        return;
    }

    currentPreset = presetId;

    // 1. Выключаем все слои
    if (typeof disableAllLayers === 'function') {
        disableAllLayers();
    } else {
        window.activeLayerIds.clear();
        document.querySelectorAll('.layer-btn').forEach(btn => {
            if (btn.dataset.layerId && btn.dataset.layerId !== 'all') {
                btn.classList.remove('active');
            }
        });
    }

    // 2. Включаем слои из пресета
    if (preset.enabledLayers && preset.enabledLayers.length > 0) {
        for (const layerId of preset.enabledLayers) {
            window.activeLayerIds.add(layerId);
            document.querySelectorAll('.layer-btn').forEach(btn => {
                if (btn.dataset.layerId === layerId) {
                    btn.classList.add('active');
                }
            });
        }
    } else {
        // Если enabledLayers пустой — включаем все (режим Crucix по умолчанию)
        if (typeof enableAllLayers === 'function') {
            enableAllLayers();
        }
    }

    // 3. Обновляем счётчик
    if (typeof updateActiveCount === 'function') updateActiveCount();
    if (typeof updateLegend === 'function') updateLegend();

    // 4. Центр и масштаб
    if (preset.center && preset.zoom && window.map) {
        window.map.setView(preset.center, preset.zoom);
    }

    // 5. Загружаем данные активных слоёв
    loadActiveLayersData();

    // 6. Обновляем UI
    updatePresetSelector(presetId);

    if (typeof window.showNotification === 'function') {
        window.showNotification(`🎛️ Пресет: ${preset.name}`);
    }

    console.log(`✅ Применён пресет: ${preset.name}`);
}

// --- Загрузка данных для активных слоёв ---
async function loadActiveLayersData() {
    let all = [];
    for (const id of window.activeLayerIds) {
        if (window.layerCache && window.layerCache[id]) {
            all = all.concat(window.layerCache[id]);
        } else {
            try {
                const resp = await fetch(`/api/layers/${id}`);
                if (resp.ok) {
                    const data = await resp.json();
                    if (data.features) {
                        window.layerCache = window.layerCache || {};
                        window.layerCache[id] = data.features;
                        all = all.concat(data.features);
                    }
                }
            } catch (err) {
                console.warn(`Не удалось загрузить слой ${id}:`, err.message);
            }
        }
    }
    if (typeof updateMarkers === 'function') updateMarkers(all);
}

// --- Сохранить текущую компоновку как пресет ---
function saveCurrentAsPreset(name) {
    if (!name || !name.trim()) {
        if (typeof window.showNotification === 'function') {
            window.showNotification('⚠️ Введите имя пресета');
        }
        return;
    }

    const id = 'user_' + name.trim().toLowerCase().replace(/[^a-zа-я0-9]/gi, '_') + '_' + Date.now();

    const activeIds = Array.from(window.activeLayerIds);

    let center = [55.75, 37.61];
    let zoom = 5;
    if (window.map) {
        center = [window.map.getCenter().lat, window.map.getCenter().lng];
        zoom = window.map.getZoom();
    }

    userPresets[id] = {
        name: name.trim(),
        description: 'Пользовательская компоновка',
        enabledLayers: activeIds,
        center: center,
        zoom: zoom,
        system: false,
        created: new Date().toISOString()
    };

    saveUserPresets();
    rebuildPresetSelector();

    if (typeof window.showNotification === 'function') {
        window.showNotification(`💾 Сохранено: ${name}`);
    }

    console.log(`✅ Пресет сохранён: ${name} (${activeIds.length} слоёв)`);
}

// --- Удалить пользовательский пресет ---
function deletePreset(presetId) {
    if (userPresets[presetId]) {
        const name = userPresets[presetId].name;
        delete userPresets[presetId];
        saveUserPresets();
        rebuildPresetSelector();
        if (typeof window.showNotification === 'function') {
            window.showNotification(`🗑️ Удалён: ${name}`);
        }
    }
}

// --- Экспорт пресета в JSON-файл ---
function exportPreset(presetId) {
    const all = getAllPresets();
    const preset = all[presetId];
    if (!preset) return;

    const data = JSON.stringify({ [presetId]: preset }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `preset-${preset.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    if (typeof window.showNotification === 'function') {
        window.showNotification(`📤 Экспорт: ${preset.name}`);
    }
}

// --- Импорт пресета из JSON-файла ---
function importPreset(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            for (const [id, preset] of Object.entries(data)) {
                preset.system = false;
                preset.imported = true;
                userPresets[id] = preset;
            }
            saveUserPresets();
            rebuildPresetSelector();
            if (typeof window.showNotification === 'function') {
                window.showNotification(`📥 Импортирован пресет`);
            }
        } catch (err) {
            if (typeof window.showNotification === 'function') {
                window.showNotification('❌ Ошибка импорта: неверный JSON');
            }
        }
    };
    reader.readAsText(file);
}

// --- Построить выпадающий список пресетов ---
function rebuildPresetSelector() {
    const select = document.getElementById('preset-select');
    if (!select) return;

    select.innerHTML = '';

    // Системные
    const sysGroup = document.createElement('optgroup');
    sysGroup.label = 'Системные';
    for (const [id, preset] of Object.entries(systemPresets)) {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = preset.name;
        sysGroup.appendChild(opt);
    }
    select.appendChild(sysGroup);

    // Пользовательские
    const userKeys = Object.keys(userPresets);
    if (userKeys.length > 0) {
        const userGroup = document.createElement('optgroup');
        userGroup.label = 'Мои пресеты';
        for (const [id, preset] of Object.entries(userPresets)) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = `${preset.name} (${preset.enabledLayers?.length || 0} сл.)`;
            userGroup.appendChild(opt);
        }
        select.appendChild(userGroup);
    }

    if (currentPreset) {
        select.value = currentPreset;
    }
}

// --- Обновить выделение в списке ---
function updatePresetSelector(presetId) {
    const select = document.getElementById('preset-select');
    if (select) select.value = presetId;
}

// --- Создать UI панель пресетов ---
function createPresetPanel() {
    const panel = document.getElementById('layer-panel');
    if (!panel) {
        console.warn('Панель слоёв не найдена, пресеты не вставлены');
        return;
    }

    // Проверяем, не добавили ли уже
    if (document.getElementById('preset-container')) return;

    const container = document.createElement('div');
    container.id = 'preset-container';
    container.style.cssText = `
        padding: 8px 10px;
        border-bottom: 1px solid rgba(91,192,248,0.2);
        margin-bottom: 6px;
        background: rgba(91,192,248,0.05);
        border-radius: 4px;
    `;

    container.innerHTML = `
        <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
            <span style="font-size:14px;">🎛️</span>
            <span style="font-size:12px; font-weight:600; color:#5bc0f8;">ПРЕСЕТЫ</span>
        </div>
        <select id="preset-select" style="
            width: 100%;
            padding: 5px 8px;
            border: 1px solid rgba(91,192,248,0.3);
            border-radius: 4px;
            background: rgba(15,25,35,0.9);
            color: #ccc;
            font-size: 12px;
            margin-bottom: 6px;
        ">
            <option value="">— Выбрать пресет —</option>
        </select>
        <div style="display:flex; gap:4px; flex-wrap:wrap;">
            <button id="btn-apply-preset" style="
                flex:1; padding:5px 8px; font-size:11px;
                border:1px solid rgba(91,192,248,0.3);
                border-radius:4px; background:rgba(91,192,248,0.1);
                color:#5bc0f8; cursor:pointer;
            ">Применить</button>
            <button id="btn-save-preset" style="
                flex:1; padding:5px 8px; font-size:11px;
                border:1px solid rgba(0,204,136,0.3);
                border-radius:4px; background:rgba(0,204,136,0.1);
                color:#00cc88; cursor:pointer;
            ">Сохранить</button>
            <button id="btn-delete-preset" style="
                padding:5px 8px; font-size:11px;
                border:1px solid rgba(255,68,68,0.3);
                border-radius:4px; background:rgba(255,68,68,0.1);
                color:#ff4444; cursor:pointer;
            ">🗑</button>
            <button id="btn-export-preset" style="
                padding:5px 8px; font-size:11px;
                border:1px solid rgba(255,170,0,0.3);
                border-radius:4px; background:rgba(255,170,0,0.1);
                color:#ffaa00; cursor:pointer;
            ">📤</button>
            <label style="
                padding:5px 8px; font-size:11px;
                border:1px solid rgba(255,255,255,0.2);
                border-radius:4px; background:rgba(255,255,255,0.05);
                color:#aaa; cursor:pointer;
            ">📥<input type="file" accept=".json" style="display:none;" id="import-preset-file"></label>
        </div>
    `;

    // Вставляем в начало панели
    panel.insertBefore(container, panel.firstChild);

    // Обработчики
    document.getElementById('btn-apply-preset').onclick = () => {
        const id = document.getElementById('preset-select').value;
        if (id) applyPreset(id);
    };

    document.getElementById('btn-save-preset').onclick = () => {
        const name = prompt('Имя пресета:');
        if (name) saveCurrentAsPreset(name);
    };

    document.getElementById('btn-delete-preset').onclick = () => {
        const id = document.getElementById('preset-select').value;
        if (id && userPresets[id]) {
            if (confirm(`Удалить «${userPresets[id].name}»?`)) {
                deletePreset(id);
            }
        } else if (id && systemPresets[id]) {
            if (typeof window.showNotification === 'function') {
                window.showNotification('⚠️ Системный пресет нельзя удалить');
            }
        }
    };

    document.getElementById('btn-export-preset').onclick = () => {
        const id = document.getElementById('preset-select').value;
        if (id) exportPreset(id);
    };

    document.getElementById('import-preset-file').onchange = (e) => {
        if (e.target.files[0]) importPreset(e.target.files[0]);
    };
}

// --- Инициализация ---
async function initPresets() {
    await loadSystemPresets();
    loadUserPresets();
    createPresetPanel();
    rebuildPresetSelector();
    console.log('✅ PRESETS.JS готов');
}

// Автозапуск после загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPresets);
} else {
    initPresets();
}

// Экспорт функций
window.applyPreset = applyPreset;
window.saveCurrentAsPreset = saveCurrentAsPreset;
window.deletePreset = deletePreset;
window.exportPreset = exportPreset;
window.importPreset = importPreset;
window.rebuildPresetSelector = rebuildPresetSelector;
