/* ============================================================
   PANEL-WIDTH-SYNC.JS — Синхронизация ширины панели слоёв
   с отступом карты (auto-width support)
   ============================================================
   Без этого скрипта .map-container имеет фиксированный right:300px,
   а панель — width:max-content. Скрипт подставляет реальную ширину.
   На мобилке (<=480px) не вмешивается — там своя вёрстка.
   ============================================================ */

(function () {
    var panel = document.getElementById('layer-panel');
    var container = document.getElementById('map-container');
    if (!panel || !container) return;

    function syncWidth() {
        // На мобилке панель снизу, не справа — пропускаем
        if (window.innerWidth <= 480) return;
        // Если панель свёрнута — .map-container.full ставит right:0
        if (panel.classList.contains('collapsed')) return;

        var w = panel.offsetWidth;
        if (w > 0 && w < 600) {   // защита от абсурдных значений
            container.style.right = w + 'px';
        }
    }

    // Первый запуск после рендера панели
    function init() {
        syncWidth();
        if (window.map && window.map.invalidateSize) {
            setTimeout(function () { window.map.invalidateSize(); }, 50);
        }
    }

    // Запускаем после загрузки слоёв (renderLayerPanel уже отработал)
    setTimeout(init, 300);
    setTimeout(init, 1000);   // повтор — на случай медленного рендера

    // Следим за изменениями ширины панели (например, при ресайзе окна)
    if (window.ResizeObserver) {
        var ro = new ResizeObserver(function () {
            syncWidth();
        });
        ro.observe(panel);
    }

    // Синхронизация при разворачивании панели
    var origToggle = window.toggleLayerPanel;
    if (origToggle) {
        window.toggleLayerPanel = function () {
            origToggle();
            // После анимации (300ms) синхронизируем
            setTimeout(syncWidth, 350);
        };
    }

    // Синхронизация при ресайзе окна
    window.addEventListener('resize', function () {
        if (window.innerWidth <= 480) {
            // На мобилке сбрасываем inline-стиль
            container.style.right = '';
        } else {
            syncWidth();
        }
    });

    console.log('PANEL-WIDTH-SYNC.JS готов');
})();
