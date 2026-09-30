window.showNotification = function(msg, type) {
    document.querySelectorAll('.crucix-notification').forEach(function(el) { el.remove(); });
    var el = document.createElement('div');
    el.className = 'crucix-notification';
    el.textContent = msg;
    el.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;background:rgba(20,25,35,0.95);color:#e8f0f8;padding:10px 16px;border-radius:8px;border:1px solid rgba(91,192,248,0.3);font-size:13px;max-width:300px;box-shadow:0 4px 12px rgba(0,0,0,0.4);';
    document.body.appendChild(el);
    setTimeout(function() { el.style.opacity='0'; el.style.transition='opacity 0.3s'; setTimeout(function() { el.remove(); }, 300); }, 2500);
};
console.log('✅ showNotification готов');
