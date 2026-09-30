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
 *   7. ★ ПРИМЕНЯЕТ ФИЛЬТР ПО КАРТЕ (maps-config.js) — сужает до слоёв этой карты.
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
        if (!entry) return null;
        const id = entry.moduleId || entry.id || entry.route;
        if (!id) return null;
        return {
            id: id,
            name: (entry.meta && entry.meta.name) || entry.name || id,
            color: (entry.meta && entry.meta.color) || entry.color || '#888888',
            icon: (entry.meta && entry.meta.icon) || entry.icon || '📦',
            category: (entry.meta && entry.meta.category) || entry.category || 'other',
            vizType: (entry.meta && entry.meta.vizType) || entry.vizType || 'marker',
            apiPath: entry.route || (entry.meta && entry.meta.apiPath) || null,
            fromRegistry: true,
        };
    }

    // Мерджим базовые слои с реестровыми — не дублируя id
    function mergeLayers(base, additions) {
        const seen = new Set(base.map(l => l.id));
        const added = [];
        for (const l of additions) {
            if (!l || !l.id) continue;
            if (seen.has(l.id)) continue;
            seen.add(l.id);
            added.push(l);
        }
        return { merged: base.concat(added), added };
    }

    // Помечаем orphan — слои без API-эндпоинта
    function markOrphans(layers, registryIds) {
        return layers.map(l => {
            if (!l) return l;
            if (l.fromRegistry) return l;
            if (registryIds.has(l.id)) return l;
            return Object.assign({}, l, { orphan: true });
        });
    }

    // ============================================================
    //  ЗАГРУЗКА РЕЕСТРА
    // ============================================================

    async function fetchRegistryLayers() {
        try {
            const res = await withTimeout(
                fetch(API_URL, { cache: 'no-cache' }),
                FETCH_TIMEOUT_MS,
                'registry fetch'
            );
            if (!res.ok) {
                console.warn(LOG_PREFIX, `реестр вернул ${res.status}`);
                return null;
            }
            const data = await res.json();
            if (!data || !Array.isArray(data.layers)) {
                console.warn(LOG_PREFIX, 'реестр вернул неожиданный формат');
                return null;
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

        // ============================================================
        //  ★ ФИЛЬТР ПО КАРТЕ (maps-config.js)
        //  Применяем ПОСЛЕ мерджа с реестром — иначе layers-dynamic
        //  перезатрёт отфильтрованный массив.
        // ============================================================
        if (typeof window.filterLayersForMap === 'function' && window.CrucixMap && window.CrucixMap.mapType) {
            try {
                const before = window.allLayers.length;
                window.allLayersFull = window.allLayersFull || window.allLayers.slice();
                const filtered = window.filterLayersForMap(window.CrucixMap.mapType, window.allLayers);
                window.allLayers = filtered;
                console.log(LOG_PREFIX, `★ фильтр карты '${window.CrucixMap.mapType}': ${filtered.length} из ${before} слоёв`);

                if (typeof window.renderLayerPanel === 'function') {
                    window.renderLayerPanel(window.allLayers);
                }
                if (countEl) countEl.textContent = window.allLayers.length;
            } catch (e) {
                console.error(LOG_PREFIX, `ошибка фильтра карты: ${e.message}`);
            }
        } else {
            console.log(LOG_PREFIX, 'фильтр карты недоступен (filterLayersForMap или CrucixMap.mapType отсутствует)');
        }
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
