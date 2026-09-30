// ============================================================
// MAP-CONTROLS.JS — Карта, границы, choropleth (автономный)
// ============================================================
// Версия: 4.1.0 — 28.09.2026
// Принцип: ПОЛНАЯ ИЗОЛЯЦИЯ. Не зависит ни от какой другой карты.
// Изменения v4.1:
//   - Экспорт currentChoroplethData и currentChoroplethConfig в window
//     (для copy-data.js — снапшот choropleth-параметров).
//   - В config сохраняется gvf и stats (count, min, max, mean).
// Изменения v4.0:
//   - Jenks Natural Breaks (DP, Fisher 1958, Jenks 1963)
//   - 5 методов классификации (jenks, quantile, equal, std, manual)
//   - GVF контроль качества (Jenks 1963: GVF > 0.7)
//   - ColorBrewer палитры (Brewer 2005)
//   - Легенда choropleth
//   - Загрузка из локального data/world.geojson
// ============================================================

console.log("🗺️ MAP-CONTROLS.JS загружен (Metrics Map, автономный v4.1)");

// ============================================================
// СООТВЕТСТВИЕ НАЗВАНИЙ СТРАН
// ============================================================

const COUNTRY_NAME_MAP = {
    "Russia": "Россия", "Ukraine": "Украина", "United States": "США",
    "United Kingdom": "Великобритания", "France": "Франция", "Germany": "Германия",
    "China": "Китай", "India": "Индия", "Turkey": "Турция",
    "Japan": "Япония", "South Korea": "Южная Корея", "North Korea": "Северная Корея",
    "Iran": "Иран", "Israel": "Израиль", "Saudi Arabia": "Саудовская Аравия",
    "Egypt": "Египет", "Pakistan": "Пакистан", "Afghanistan": "Афганистан",
    "Iraq": "Ирак", "Syria": "Сирия", "Yemen": "Йемен",
    "Somalia": "Сомали", "Ethiopia": "Эфиопия", "Sudan": "Судан",
    "Poland": "Польша", "Lithuania": "Литва", "Latvia": "Латвия",
    "Estonia": "Эстония", "Armenia": "Армения", "Azerbaijan": "Азербайджан",
    "Venezuela": "Венесуэла", "Colombia": "Колумбия", "Palestine": "Палестина",
    "Lebanon": "Ливан", "Myanmar": "Мьянма", "Kazakhstan": "Казахстан",
    "Uzbekistan": "Узбекистан", "Turkmenistan": "Туркменистан", "Kyrgyzstan": "Кыргызстан",
    "Tajikistan": "Таджикистан", "Mongolia": "Монголия", "Nepal": "Непал",
    "Bangladesh": "Бангладеш", "Sri Lanka": "Шри-Ланка", "Cambodia": "Камбоджа",
    "Laos": "Лаос", "Vietnam": "Вьетнам", "Thailand": "Таиланд",
    "Malaysia": "Малайзия", "Indonesia": "Индонезия", "Philippines": "Филиппины",
    "Australia": "Австралия", "New Zealand": "Новая Зеландия", "Canada": "Канада",
    "Mexico": "Мексика", "Brazil": "Бразилия", "Argentina": "Аргентина",
    "Chile": "Чили", "Peru": "Перу", "South Africa": "ЮАР",
    "Nigeria": "Нигерия", "Kenya": "Кения", "Morocco": "Марокко",
    "Algeria": "Алжир", "Tunisia": "Тунис", "Libya": "Ливия",
    "UAE": "ОАЭ", "Qatar": "Катар", "Oman": "Оман",
    "Kuwait": "Кувейт", "Bahrain": "Бахрейн", "Jordan": "Иордания",
    "DR Congo": "ДР Конго", "Zambia": "Замбия", "Angola": "Ангола",
    "Norway": "Норвегия", "Sweden": "Швеция", "Denmark": "Дания",
    "Finland": "Финляндия", "Netherlands": "Нидерланды", "Belgium": "Бельгия",
    "Spain": "Испания", "Italy": "Италия", "Portugal": "Португалия",
    "Greece": "Греция", "Austria": "Австрия", "Switzerland": "Швейцария",
    "Czech Republic": "Чехия", "Hungary": "Венгрия", "Romania": "Румыния",
    "Bulgaria": "Болгария", "Serbia": "Сербия", "Croatia": "Хорватия",
    "Singapore": "Сингапур", "Hong Kong": "Гонконг", "Taiwan": "Тайвань"
};

// ============================================================
// СОСТОЯНИЕ
// ============================================================

let currentGeoJsonLayer = null;
let currentLabelsLayer = null;
let currentChoroplethData = null;
let currentChoroplethConfig = null;
let boundariesLoaded = false;

// ============================================================
// КЛАССИФИКАЦИЯ: Jenks Natural Breaks (DP, Fisher 1958)
// ============================================================

function jenksBreaks(values, numClasses) {
    if (values.length === 0) return [];
    if (numClasses >= values.length) return [...values].sort((a,b) => a-b);

    var sorted = [...values].sort((a, b) => a - b);
    var n = sorted.length;

    // Матрица для DP
    var lowerClassLimits = [];
    var varianceCombinations = [];
    for (var i = 0; i <= n; i++) {
        lowerClassLimits.push(new Array(numClasses + 1).fill(0));
        varianceCombinations.push(new Array(numClasses + 1).fill(0));
    }

    // varianceCombinations[i][j] = минимальная SDCM для j классов из первых i элементов
    for (var i = 1; i <= numClasses; i++) {
        lowerClassLimits[1][i] = 1;
        varianceCombinations[1][i] = 0;
        for (var j = 2; j <= n; j++) {
            varianceCombinations[j][i] = Infinity;
        }
    }

    // Предвычисление кумулятивных сумм
    var sum = new Array(n + 1).fill(0);
    var sumSq = new Array(n + 1).fill(0);
    for (var i = 1; i <= n; i++) {
        sum[i] = sum[i - 1] + sorted[i - 1];
        sumSq[i] = sumSq[i - 1] + sorted[i - 1] * sorted[i - 1];
    }

    function variance(i, j) {
        if (i === j) return 0;
        var s = sum[j] - sum[i - 1];
        var sq = sumSq[j] - sumSq[i - 1];
        var mean = s / (j - i + 1);
        return sq - 2 * mean * s + (j - i + 1) * mean * mean;
    }

    // DP
    for (var l = 2; l <= n; l++) {
        for (var k = 1; k <= Math.min(l, numClasses); k++) {
            if (k === 1) {
                varianceCombinations[l][k] = variance(1, l);
                lowerClassLimits[l][k] = 1;
            } else {
                var minVariance = Infinity;
                var minPos = 1;
                for (var m = 1; m <= l - 1; m++) {
                    var v = varianceCombinations[m][k - 1] + variance(m + 1, l);
                    if (v < minVariance) {
                        minVariance = v;
                        minPos = m + 1;
                    }
                }
                varianceCombinations[l][k] = minVariance;
                lowerClassLimits[l][k] = minPos;
            }
        }
    }

    // Восстановление границ
    var breaks = [];
    var k = numClasses;
    var i = n;
    while (k > 0 && i > 0) {
        var start = lowerClassLimits[i][k];
        if (start > 0 && start - 1 < n) {
            breaks.unshift(sorted[start - 1]);
        }
        i = start - 1;
        k--;
    }
    breaks.unshift(sorted[0]);

    // Уникальные границы
    var unique = [...new Set(breaks)].sort((a, b) => a - b);
    while (unique.length > numClasses + 1) unique.pop();
    while (unique.length < numClasses + 1 && unique.length > 0) unique.push(sorted[n - 1]);

    return unique;
}

// ============================================================
// КВАНТИЛИ
// ============================================================

function quantileBreaks(values, numClasses) {
    if (values.length === 0) return [];
    var sorted = [...values].sort((a, b) => a - b);
    var breaks = [];
    var step = sorted.length / numClasses;
    for (var i = 0; i <= numClasses; i++) {
        var idx = Math.min(Math.floor(i * step), sorted.length - 1);
        breaks.push(sorted[idx]);
    }
    return [...new Set(breaks)].sort((a, b) => a - b);
}

// ============================================================
// EQUAL INTERVAL
// ============================================================

function equalIntervalBreaks(values, numClasses) {
    if (values.length === 0) return [];
    var min = Math.min(...values);
    var max = Math.max(...values);
    var step = (max - min) / numClasses;
    var breaks = [];
    for (var i = 0; i <= numClasses; i++) {
        breaks.push(min + i * step);
    }
    return breaks;
}

// ============================================================
// STANDARD DEVIATION
// ============================================================

function stdDevBreaks(values, numClasses) {
    if (values.length === 0) return [];
    var mean = values.reduce((a, b) => a + b, 0) / values.length;
    var std = Math.sqrt(values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / values.length);
    var half = Math.floor(numClasses / 2);
    var breaks = [];
    for (var i = -half; i <= half; i++) {
        breaks.push(mean + i * std);
    }
    return breaks.sort((a, b) => a - b);
}

// ============================================================
// GVF (Goodness of Vertical Fit, Jenks 1963)
// GVF = (SDAM - SDCM) / SDAM
// SDAM = сумма квадратов отклонений от глобального среднего
// SDCM = сумма квадратов отклонений от классовых средних
// ============================================================

function computeGVF(values, breaks) {
    if (values.length === 0 || breaks.length < 2) return 0;

    var allMean = values.reduce((a, b) => a + b, 0) / values.length;
    var sdam = values.reduce((acc, v) => acc + (v - allMean) * (v - allMean), 0);

    var sdcm = 0;
    for (var i = 0; i < breaks.length - 1; i++) {
        var classValues = values.filter(v => v >= breaks[i] && v < breaks[i + 1] + 0.0001);
        if (classValues.length > 0) {
            var classMean = classValues.reduce((a, b) => a + b, 0) / classValues.length;
            sdcm += classValues.reduce((acc, v) => acc + (v - classMean) * (v - classMean), 0);
        }
    }

    if (sdam === 0) return 1.0;
    return (sdam - sdcm) / sdam;
}

// ============================================================
// ВЫБОР МЕТОДА КЛАССИФИКАЦИИ
// ============================================================

function classifyValues(values, method, numClasses, manualBreaks) {
    switch (method) {
        case 'jenks': return jenksBreaks(values, numClasses);
        case 'quantile': return quantileBreaks(values, numClasses);
        case 'equal': return equalIntervalBreaks(values, numClasses);
        case 'std': return stdDevBreaks(values, numClasses);
        case 'manual': return manualBreaks || [];
        default: return jenksBreaks(values, numClasses);
    }
}

// ============================================================
// ПОЛУЧЕНИЕ ЦВЕТА ПО ЗНАЧЕНИЮ
// ============================================================

function getColorForValue(value, breaks, palette) {
    var colors = palette;
    if (!colors || colors.length === 0) colors = ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'];

    for (var i = 0; i < breaks.length - 1; i++) {
        if (value >= breaks[i] && (i === breaks.length - 2 || value < breaks[i + 1])) {
            return colors[Math.min(i, colors.length - 1)];
        }
    }
    return colors[colors.length - 1];
}

// ============================================================
// ЗАГРУЗКА ГРАНИЦ СТРАН (из локального data/world.geojson)
// ============================================================

async function loadCountryBoundaries() {
    var map = window.map;
    if (!map) return;
    if (boundariesLoaded) {
        console.log('[Metrics] Границы уже загружены');
        return;
    }

    if (currentGeoJsonLayer) { map.removeLayer(currentGeoJsonLayer); currentGeoJsonLayer = null; }
    if (currentLabelsLayer) { map.removeLayer(currentLabelsLayer); currentLabelsLayer = null; }

    try {
        // ★ АВТОНОМНОСТЬ: загружаем из ЛОКАЛЬНОГО файла
        var resp = await fetch('data/world.geojson');
        if (!resp.ok) throw new Error('Не удалось загрузить data/world.geojson (HTTP ' + resp.status + ')');
        var data = await resp.json();

        if (!data || !data.features) { console.warn('[Metrics] Некорректный GeoJSON'); return; }
        window.geoJsonData = data;

        var STATUS_COLORS = {
            critical: "#ef4444", "pre-war": "#f97316", high: "#f59e0b",
            medium: "#eab308", normal: "#22c55e", low: "#22c55e"
        };
        var INACTIVE_COLORS = ["#3a3a4a", "#454555", "#3f3f4f", "#4a4a5a", "#353545"];
        var inactiveIndex = 0;

        currentGeoJsonLayer = L.geoJSON(data, {
            style: function(feature) {
                var nameEn = (feature.properties && (feature.properties.name || feature.properties.NAME)) || "";
                var nameRu = COUNTRY_NAME_MAP[nameEn] || nameEn;

                if (currentChoroplethData) {
                    var match = currentChoroplethData.features.find(function(f) {
                        var fName = f.name || (f.properties && f.properties.name) || '';
                        return fName.toLowerCase() === nameRu.toLowerCase() ||
                               fName.toLowerCase() === nameEn.toLowerCase();
                    });
                    if (match) {
                        var value = match.value || (match.properties && match.properties.value) || 0;
                        var config = currentChoroplethConfig || {};
                        var values = currentChoroplethData.features.map(function(f) {
                            return f.value || (f.properties && f.properties.value) || 0;
                        }).filter(function(v) { return typeof v === 'number' && !isNaN(v); });

                        var breaks = config.breaks || classifyValues(values, config.method || 'jenks', 5, config.manualBreaks);
                        var palette = config.palette || ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'];
                        var color = getColorForValue(value, breaks, palette);

                        return {
                            fillColor: color,
                            fillOpacity: 0.75,
                            color: '#ffffff',
                            weight: 1.2,
                            opacity: 0.7,
                            className: 'country-boundary'
                        };
                    }
                }

                if (nameEn === "Antarctica") {
                    return { fillColor: "#d0d5dd", fillOpacity: 0.85, color: "#a0a5ad", weight: 1, opacity: 0.5 };
                }

                var fillColor = "#2a3a4a";
                var fillOpacity = 0.4;
                var countries = window.ALL_COUNTRIES || [];
                for (var country of countries) {
                    if (country.name === nameRu || country.name === nameEn) {
                        fillColor = (STATUS_COLORS[country.status] || "#22c55e") + "77";
                        fillOpacity = 0.55;
                        break;
                    }
                }
                if (fillColor === "#2a3a4a") {
                    fillColor = INACTIVE_COLORS[inactiveIndex++ % INACTIVE_COLORS.length];
                    fillOpacity = 0.35;
                }
                return { fillColor: fillColor, fillOpacity: fillOpacity, color: '#ffffff', weight: 1.2, opacity: 0.7, className: 'country-boundary' };
            },
            onEachFeature: function(feature, layer) {
                var nameEn = (feature.properties && (feature.properties.name || feature.properties.NAME)) || "";
                var nameRu = COUNTRY_NAME_MAP[nameEn] || nameEn;
                if (nameEn === "Antarctica") {
                    layer.bindPopup('<div style="padding:4px 0;"><strong style="color:#d0d5dd;font-size:15px;">❄️ Антарктида</strong></div>');
                    return;
                }
                var popup = '<div style="padding:4px 0;"><strong style="color:#e8f0f8;font-size:15px;">' + nameRu + '</strong></div>';
                if (currentChoroplethData) {
                    var match = currentChoroplethData.features.find(function(f) {
                        var fName = f.name || (f.properties && f.properties.name) || '';
                        return fName.toLowerCase() === nameRu.toLowerCase() || fName.toLowerCase() === nameEn.toLowerCase();
                    });
                    if (match) {
                        var v = match.value || (match.properties && match.properties.value) || 0;
                        popup += '<div style="color:#fbbf24;font-size:12px;margin-top:4px;">📊 Значение: ' +
                                 (typeof v === 'number' ? v.toFixed(2) : v) + '</div>';
                    }
                }
                layer.bindPopup(popup);
                layer.on('mouseover', function() { this.setStyle({ weight: 2.5, opacity: 1, fillOpacity: 0.7 }); this.openPopup(); });
                layer.on('mouseout', function() { this.setStyle({ weight: 1.2, opacity: 0.7, fillOpacity: 0.5 }); this.closePopup(); });
            }
        }).addTo(map);

        currentLabelsLayer = L.layerGroup().addTo(map);
        addCountryLabels(data);
        boundariesLoaded = true;
        console.log('[Metrics] ✅ Границы загружены из data/world.geojson (автономно)');

    } catch (e) {
        console.warn('[Metrics] Ошибка загрузки GeoJSON:', e);
        if (typeof CrucixUtils !== 'undefined' && CrucixUtils.notify) {
            CrucixUtils.notify('Ошибка загрузки границ: ' + e.message, 'error');
        }
    }
}

// ============================================================
// ПОДПИСИ СТРАН
// ============================================================

function addCountryLabels(geoData) {
    var map = window.map;
    if (!map || !geoData || !geoData.features) return;

    for (var feature of geoData.features) {
        var nameEn = (feature.properties && (feature.properties.name || feature.properties.NAME)) || "";
        var nameRu = COUNTRY_NAME_MAP[nameEn] || nameEn;
        if (!nameRu || nameRu.length < 2) continue;
        if (nameRu === "Антарктида" || nameRu === "Гренландия") continue;

        var center = null;
        if (feature.properties && feature.properties.center) {
            center = feature.properties.center;
        } else if (feature.geometry && feature.geometry.type === "Polygon") {
            var coords = feature.geometry.coordinates[0];
            if (coords && coords.length > 0) {
                var lat = 0, lng = 0, cnt = 0;
                for (var c of coords) { if (c && c.length >= 2) { lat += c[1]; lng += c[0]; cnt++; } }
                if (cnt > 0) center = { lat: lat / cnt, lng: lng / cnt };
            }
        } else if (feature.geometry && feature.geometry.type === "MultiPolygon") {
            if (feature.geometry.coordinates && feature.geometry.coordinates[0]) {
                var coords = feature.geometry.coordinates[0][0];
                if (coords && coords.length > 0) {
                    var lat = 0, lng = 0, cnt = 0;
                    for (var c of coords) { if (c && c.length >= 2) { lat += c[1]; lng += c[0]; cnt++; } }
                    if (cnt > 0) center = { lat: lat / cnt, lng: lng / cnt };
                }
            }
        }

        if (center && center.lat && center.lng) {
            var labelClass = "country-label";
            if (nameRu === "Россия") labelClass = "country-label-russia";
            L.marker([center.lat, center.lng], {
                icon: L.divIcon({ className: labelClass, html: '<span class="' + labelClass + '">' + nameRu + '</span>', iconSize: [0, 0], iconAnchor: [0, 0] })
            }).addTo(currentLabelsLayer);
        }
    }
}

// ============================================================
// CHOROPLETH (с Jenks, ColorBrewer, GVF)
// ============================================================

function applyChoropleth(data, layer) {
    if (!data || !data.features || data.features.length === 0) {
        console.warn('[Choropleth] Нет данных');
        return;
    }

    currentChoroplethData = data;
    window.currentChoroplethData = data;

    // Конфигурация из maps-config
    var config = { method: 'jenks', palette: null, numClasses: 5, breaks: null, manualBreaks: null };
    if (window.MetricsMapConfig && layer && layer.id) {
        var override = MetricsMapConfig.getLayerConfig(layer.id);
        config.method = override.classificationMethod || 'jenks';
        config.palette = MetricsMapConfig.getColorPalette(override.colorScheme);
        config.numClasses = override.numClasses || 5;
        config.manualBreaks = override.breaks;
    }

    // Извлекаем числовые значения
    var values = data.features.map(function(f) {
        return f.value || (f.properties && f.properties.value) || 0;
    }).filter(function(v) { return typeof v === 'number' && !isNaN(v); });

    // Классификация
    var breaks = classifyValues(values, config.method, config.numClasses, config.manualBreaks);
    config.breaks = breaks;

    // GVF
    var gvf = computeGVF(values, breaks);
    console.log('[Choropleth] method=' + config.method + ', breaks=' + JSON.stringify(breaks) + ', GVF=' + gvf.toFixed(4));
    if (gvf < 0.7) {
        console.warn('[Choropleth] ⚠️ GVF < 0.7 (' + gvf.toFixed(4) + ') — классификация suboptimal');
    }

    // ★ v4.1: сохраняем gvf и stats в config
    config.gvf = gvf;
    config.stats = {
        count: data.features.length,
        min: values.length ? Math.min.apply(null, values) : 0,
        max: values.length ? Math.max.apply(null, values) : 0,
        mean: values.length ? values.reduce(function(a, b) { return a + b; }, 0) / values.length : 0
    };
    if (layer && layer.id) {
        config.layerId = layer.id;
        config.layerName = layer.name || '';
    }

    currentChoroplethConfig = config;
    window.currentChoroplethConfig = config;

    // Применяем к слою
    if (currentGeoJsonLayer) {
        currentGeoJsonLayer.eachLayer(function(l) {
            if (!l.feature || !l.feature.properties) return;
            var nameEn = l.feature.properties.name || l.feature.properties.NAME || "";
            var nameRu = COUNTRY_NAME_MAP[nameEn] || nameEn;

            var match = data.features.find(function(f) {
                var fName = f.name || (f.properties && f.properties.name) || '';
                return fName.toLowerCase() === nameRu.toLowerCase() || fName.toLowerCase() === nameEn.toLowerCase();
            });

            if (match) {
                var value = match.value || (match.properties && match.properties.value) || 0;
                var color = getColorForValue(value, breaks, config.palette);
                l.setStyle({ fillColor: color, fillOpacity: 0.75, color: '#ffffff', weight: 1.2, opacity: 0.7 });
            } else {
                l.setStyle({ fillColor: '#3a3a4a', fillOpacity: 0.4, color: '#4a4a5a', weight: 0.8 });
            }
        });
        console.log('[Choropleth] Закрашено стран:', data.features.length);
    } else {
        console.warn('[Choropleth] geoJsonLayer не загружен, перезагружаем границы...');
        boundariesLoaded = false;
        loadCountryBoundaries().then(function() {
            if (currentGeoJsonLayer && currentChoroplethData) {
                applyChoropleth(currentChoroplethData, layer);
            }
        });
    }

    // Легенда
    renderChoroplethLegend(breaks, config, gvf);
}

// ============================================================
// ЛЕГЕНДА CHOROPLETH
// ============================================================

function renderChoroplethLegend(breaks, config, gvf) {
    var legendEl = document.getElementById('choropleth-legend');
    if (!legendEl) {
        legendEl = document.createElement('div');
        legendEl.id = 'choropleth-legend';
        legendEl.className = 'choropleth-legend';
        document.body.appendChild(legendEl);
    }

    var palette = config.palette || ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'];
    var gvfColor = gvf >= 0.7 ? '#22c55e' : '#ef4444';
    var gvfText = 'GVF: ' + gvf.toFixed(4);

    var html = '<div class="legend-title">📊 ' + (config.method || 'jenks').toUpperCase() + '</div>';
    for (var i = 0; i < breaks.length - 1; i++) {
        var lo = breaks[i].toFixed(2);
        var hi = breaks[i + 1].toFixed(2);
        html += '<div class="legend-item"><span class="legend-swatch" style="background:' +
                (palette[Math.min(i, palette.length - 1)] || '#888') + ';"></span>' +
                lo + ' — ' + hi + '</div>';
    }
    html += '<div class="legend-gvf" style="color:' + gvfColor + ';">' + gvfText + '</div>';

    legendEl.innerHTML = html;
    legendEl.style.display = 'block';
}

// ============================================================
// СБРОС CHOROPLETH
// ============================================================

function resetChoropleth() {
    currentChoroplethData = null;
    currentChoroplethConfig = null;
    window.currentChoroplethData = null;
    window.currentChoroplethConfig = null;
    var legend = document.getElementById('choropleth-legend');
    if (legend) legend.style.display = 'none';
    if (currentGeoJsonLayer) {
        boundariesLoaded = false;
        loadCountryBoundaries();
    }
}

// ============================================================
// ЭКСПОРТ
// ============================================================

window.loadCountryBoundaries = loadCountryBoundaries;
window.COUNTRY_NAME_MAP = COUNTRY_NAME_MAP;
window.applyChoropleth = applyChoropleth;
window.resetChoropleth = resetChoropleth;
window.jenksBreaks = jenksBreaks;
window.computeGVF = computeGVF;

console.log("✅ MAP-CONTROLS.JS готов (Metrics Map, автономный v4.1)");
