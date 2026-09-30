// logger.js — Логирование (локальный)
console.log('📝 LOGGER.JS (network-map) загружен');

window.CrucixLogger = {
    logs: [],
    maxLogs: 200,

    log: function(level, msg, data) {
        var entry = { ts: new Date().toISOString(), level: level, msg: msg, data: data };
        this.logs.push(entry);
        if (this.logs.length > this.maxLogs) this.logs.shift();
        if (level === 'error') console.error('[NetworkMap]', msg, data || '');
        else if (level === 'warn') console.warn('[NetworkMap]', msg, data || '');
        else console.log('[NetworkMap]', msg, data || '');
    },

    info: function(msg, data) { this.log('info', msg, data); },
    warn: function(msg, data) { this.log('warn', msg, data); },
    error: function(msg, data) { this.log('error', msg, data); },

    getLogs: function() { return this.logs; }
};
