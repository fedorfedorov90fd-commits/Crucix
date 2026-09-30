// ============================================================
//  EVENT MAP — INIT
//  Одна задача: точка входа. Порядок загрузки модулей.
//  Загружается ПОСЛЕДНИМ. Дожидается DOMContentLoaded.
//  Создаёт карту, границы, панель, навешивает обработчики.
// ============================================================

(function() {
  'use strict';

  function logMsg(m) { console.log('[init] ' + m); }

  // --- Скрыть оверлей загрузки ---
  function hideLoading() {
    var o = document.getElementById('loading-overlay');
    if (o) o.style.display = 'none';
  }

  // --- Установить время последнего обновления ---
  function setUpdateTime() {
    var el = document.getElementById('update-text');
    if (el) el.textContent = new Date().toLocaleTimeString();
    var dot = document.getElementById('status-dot');
    if (dot) dot.classList.add('active');
  }

  // --- Навесить обработчики топбара ---
  function bindTopbarControls() {
    // Селект интервала автообновления
    var sel = document.getElementById('refresh-interval');
    if (sel) {
      // Значения в миллисекундах, конвертируем в секунды
      var saved = localStorage.getItem('crucix-refresh-event-map');
      if (saved) sel.value = saved;

      sel.addEventListener('change', function() {
        var ms = parseInt(this.value, 10) || 0;
        localStorage.setItem('crucix-refresh-event-map', this.value);
        if (window.CrucixRefresh && typeof window.CrucixRefresh.startAutoRefresh === 'function') {
          window.CrucixRefresh.startAutoRefresh(Math.floor(ms / 1000));
        }
      });

      // Автозапуск с сохранённым значением
      var initialMs = parseInt(sel.value, 10) || 0;
      if (initialMs > 0 && window.CrucixRefresh) {
        window.CrucixRefresh.startAutoRefresh(Math.floor(initialMs / 1000));
      }
    }

    // Кнопка "Обновить сейчас"
    var nowBtn = document.getElementById('refresh-now-btn');
    if (nowBtn) {
      nowBtn.addEventListener('click', function() {
        if (window.CrucixRefresh && typeof window.CrucixRefresh.refreshAll === 'function') {
          window.CrucixRefresh.refreshAll();
        }
      });
    }

    // Кнопка toggle лог-панели (в HTML onclick на window.toggleLogs)
    // уже настроена через алиас в logger.js — не трогаем.

    // Поиск слоёв
    var search = document.getElementById('layer-search');
    if (search) {
      search.addEventListener('input', function() {
        if (typeof window.filterLayers === 'function') {
          window.filterLayers(this.value);
        }
      });
    }
  }

  // --- Дождаться crucix:layers-loaded ---
  function waitForLayersLoaded() {
    return new Promise(function(resolve) {
      if (window.allLayers && window.allLayers.length > 0) {
        // Уже загружены (layers.js отработал синхронно)
        resolve(window.allLayers.length);
        return;
      }
      document.addEventListener('crucix:layers-loaded', function(evt) {
        resolve((evt.detail && evt.detail.count) || 0);
      }, { once: true });
      // Таймаут на всякий случай
      setTimeout(function() { resolve(window.allLayers ? window.allLayers.length : 0); }, 1000);
    });
  }

  // --- Основной запуск ---
  async function boot() {
    logMsg('запуск');

    // 1. Карта
    if (window.CrucixMapBase && typeof window.CrucixMapBase.initMap === 'function') {
      window.CrucixMapBase.initMap();
    } else {
      logMsg('ОШИБКА: CrucixMapBase.initMap недоступен');
      return;
    }

    // 2. Границы
    if (window.CrucixMapBase && typeof window.CrucixMapBase.loadBoundaries === 'function') {
      window.CrucixMapBase.loadBoundaries().catch(function(e) {
        logMsg('границы не загружены: ' + e.message);
      });
    }

    // 3. Дождаться crucix:layers-loaded
    var count = await waitForLayersLoaded();
    logMsg('слоёв загружено: ' + count);

    // 4. Панель слоёв
    if (typeof window.renderLayerPanel === 'function') {
      window.renderLayerPanel();
    } else {
      logMsg('ОШИБКА: renderLayerPanel недоступен');
    }

    // 5. Язык
    var lang = localStorage.getItem('crucix-lang-event-map') || (window.CrucixMap && window.CrucixMap.defaultLanguage) || 'ru';
    if (typeof window.setLanguage === 'function') window.setLanguage(lang);

    // 6. Топбар
    bindTopbarControls();

    // 7. Оверлей и время
    hideLoading();
    setUpdateTime();

    logMsg('карта готова: ' + count + ' слоёв, mapType=' + ((window.CrucixMap && window.CrucixMap.mapType) || '?'));
    document.dispatchEvent(new CustomEvent('crucix:map-initialized', {
      detail: { count: count }
    }));
  }

  // --- Автозапуск ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // --- Экспорт ---
  window.CrucixInit = { boot: boot };
})();
