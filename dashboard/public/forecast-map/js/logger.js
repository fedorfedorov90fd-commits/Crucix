// ============================================================
// LOGGER.JS — Логирование (автономная копия)
// ============================================================
console.log('🔮 LOGGER.JS загружен (Forecast Map)');

var logBuffer = [];
var MAX_LOG = 200;

function log(level, msg) {
    var entry = { time: new Date().toISOString(), level: level, msg: msg, map: 'forecasts' };
    logBuffer.push(entry);
    if (logBuffer.length > MAX_LOG) logBuffer.shift();
    if (level === 'error') console.error('[Forecast] ' + msg);
    else if (level === 'warn') console.warn('[Forecast] ' + msg);
}

window.CrucixLogger = { log: log, getBuffer: function() { return logBuffer; } };
console.log('✅ LOGGER.JS готов');