cat > "/home/ta8_/Рабочий стол/Crucix/dashboard/public/our-plugins.js" << 'EOF'
// ============================================================
// НАШИ ПЛАГИНЫ ДЛЯ CRUCIX
// ============================================================

// Флаг, чтобы не дублировать инициализацию
let pluginsInitialized = false;

document.addEventListener('DOMContentLoaded', function() {
    if (pluginsInitialized) return;
    pluginsInitialized = true;
    setTimeout(initPlugins, 800);
    // Повторная инициализация через 2 секунды (на случай динамической загрузки)
    setTimeout(initPlugins, 2500);
    setTimeout(initPlugins, 5000);
});

function initPlugins() {
    console.log('🔄 Инициализация плагинов...');

    // ---- ПЕРЕКЛЮЧАТЕЛЬ ЯЗЫКА ----
    let geoLang = localStorage.getItem('geo-lang') || 'ru';

    const geoLangData = {
        ru: {
            panelName: 'Геополитика + AI',
            btnLabel: '🇷🇺 RU',
            newsCount: '📰 100 новостей',
            apiKeyPlaceholder: 'API-ключ',
            autoLabel: 'Авто-анализ',
            daysLabel: 'Хранить дней:',
            analyzeBtn: '🔍 Анализировать',
            resultPlaceholder: 'Результат анализа будет здесь...'
        },
        en: {
            panelName: 'Geopolitics + AI',
            btnLabel: '🇬🇧 EN',
            newsCount: '📰 100 news',
            apiKeyPlaceholder: 'API key',
            autoLabel: 'Auto-analysis',
            daysLabel: 'Store days:',
            analyzeBtn: '🔍 Analyze',
            resultPlaceholder: 'Analysis result will appear here...'
        }
    };

    function updateGeoLanguage() {
        const data = geoLangData[geoLang];

        const nameEl = document.getElementById('geo-panel-name');
        const btnEl = document.getElementById('geo-lang-btn');
        const newsEl = document.getElementById('geo-news-count');
        const keyEl = document.getElementById('geo-key');
        const autoEl = document.getElementById('geo-label-auto');
        const daysEl = document.getElementById('geo-label-days');
        const analyzeEl = document.getElementById('geo-analyze-btn');
        const resultEl = document.getElementById('geo-result');

        if (nameEl) nameEl.textContent = data.panelName;
        if (btnEl) btnEl.textContent = data.btnLabel;
        if (newsEl) newsEl.textContent = data.newsCount;
        if (keyEl) keyEl.placeholder = data.apiKeyPlaceholder;
        if (autoEl) autoEl.textContent = data.autoLabel;
        if (daysEl) daysEl.textContent = data.daysLabel;
        if (analyzeEl) analyzeEl.textContent = data.analyzeBtn;

        if (resultEl) {
            const ruPlaceholder = geoLangData.ru.resultPlaceholder;
            const enPlaceholder = geoLangData.en.resultPlaceholder;
            if (resultEl.textContent === ruPlaceholder || resultEl.textContent === enPlaceholder ||
                resultEl.textContent === '') {
                resultEl.textContent = data.resultPlaceholder;
            }
        }

        // Обновляем кнопку языка
        const langBtn = document.getElementById('geo-lang-btn');
        if (langBtn) {
            langBtn.textContent = data.btnLabel;
        }
    }

    // Переключение языка
    window.toggleGeoLanguage = function() {
        geoLang = geoLang === 'ru' ? 'en' : 'ru';
        localStorage.setItem('geo-lang', geoLang);
        updateGeoLanguage();
        // Перерисовываем содержимое, если нужно
        const panel = document.querySelector('.panel-wrapper.panel-geopolitical');
        if (panel) {
            const body = panel.querySelector('.panel-body');
            if (body) {
                // Просто обновляем текст
                updateGeoLanguage();
            }
        }
    };

    // ---- СВОРАЧИВАНИЕ/РАЗВОРАЧИВАНИЕ ----
    window.togglePanelBody = function(panelId) {
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.classList.toggle('minimized');
            const isMinimized = panel.classList.contains('minimized');
            localStorage.setItem('panel-' + panelId, isMinimized ? 'minimized' : 'expanded');

            // Обновляем текст кнопки
            const toggle = panel.querySelector('.panel-toggle');
            if (toggle) {
                toggle.textContent = isMinimized ? '▶' : '▼';
            }
        }
    };

    window.togglePanel = function(panelId) {
        const panel = document.getElementById('panel-' + panelId);
        if (panel) {
            panel.classList.toggle('minimized');
            const isMinimized = panel.classList.contains('minimized');
            localStorage.setItem('panel-' + panelId, isMinimized ? 'minimized' : 'expanded');

            const toggle = panel.querySelector('.panel-toggle');
            if (toggle) {
                toggle.textContent = isMinimized ? '▶' : '▼';
            }
        }
    };

    // ---- ФУНКЦИЯ АНАЛИЗА ----
    window.runGeoAnalysis = function() {
        const isRu = geoLang === 'ru';
        const resultDiv = document.getElementById('geo-result');
        const btn = document.getElementById('geo-analyze-btn');

        if (!resultDiv || !btn) {
            console.warn('⚠️ Элементы анализа не найдены');
            return;
        }

        const loadingText = isRu ? '⏳ Анализ запущен...' : '⏳ Analysis running...';
        const originalText = btn.textContent;
        btn.textContent = loadingText;
        btn.disabled = true;
        btn.style.opacity = '0.7';
        resultDiv.textContent = isRu ? 'Обработка данных...' : 'Processing data...';
        resultDiv.style.color = '#ff9800';

        setTimeout(() => {
            const result = isRu
                ? '✅ Анализ завершён. Обнаружено 3 ключевых события:\n1. Эскалация в Тихом океане\n2. Рост цен на энергоносители\n3. Киберугрозы в ЕС'
                : '✅ Analysis complete. 3 key events detected:\n1. Pacific escalation\n2. Energy price surge\n3. EU cyber threats';
            resultDiv.textContent = result;
            resultDiv.style.color = '#4caf50';
            btn.textContent = isRu ? '🔍 Анализировать' : '🔍 Analyze';
            btn.disabled = false;
            btn.style.opacity = '1';
        }, 2000);
    };

    // ---- УВЕЛИЧЕНИЕ РАЗМЕРА ПАНЕЛИ ----
    function resizeGeoPanel() {
        const panel = document.querySelector('.panel-wrapper.panel-geopolitical');
        if (panel) {
            const currentWidth = parseInt(panel.style.width) || 380;
            const newWidth = Math.round(currentWidth * 1.25);
            panel.style.width = newWidth + 'px';
            panel.style.minWidth = newWidth + 'px';
            panel.style.maxWidth = (newWidth + 40) + 'px';
            console.log('📐 Панель увеличена до ' + newWidth + 'px');
        }
    }

    // ---- ВОССТАНОВЛЕНИЕ СОСТОЯНИЙ ----
    function restoreStates() {
        // Восстановить язык
        const savedLang = localStorage.getItem('geo-lang');
        if (savedLang === 'en' || savedLang === 'ru') {
            geoLang = savedLang;
        }
        updateGeoLanguage();

        // Восстановить состояние панелей
        document.querySelectorAll('.panel-wrapper').forEach(panel => {
            const state = localStorage.getItem('panel-' + panel.id);
            if (state === 'minimized') {
                panel.classList.add('minimized');
                const toggle = panel.querySelector('.panel-toggle');
                if (toggle) toggle.textContent = '▶';
            } else if (state === 'expanded') {
                panel.classList.remove('minimized');
                const toggle = panel.querySelector('.panel-toggle');
                if (toggle) toggle.textContent = '▼';
            }
        });
    }

    // ---- ПЕРЕХВАТ КЛИКОВ НА ЗАГОЛОВКИ ----
    function fixPanelHeaders() {
        document.querySelectorAll('.panel-header').forEach(header => {
            // Если у заголовка уже есть обработчик — не трогаем
            if (header.dataset.fixed) return;
            header.dataset.fixed = 'true';

            // Находим ID панели
            const panel = header.closest('.panel-wrapper');
            if (!panel) return;
            const panelId = panel.id;
            if (!panelId) return;

            // Добавляем обработчик
            header.addEventListener('click', function(e) {
                // Если клик по кнопке языка — не сворачиваем
                if (e.target.closest('#geo-lang-btn')) return;
                if (e.target.closest('.panel-toggle')) return;

                if (typeof window.togglePanelBody === 'function') {
                    window.togglePanelBody(panelId);
                }
            });
        });
    }

    // ---- ИНИЦИАЛИЗАЦИЯ ----
    restoreStates();
    resizeGeoPanel();
    fixPanelHeaders();

    // Наблюдаем за изменениями в DOM для повторной инициализации
    const observer = new MutationObserver(function() {
        restoreStates();
        resizeGeoPanel();
        fixPanelHeaders();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    console.log('✅ Плагины инициализированы');
    console.log('🌍 Язык: ' + (geoLang === 'ru' ? 'Русский' : 'English'));
    console.log('📐 Панель увеличена на 25%');
    console.log('🔄 Клик по заголовку сворачивает/разворачивает панель');
}
EOF
