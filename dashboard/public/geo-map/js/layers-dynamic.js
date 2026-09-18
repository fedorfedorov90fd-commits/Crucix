/**
 * dashboard/public/geo-map/js/layers-dynamic.js — ДИНАМИЧЕСКИЙ АДАПТЕР СЛОЁВ
 *
 * Загружает слои из реестра /api/registry/layers и дополняет DEMO_LAYERS
 * (из layers.js) недостающими записями. Не удаляет старые, не дублирует
 * существующие id.
 *
 * ИДЕОЛОГИЯ: SSOT — единый источник (registry.generated.json на сервере).
 * UI не дублирует 186 слоёв в JS — подтягивает их динамически.
 *
 * ПОДКЛЮЧЕНИЕ: <script src="/geo-map/js/layers-dynamic.js"></script>
 *              ПОСЛЕ <script src="/geo-map/js/layers.js"></script>
 *
 * ПОВЕДЕНИЕ:
 *   1. Ждёт загрузки window.allLayers (layers.js).
 *   2. fetch('/api/registry/layers') → получает [{ route, moduleId, method, meta }].
 *   3. Для каждого id из реестра проверяет, есть ли в window.allLayers.
 *   4. Дописывает недостающие записи в window.allLayers.
 *   5. Помечает orphans (записи без API) как orphan: true.
 *   6. Вызывает renderLayerPanel(window.allLayers) — панель перерисовывается.
 *
 * FALLBACK: если /api/registry/layers недоступен — ничего не делаем,
 * UI работает со старым DEMO_LAYERS.
 *
 * КОНТРАКТ CRUCIX v2: не создаёт и не удаляет модули — только UI-адаптер.
 */

(function() {
    'use strict';

    const LOG_PREFIX = '[layers-dynamic]';
    const API_URL = '/api/registry/layers';
    const FETCH_TIMEOUT_MS = 8000;

    // Флаг, чтобы не выполнить дважды
    if (window.__layersDynamicLoaded) {
        console.log(LOG_PREFIX, 'уже загружен, пропускаем');
        return;
    }
    window.__layersDynamicLoaded = true;

    console.log(LOG_PREFIX, 'старт');

    // ============================================================
    //  УТИЛИТЫ
    // ============================================================

    function withTimeout(promise, ms, label) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`timeout ${ms}ms: ${label}`));
            }, ms);
            promise.then(
                v => { clearTimeout(timer); resolve(v); },
                e => { clearTimeout(timer); reject(e); }
            );
        });
    }

    // Нормализуем запись из реестра в формат DEMO_LAYERS
    function normalizeRegistryLayer(entry) {
        const meta = entry.meta || {};
        const moduleId = entry.moduleId || '';
        const id = moduleId.replace(/-api$/, ''); // 'acled-api' → 'acled'
        return {
            id,
            name: meta.description || meta.label || id,
            color: meta.color || '#4d6bfe',
            icon: meta.icon || '🎯',
            category: meta.category || 'other',
            vizType: meta.vizType || 'marker',
            source: 'registry',
            moduleId,
            route: entry.route,
            registry_meta: meta,
        };
    }

    // Мерджит два массива по id: base + additions (без дубликатов)
    function mergeLayers(base, additions) {
        const seen = new Set(base.map(l => l.id));
        const merged = base.slice();
        const added = [];
        for (const item of additions) {
            if (!item || !item.id) continue;
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            merged.push(item);
            added.push(item.id);
        }
        return { merged, added };
    }

    // Помечаем orphans (записи без API): метим слои, чей id не пришёл из реестра
    function markOrphans(layers, registryIds) {
        return layers.map(l => {
            if (registryIds.has(l.id)) {
                return { ...l, orphan: false };
            }
            // Слои crucix-* и map-layer-* — известные заглушки, не помечаем
            if (String(l.id).startsWith('crucix-')) {
                return { ...l, orphan: true, crucix_stub: true };
            }
            return { ...l, orphan: true };
        });
    }

    // ============================================================
    //  ЗАГРУЗКА РЕЕСТРА
    // ============================================================

    async function fetchRegistryLayers() {
        try {
            const resp = await withTimeout(fetch(API_URL), FETCH_TIMEOUT_MS, 'registry fetch');
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            if (!data || !Array.isArray(data.layers)) {
                throw new Error('invalid registry response: no layers[]');
            }
            console.log(LOG_PREFIX, `получено ${data.layers.length} слоёв из реестра`);
            return data.layers;
        } catch (e) {
            console.warn(LOG_PREFIX, `не удалось загрузить реестр: ${e.message}`);
            return null;
        }
    }

    // ============================================================
    //  ОСНОВНАЯ ЛОГИКА
    // ============================================================

    async function applyDynamicLayers() {
        if (!Array.isArray(window.allLayers)) {
            console.warn(LOG_PREFIX, 'window.allLayers не найден — layers.js не загружен или не выполнен');
            return;
        }

        const base = window.allLayers;
        console.log(LOG_PREFIX, `базовых слоёв в window.allLayers: ${base.length}`);

        const registryLayers = await fetchRegistryLayers();
        if (!registryLayers) {
            console.log(LOG_PREFIX, 'реестр недоступен, работаем со старым набором');
            return;
        }

        const normalized = registryLayers.map(normalizeRegistryLayer).filter(x => x.id);
        const registryIds = new Set(normalized.map(x => x.id));

        // Мерджим
        const { merged, added } = mergeLayers(base, normalized);
        console.log(LOG_PREFIX, `добавлено новых слоёв: ${added.length}`);

        // Помечаем orphans
        const finalLayers = markOrphans(merged, registryIds);

        // Присваиваем number (как в layers.js)
        const withNumber = finalLayers.map((l, idx) => ({
            ...l,
            number: String(idx + 1).padStart(2, '0'),
        }));

        // Обновляем глобальные ссылки
        window.allLayers = withNumber;
        window.DEMO_LAYERS = window.DEMO_LAYERS || base; // сохраняем оригинал
        window.activeLayerIds = window.activeLayerIds || new Set();

        // Перерисовываем панель, если функция доступна
        if (typeof window.renderLayerPanel === 'function') {
            try {
                window.renderLayerPanel(window.allLayers);
                console.log(LOG_PREFIX, `панель перерисована: ${window.allLayers.length} слоёв`);
            } catch (e) {
                console.error(LOG_PREFIX, `ошибка renderLayerPanel: ${e.message}`);
            }
        } else {
            console.warn(LOG_PREFIX, 'renderLayerPanel не найден — панель не перерисована');
        }

        // Обновляем badge с количеством
        const countEl = document.getElementById('layer-count');
        if (countEl) countEl.textContent = window.allLayers.length;

        console.log(LOG_PREFIX, `готово: ${window.allLayers.length} слоёв (было ${base.length}, добавлено ${added.length})`);
    }

    // ============================================================
    //  ЗАПУСК
    // ============================================================

    // Ждём, пока layers.js выполнится (он объявляет window.allLayers)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Даём layers.js 100 мс на инициализацию
            setTimeout(applyDynamicLayers, 100);
        });
    } else {
        setTimeout(applyDynamicLayers, 100);
    }

    // Экспорт для ручного вызова из консоли (debug)
    window.applyDynamicLayers = applyDynamicLayers;
})();
