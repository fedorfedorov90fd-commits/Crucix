// ============================================================
// CORE.JS — Глобальные переменные и настройки
// ============================================================

console.log('🔷 CORE.JS загружен');

// Глобальные переменные (только здесь!)
window.map = null;
window.markerData = [];
window.allMarkers = [];
window.allLayers = [];
window.layerCache = {};
window.activeLayerIds = new Set(['all']);
window.currentLayer = 'all';
window.markersLayer = null;
window.heatLayer = null;
window.heatEnabled = false;
window.timelineEnabled = false;
window.currentLang = localStorage.getItem('crucix-lang') || 'ru';
window.mapMode = 'cii';  // ★ ДОБАВЛЕНО: режим карты (cii / bigmac)

// ============================================================
// ЯЗЫКОВЫЕ ПЕРЕВОДЫ
// ============================================================

window.LANG_DATA = {
    ru: {
        brand: '🌍 CRUCIX MAP',
        home: '← НА ГЛАВНУЮ',
        copy: '📋 КОПИРОВАТЬ',
        rss: '📡 Список страниц',
        help: '❓ HELP',
        stats: 'событий',
        countries: '🌍 стран',
        ssi: '📊 Индекс напряжённости',
        legend: '🎯 Легенда',
        layers: '🎯 СЛОИ',
        search: '🔍 Поиск слоев...',
        loading: 'ЗАГРУЗКА КАРТЫ...'
    },
    en: {
        brand: '🌍 CRUCIX MAP',
        home: '← HOME',
        copy: '📋 COPY',
        rss: '📡 Pages list',
        help: '❓ HELP',
        stats: 'events',
        countries: '🌍 countries',
        ssi: '📊 Strategic Stress Index',
        legend: '🎯 Legend',
        layers: '🎯 LAYERS',
        search: '🔍 Search layers...',
        loading: 'LOADING MAP...'
    }
};

// ============================================================
// ФУНКЦИИ ЯЗЫКА
// ============================================================

function setLanguage(lang) {
    window.currentLang = lang;
    localStorage.setItem('crucix-lang', lang);
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    updateLanguage();
    showNotification('🌐 Язык: ' + lang.toUpperCase());
}

function updateLanguage() {
    const d = window.LANG_DATA[window.currentLang] || window.LANG_DATA.ru;
    const els = {
        'brand-text': d.brand,
        'btn-home': d.home,
        'btn-copy': d.copy,
        'btn-rss': d.rss,
        'btn-help': d.help,
        'stats-label': d.stats,
        'countries-label': d.countries,
        'ssi-title': d.ssi,
        'legend-title': d.legend,
        'layers-title': d.layers,
        'layer-search': d.search,
        'loading-text': d.loading
    };
    for (const [id, text] of Object.entries(els)) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }
}

function showNotification(msg) {
    document.querySelectorAll('.notification').forEach(el => el.remove());
    const el = document.createElement('div');
    el.className = 'notification';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
}

function openHelp() {
    alert('Справка по геополитической карте Crucix\n\n' +
          '• Панель слоёв справа — выберите слой для отображения\n' +
          '• Кнопка "Включить все" — показать все активные слои\n' +
          '• Клик по маркеру — подробная информация\n' +
          '• Кнопка "КОПИРОВАТЬ" — скопировать полный дамп данных');
}

function goToDashboard(name) {
    window.location.href = '/dashboard-' + name + '.html';
}

// Экспорт
window.setLanguage = setLanguage;
window.updateLanguage = updateLanguage;
window.showNotification = showNotification;
window.openHelp = openHelp;
window.goToDashboard = goToDashboard;
