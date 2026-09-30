// ============================================================
//  EVENT MAP — LOGGER
//  Одна задача: лог-панель (внутренняя консоль карты).
//  Тоггл по кнопке LOGS в топбаре.
//  Читает: ничего. Экспорт: window.CrucixLogger.
//  Не перехватывает console.log глобально.
//  Не знает про слои/форматы/карту.
// ============================================================

(function() {
  'use strict';

  var MAX_LINES = 200;
  var lines = [];
  var logsVisible = false;

  function nowStr() {
    var d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' +
           ('0' + d.getMinutes()).slice(-2) + ':' +
           ('0' + d.getSeconds()).slice(-2);
  }

  // --- Создать панель ---
  function createPanel() {
    var panel = document.createElement('div');
    panel.id = 'logs-panel';
    panel.className = 'logs-panel';
    panel.innerHTML =
      '<div class="logs-header">Logs ' +
      '<button id="logs-clear" title="Очистить">Clear</button> ' +
      '<button id="logs-close" title="Закрыть">X</button>' +
      '</div>' +
      '<div class="logs-content" id="logs-content"></div>';

    document.body.appendChild(panel);

    panel.querySelector('#logs-clear').addEventListener('click', function() {
      lines = [];
      renderAll();
    });
    panel.querySelector('#logs-close').addEventListener('click', function() {
      toggleLogs();
    });
    return panel;
  }

  // --- Перерисовать всё содержимое ---
  function renderAll() {
    var c = document.getElementById('logs-content');
    if (!c) return;
    c.innerHTML = '';
    for (var i = 0; i < lines.length; i++) {
      var div = document.createElement('div');
      div.className = 'log-line log-' + lines[i].level;
      div.textContent = lines[i].time + ' ' + lines[i].msg;
      c.appendChild(div);
    }
    c.scrollTop = c.scrollHeight;
  }

  // --- Добавить строку ---
  function addLine(level, msg) {
    lines.push({ time: nowStr(), level: level, msg: String(msg) });
    if (lines.length > MAX_LINES) lines.shift();

    var c = document.getElementById('logs-content');
    if (c) {
      var div = document.createElement('div');
      div.className = 'log-line log-' + level;
      div.textContent = lines[lines.length - 1].time + ' ' + msg;
      c.appendChild(div);
      // Удалить лишние DOM-узлы
      while (c.childNodes.length > MAX_LINES) c.removeChild(c.firstChild);
      c.scrollTop = c.scrollHeight;
    }
  }

  // --- Публичный API ---
  function log(msg)    { addLine('info',  msg); console.log('[crucix] ' + msg); }
  function warn(msg)   { addLine('warn',  msg); console.warn('[crucix] ' + msg); }
  function error(msg)  { addLine('error', msg); console.error('[crucix] ' + msg); }

  // --- Toggle панели ---
  function toggleLogs() {
    var panel = document.getElementById('logs-panel');
    if (panel) {
      panel.remove();
      logsVisible = false;
      return;
    }
    logsVisible = true;
    createPanel();
    renderAll();
  }

  // --- Экспорт ---
  window.CrucixLogger = {
    log: log,
    warn: warn,
    error: error,
    toggleLogs: toggleLogs,
    getLines: function() { return lines.slice(); },
    clear: function() { lines = []; renderAll(); }
  };

  // Алиас для onclick в HTML
  window.toggleLogs = toggleLogs;

  // Первая запись
  log('logger загружен, MAX_LINES=' + MAX_LINES);
})();
