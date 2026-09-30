// ============================================================
//  EVENT MAP — PRESETS
//  Одна задача: сохранение/загрузка наборов активных слоёв.
//  Читает: window.activeLayerIds, window.allLayers.
//  Использует: localStorage (ключ crucix-presets-event-map).
//  Не fetch. Не рисует. Не знает о форматах/SSI/CII.
// ============================================================

(function() {
  'use strict';

  var STORAGE_KEY = 'crucix-presets-event-map';

  function logMsg(m) { console.log('[preset] ' + m); }

  // --- Прочитать все пресеты ---
  function loadAll() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  // --- Записать все пресеты ---
  function saveAll(presets) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
      return true;
    } catch (e) {
      logMsg('ошибка сохранения: ' + e.message);
      return false;
    }
  }

  // --- Сформировать текущий пресет ---
  function getCurrentPreset() {
    var cfg = window.CrucixMap || {};
    return {
      mapType: cfg.mapType || 'unknown',
      layers: Array.from(window.activeLayerIds || new Set()),
      timestamp: Date.now()
    };
  }

  // --- Сохранить как пресет ---
  function saveCurrentAsPreset(name) {
    if (!name) name = 'preset_' + new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
    var presets = loadAll();
    presets[name] = getCurrentPreset();
    if (saveAll(presets)) {
      if (typeof showNotification === 'function') showNotification('Пресет "' + name + '" сохранён', 'success');
      logMsg('сохранён: ' + name + ' (' + presets[name].layers.length + ' слоёв)');
      return true;
    } else {
      if (typeof showNotification === 'function') showNotification('Ошибка сохранения пресета', 'error');
      return false;
    }
  }

  // --- Применить пресет ---
  function applyPreset(name) {
    var presets = loadAll();
    var p = presets[name];
    if (!p || !Array.isArray(p.layers)) {
      if (typeof showNotification === 'function') showNotification('Пресет "' + name + '" не найден', 'error');
      return false;
    }

    // Отключить всё
    if (typeof window.disableAllLayers === 'function') {
      window.disableAllLayers();
    }

    // Включить нужные
    p.layers.forEach(function(id) {
      if (!window.activeLayerIds.has(id) && typeof window.toggleLayer === 'function') {
        window.toggleLayer(id);
      }
    });

    if (typeof showNotification === 'function') {
      showNotification('Пресет "' + name + '" применён (' + p.layers.length + ' слоёв)', 'success');
    }
    logMsg('применён: ' + name);
    return true;
  }

  // --- Удалить пресет ---
  function deletePreset(name) {
    var presets = loadAll();
    if (!presets[name]) return false;
    delete presets[name];
    if (saveAll(presets)) {
      if (typeof showNotification === 'function') showNotification('Пресет "' + name + '" удалён', 'info');
      return true;
    }
    return false;
  }

  // --- Список пресетов ---
  function listPresets() {
    var presets = loadAll();
    return Object.keys(presets).map(function(name) {
      return {
        name: name,
        layersCount: (presets[name].layers || []).length,
        timestamp: presets[name].timestamp || 0
      };
    }).sort(function(a, b) { return b.timestamp - a.timestamp; });
  }

  // --- Экспорт в clipboard JSON ---
  async function exportPreset() {
    var current = getCurrentPreset();
    var json = JSON.stringify(current, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      if (typeof showNotification === 'function') showNotification('Пресет скопирован в буфер', 'success');
      logMsg('экспортирован, ' + current.layers.length + ' слоёв');
    } catch (e) {
      if (typeof showNotification === 'function') showNotification('Ошибка копирования', 'error');
    }
  }

  // --- Импорт из JSON строки ---
  function importPreset(jsonStr) {
    try {
      var p = JSON.parse(jsonStr);
      if (!p || !Array.isArray(p.layers)) throw new Error('bad format');
      if (typeof window.disableAllLayers === 'function') window.disableAllLayers();
      p.layers.forEach(function(id) {
        if (!window.activeLayerIds.has(id) && typeof window.toggleLayer === 'function') {
          window.toggleLayer(id);
        }
      });
      if (typeof showNotification === 'function') showNotification('Пресет импортирован', 'success');
      return true;
    } catch (e) {
      if (typeof showNotification === 'function') showNotification('Ошибка импорта: ' + e.message, 'error');
      return false;
    }
  }

  // --- Экспорт ---
  window.CrucixPresets = {
    saveCurrentAsPreset: saveCurrentAsPreset,
    applyPreset: applyPreset,
    deletePreset: deletePreset,
    listPresets: listPresets,
    exportPreset: exportPreset,
    importPreset: importPreset,
    getCurrentPreset: getCurrentPreset
  };

  logMsg('модуль загружен, пресетов в хранилище: ' + Object.keys(loadAll()).length);
})();
