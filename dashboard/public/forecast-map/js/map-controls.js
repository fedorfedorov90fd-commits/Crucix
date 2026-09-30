// ============================================================
// MAP-CONTROLS.JS — Карта, границы, choropleth (Forecast Map)
// ============================================================
// Версия: 5.0.0 — 30.09.2026
// Принцип: ПОЛНАЯ ИЗОЛЯЦИЯ. Не зависит ни от какой другой карты.
//
// Три канала Forecast Map (Munzner 2014):
//   1. fillColor   = палитра[класс вероятности]   (дискретный, 5 классов)
//   2. fillOpacity = 0.4 + 0.5 × confidence        (непрерывный, [0.4, 0.9])
//   3. popup       = вероятность + уверенность + горизонт (дни)
//
// Научная база:
//   - Cressie 1993: вероятностное пространственное прогнозирование
//   - Fisher 1958, Jenks 1963: естественные разрывы (Jenks DP)
//   - Brewer 2005: палитры ColorBrewer
//   - Cowan 2001: 5 классов = 4±1 чанк рабочей памяти
//   - ICD 203: пороги вероятностей 20/40/60/80
// ============================================================

console.log("MAP-CONTROLS.JS загружен (Forecast Map v5.0)");

// ============================================================
// СПРАВОЧНИК НАЗВАНИЙ СТРАН (EN → RU)
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
    "Belarus": "Беларусь", "Georgia": "Грузия", "Moldova": "Молдова",
    "Romania": "Румыния", "Bulgaria": "Болгария", "Serbia": "Сербия",
    "Croatia": "Хорватия", "Slovakia": "Словакия", "Slovenia": "Словения",
    "Czech Republic": "Чехия", "Hungary": "Венгрия", "Greece": "Греция",
    "Italy": "Италия", "Spain": "Испания", "Portugal": "Португалия",
    "Netherlands": "Нидерланды", "Belgium": "Бельгия", "Switzerland": "Швейцария",
    "Austria": "Австрия", "Sweden": "Швеция", "Norway": "Норвегия",
    "Finland": "Финляндия", "Denmark": "Дания", "Ireland": "Ирландия",
    "Taiwan": "Тайвань", "Singapore": "Сингапур", "Maldives": "Мальдивы",
    "Haiti": "Гаити", "Mali": "Мали", "Chad": "Чад",
    "Niger": "Нигер", "Burkina Faso": "Буркина-Фасо", "Guinea": "Гвинея"
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
    if (numClasses >= values.length) return [...values].sort((a, b) => a - b);

    var sorted = [...values].sort((a, b) => a - b);
    var n = sorted.length;

    var lowerClassLimits = [];
    var varianceCombinations = [];
    for (var i = 0; i <= n; i++) {
        lowerClassLimits.push(new Array(numClasses + 1).fill(0));
        varianceCombinations.push(new Array(numClasses + 1).fill(0));
    }

    for (var i = 1; i <= numClasses; i++) {
        lowerClassLimits[1][i] = 1;
        varianceCombinations[1][i] = 0;
        for (var j = 2; j <= n; j++) {
            varianceCombinations[j][i] = Infinity;
        }
    }

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
                    if (v < minVariance) { minVariance = v; minPos = m + 1; }
                }
                varianceCombinations[l][k] = minVariance;
                lowerClassLimits[l][k] = minPos;
            }
        }
    }

    var breaks = [];
    var k = numClasses;
    var i = n;
    while (k > 0 && i > 0) {
        var start = lowerClassLimits[i][k];
        if (start > 0 && start - 1 < n) breaks.unshift(sorted[start - 1]);
        i = start - 1;
        k--;
    }
    breaks.unshift(sorted[0]);

    var unique = [...new Set(breaks)].sort((a, b) => a - b);
    while (unique.length > numClasses + 1) unique.pop();
    while (unique.length < numClasses + 1 && unique.length > 0) unique.push(sorted[n - 1]);
    return unique;
}

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

function equalIntervalBreaks(values, numClasses) {
    if (values.length === 0) return [];
    var min = Math.min(...values);
    var max = Math.max(...values);
    var step = (max - min) / numClasses;
    var breaks = [];
    for (var i = 0; i <= numClasses; i++) breaks.push(min + i * step);
    return breaks;
}

function stdDevBreaks(values, numClasses) {
    if (values.length === 0) return [];
    var mean = values.reduce((a, b) => a + b, 0) / values.length;
    var std = Math.sqrt(values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / values.length);
    var half = Math.floor(numClasses / 2);
    var breaks = [];
    for (var i = -half; i <= half; i++) breaks.push(mean + i * std);
    return breaks.sort((a, b) => a - b);
}

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
// ЗАГРУЗКА ГРАНИЦ ИЗ data/world.geojson
// ============================================================

async function loadCountryBoundaries(retry) {
    retry = retry || 0;
    var map = window.map;
    if (!map || typeof map.addLayer !== "function") {
        if (retry < 20) {
            setTimeout(function() { loadCountryBoundaries(retry + 1); }, 200);
            return;
        }
        console.warn("[Forecast] map не готова после 20 попыток");
        return;
    }
    var map = window.map;
    if (!map) return;
    if (boundariesLoaded) { console.log('[Forecast] Границы уже загружены'); return; }

    if (currentGeoJsonLayer) { map.removeLayer(currentGeoJsonLayer); currentGeoJsonLayer = null; }
    if (currentLabelsLayer) { map.removeLayer(currentLabelsLayer); currentLabelsLayer = null; }

    try {
        var resp = await fetch('data/world.geojson');
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        var data = await resp.json();
        if (!data || !data.features) { console.warn('[Forecast] Некорректный GeoJSON'); return; }
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

                // Если есть choropleth-данные — применяем вероятностную заливку
                if (currentChoroplethData && currentChoroplethData.features) {
                    var match = currentChoroplethData.features.find(function(f) {
                        var fName = f.name || (f.properties && f.properties.name) || '';
                        return fName.toLowerCase() === nameRu.toLowerCase() ||
                               fName.toLowerCase() === nameEn.toLowerCase();
                    });
                    if (match) {
                        var matchFillColor = match.fillColor || (match.properties && match.properties.fillColor) || '#4466aa';
                        var matchFillOpacity = match.fillOpacity !== undefined ? match.fillOpacity :
                            ((match.properties && match.properties.fillOpacity) || 0.75);
                        return {
                            fillColor: matchFillColor,
                            fillOpacity: matchFillOpacity,
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

                // Дефолт — по статусу страны
                var baseFillColor = "#2a3a4a";
                var baseFillOpacity = 0.4;
                var countries = window.ALL_COUNTRIES || [];
                for (var ci = 0; ci < countries.length; ci++) {
                    var country = countries[ci];
                    if (country.name === nameRu || country.name === nameEn) {
                        baseFillColor = (STATUS_COLORS[country.status] || "#22c55e") + "77";
                        baseFillOpacity = 0.55;
                        break;
                    }
                }
                if (baseFillColor === "#2a3a4a") {
                    baseFillColor = INACTIVE_COLORS[inactiveIndex % INACTIVE_COLORS.length];
                    inactiveIndex++;
                    baseFillOpacity = 0.35;
                }
                return {
                    fillColor: baseFillColor,
                    fillOpacity: baseFillOpacity,
                    color: '#ffffff',
                    weight: 1.2,
                    opacity: 0.7,
                    className: 'country-boundary'
                };
            },
            onEachFeature: function(feature, layer) {
                var nameEn = (feature.properties && (feature.properties.name || feature.properties.NAME)) || "";
                var nameRu = COUNTRY_NAME_MAP[nameEn] || nameEn;
                if (nameEn === "Antarctica") return;

                var popupContent = '<div style="padding:4px 0;"><strong style="color:#e8f0f8;font-size:15px;">' + nameRu + '</strong>';

                if (currentChoroplethData && currentChoroplethData.features) {
                    var match = currentChoroplethData.features.find(function(f) {
                        var fName = f.name || (f.properties && f.properties.name) || '';
                        return fName.toLowerCase() === nameRu.toLowerCase() ||
                               fName.toLowerCase() === nameEn.toLowerCase();
                    });
                    if (match) {
                        var val = match.value !== undefined ? match.value : (match.properties && match.properties.value);
                        var conf = match.confidence !== undefined ? match.confidence :
                            ((match.properties && match.properties.confidence) || null);
                        var horizon = match.horizon_days !== undefined ? match.horizon_days :
                            ((match.properties && match.properties.horizon) || null);

                        if (typeof val === 'number') {
                            popupContent += '<div style="color:#fbbf24;font-size:12px;margin-top:4px;">Вероятность: ' + val.toFixed(1) + '%</div>';
                        }
                        if (typeof conf === 'number') {
                            popupContent += '<div style="color:#94a3b8;font-size:11px;">Уверенность: ' + (conf * 100).toFixed(0) + '%</div>';
                        }
                        if (typeof horizon === 'number') {
                            popupContent += '<div style="color:#94a3b8;font-size:11px;">Горизонт: ' + horizon + ' дн.</div>';
                        }
                    }
                }
                popupContent += '</div>';
                layer.bindPopup(popupContent);
                layer.on('mouseover', function() { this.setStyle({ weight: 2.5, opacity: 1, fillOpacity: 0.7 }); });
                layer.on('mouseout', function() { this.setStyle({ weight: 1.2, opacity: 0.7, fillOpacity: 0.5 }); });
            }
        }).addTo(map);

        currentLabelsLayer = L.layerGroup().addTo(map);
        addCountryLabels(data);
        boundariesLoaded = true;
        console.log('[Forecast] Границы загружены локально из data/world.geojson');
    } catch (e) {
        console.warn('[Forecast] Ошибка загрузки GeoJSON: ' + e.message);
    }
}

function addCountryLabels(geoData) {
    var map = window.map;
    if (!map || !geoData || !geoData.features) return;
    for (var fi = 0; fi < geoData.features.length; fi++) {
        var feature = geoData.features[fi];
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
                var lat = 0, lng = 0, count = 0;
                for (var ci = 0; ci < coords.length; ci++) {
                    var c = coords[ci];
                    if (c && c.length >= 2) { lat += c[1]; lng += c[0]; count++; }
                }
                if (count > 0) center = { lat: lat / count, lng: lng / count };
            }
        } else if (feature.geometry && feature.geometry.type === "MultiPolygon") {
            if (feature.geometry.coordinates && feature.geometry.coordinates[0] && feature.geometry.coordinates[0][0]) {
                var mp = feature.geometry.coordinates[0][0];
                var lat2 = 0, lng2 = 0, count2 = 0;
                for (var mi = 0; mi < mp.length; mi++) {
                    var c2 = mp[mi];
                    if (c2 && c2.length >= 2) { lat2 += c2[1]; lng2 += c2[0]; count2++; }
                }
                if (count2 > 0) center = { lat: lat2 / count2, lng: lng2 / count2 };
            }
        }
        if (center && center.lat && center.lng) {
            L.marker([center.lat, center.lng], {
                icon: L.divIcon({
                    className: 'country-label',
                    html: '<span class="country-label">' + nameRu + '</span>',
                    iconSize: [0, 0],
                    iconAnchor: [0, 0]
                })
            }).addTo(currentLabelsLayer);
        }
    }
}

// ============================================================
// APPLY CHOROPLETH — вероятностная заливка
// ============================================================

function applyChoropleth(data, layer) {
    if (!data || !data.features || data.features.length === 0) {
        console.warn('[Choropleth] Нет данных');
        return;
    }

    currentChoroplethData = data;
    window.currentChoroplethData = data;

    // Конфиг
    var config = { method: 'manual', palette: null, numClasses: 5, breaks: null, manualBreaks: [20, 40, 60, 80] };
    if (window.getLayerConfig && layer && layer.id) {
        var override = window.getLayerConfig(layer.id);
        config.method = override.method || 'manual';
        config.numClasses = override.numClasses || 5;
        config.manualBreaks = override.breaks || [20, 40, 60, 80];
        if (override.palette && window.getColorPalette) {
            config.palette = window.getColorPalette(override.palette);
        }
    }

    // Значения вероятности
    var values = data.features.map(function(f) {
        return f.value !== undefined ? f.value : (f.properties && f.properties.value);
    }).filter(function(v) { return typeof v === 'number' && !isNaN(v); });

    var breaks = classifyValues(values, config.method, config.numClasses, config.manualBreaks);
    config.breaks = breaks;

    var gvf = computeGVF(values, breaks);
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

    console.log('[Choropleth] method=' + config.method + ', breaks=' + JSON.stringify(breaks) + ', GVF=' + gvf.toFixed(4));

    // Применяем к границам
    if (currentGeoJsonLayer) {
        currentGeoJsonLayer.eachLayer(function(l) {
            if (!l.feature || !l.feature.properties) return;
            var nameEn = l.feature.properties.name || l.feature.properties.NAME || "";
            var nameRu = COUNTRY_NAME_MAP[nameEn] || nameEn;

            var match = data.features.find(function(f) {
                var fName = f.name || (f.properties && f.properties.name) || '';
                return fName.toLowerCase() === nameRu.toLowerCase() ||
                       fName.toLowerCase() === nameEn.toLowerCase();
            });

            if (match) {
                var fillColor = match.fillColor || (match.properties && match.properties.fillColor);
                var fillOpacity = match.fillOpacity !== undefined ? match.fillOpacity :
                    ((match.properties && match.properties.fillOpacity) !== undefined ? match.properties.fillOpacity : null);

                // Пересчёт цвета, если не задан
                if (!fillColor) {
                    var value = match.value !== undefined ? match.value : (match.properties && match.properties.value);
                    var palette = config.palette || ['#d7191c', '#fdae61', '#ffffbf', '#abd9e9', '#2c7bb6'];
                    fillColor = getColorForValue(value, breaks, palette);
                }

                // Пересчёт прозрачности, если не задана
                if (fillOpacity === null) {
                    var conf = match.confidence !== undefined ? match.confidence :
                        ((match.properties && match.properties.confidence) || 0.7);
                    fillOpacity = 0.4 + 0.5 * Math.min(Math.max(conf, 0), 1);
                }

                l.setStyle({
                    fillColor: fillColor,
                    fillOpacity: fillOpacity,
                    color: '#ffffff',
                    weight: 1.2,
                    opacity: 0.7
                });
            } else {
                l.setStyle({ fillColor: '#3a3a4a', fillOpacity: 0.4, color: '#4a4a5a', weight: 0.8 });
            }
        });
        console.log('[Choropleth] Закрашено стран: ' + data.features.length);
    } else {
        console.warn('[Choropleth] Границы не загружены, перезагружаем...');
        boundariesLoaded = false;
        loadCountryBoundaries().then(function() {
            if (currentGeoJsonLayer && currentChoroplethData) {
                applyChoropleth(currentChoroplethData, layer);
            }
        });
    }

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

    var palette = config.palette || ['#d7191c', '#fdae61', '#ffffbf', '#abd9e9', '#2c7bb6'];
    var gvfColor = gvf >= 0.7 ? '#22c55e' : '#ef4444';
    var methodName = (config.method || 'manual').toUpperCase();

    var html = '<div class="legend-title">' + methodName + '</div>';
    for (var i = 0; i < breaks.length - 1; i++) {
        var lo = breaks[i].toFixed(1);
        var hi = breaks[i + 1].toFixed(1);
        var color = palette[Math.min(i, palette.length - 1)] || '#888';
        html += '<div class="legend-item"><span class="legend-swatch" style="background:' + color + ';"></span>' +
                lo + ' — ' + hi + '</div>';
    }
    html += '<div class="legend-gvf" style="color:' + gvfColor + ';">GVF: ' + gvf.toFixed(4) + '</div>';
    html += '<div class="legend-opacity">Прозрачность = confidence (0.4–0.9)</div>';

    legendEl.innerHTML = html;
    legendEl.style.display = 'block';
}

// ============================================================
// СБРОС
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
window.renderChoroplethLegend = renderChoroplethLegend;

console.log("MAP-CONTROLS.JS готов (Forecast Map v5.0, 5 методов классификации)");
