var CrucixLogger = {
    log: function(msg) { console.log('[Crucix] ' + msg); },
    warn: function(msg) { console.warn('[Crucix] ' + msg); },
    error: function(msg) { console.error('[Crucix] ' + msg); }
};
window.CrucixLogger = CrucixLogger;
console.log('logger.js готов');
