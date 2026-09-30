// ============================================================
//  EVENT MAP — LAYER HEALTH CHECK
//  Одна задача: проверить все слои, подсветить рабочие.
//  НЕ ТРОГАЕТ layers-panel.js, markers.js, copy-button.js.
//  Добавляет цветную точку на каждую кнопку слоя.
// ============================================================

(function() {
  'use strict';

  function logMsg(m) { console.log('[layer-health] ' + m); }

  var OK = 'ok', EMPTY = 'empty', ERROR = 'error', PENDING = 'pending';

  // --- Привязать кнопки к layer.id (через текст) ---
  function bindButtonIds() {
    var btns = document.querySelectorAll('.layer-btn');
    var layers = window.allLayers || [];
    var matched = 0;

    for (var i = 0; i < btns.length; i++) {
      var btn = btns[i];
      if (btn.dataset.layerId) { matched++; continue; }

      var txt = (btn.textContent || '').trim();
      // Найти слой по совпадению начала текста с name
      for (var j = 0; j < layers.length; j++) {
        var lname = (layers[j].name || '').trim();
        if (lname && txt.indexOf(lname) === 0) {
          btn.dataset.layerId = layers[j].id;
          matched++;
          break;
        }
      }
      // Fallback: по индексу (порядок кнопок = порядок allLayers)
      if (!btn.dataset.layerId && i < layers.length) {
        btn.dataset.layerId = layers[i].id;
        matched++;
      }
    }
    return matched;
  }

  // --- Поставить точку на кнопку ---
  function setDot(layerId, state, count) {
    var btn = document.querySelector('.layer-btn[data-layer-id="' + layerId + '"]');
    if (!btn) return;

    btn.classList.remove('health-pending', 'health-ok', 'health-empty', 'health-error');
    btn.classList.add('health-' + state);

    var dot = btn.querySelector('.health-dot');
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'health-dot';
      btn.insertBefore(dot, btn.firstChild);
    }

    var title = '';
    if (state === OK) title = 'Работает: ' + count + ' объектов';
    else if (state === EMPTY) title = 'Нет данных';
    else if (state === ERROR) title = 'Ошибка сервера';
    else title = 'Проверка...';
    dot.title = title;
  }

  // --- Проверить один слой ---
  async function checkOne(layer) {
    var url = layer.route || ('/api/layers/' + layer.id.replace(/-api$/, ''));
    try {
      var ctrl = new AbortController();
      var tid = setTimeout(function() { ctrl.abort(); }, 5000);
      var res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(tid);

      if (!res.ok) return { state: ERROR, count: 0 };

      var data = await res.json();
      var feats = data.features || [];
      if (feats.length === 0) return { state: EMPTY, count: 0 };

      var c0 = feats[0].geometry && feats[0].geometry.coordinates;
      if (c0 && c0[0] !== 0 && c0[1] !== 0) {
        return { state: OK, count: feats.length };
      }
      return { state: EMPTY, count: feats.length };
    } catch (e) {
      return { state: ERROR, count: 0 };
    }
  }

  // --- Проверить все ---
  async function checkAll() {
    var layers = window.allLayers || [];
    var n = bindButtonIds();
    logMsg('привязано кнопок: ' + n + ', проверка ' + layers.length + ' слоёв...');

    for (var i = 0; i < layers.length; i++) {
      setDot(layers[i].id, PENDING, 0);
    }

    var ok = 0, empty = 0, err = 0;
    var batch = 6;

    for (var b = 0; b < layers.length; b += batch) {
      var chunk = layers.slice(b, b + batch);
      var results = await Promise.all(chunk.map(checkOne));

      for (var j = 0; j < chunk.length; j++) {
        var r = results[j];
        setDot(chunk[j].id, r.state, r.count);
        if (r.state === OK) ok++;
        else if (r.state === EMPTY) empty++;
        else err++;
      }
    }

    logMsg('готово: OK=' + ok + ', пусто=' + empty + ', ошибки=' + err);

    var el = document.getElementById('layer-count');
    if (el) el.textContent = ok + '/' + layers.length;

    var el2 = document.getElementById('active-layers-count');
    if (el2) el2.textContent = ok;
  }

  // --- Старт после отрисовки панели ---
  document.addEventListener('crucix:layers-loaded', function() {
    setTimeout(checkAll, 600);
  });

  document.addEventListener('crucix:map-initialized', function() {
    if (document.querySelectorAll('.layer-btn').length > 0) {
      setTimeout(checkAll, 300);
    }
  });

  window.CrucixLayerHealth = { checkAll: checkAll, checkOne: checkOne };
  logMsg('модуль загружен');
})();
