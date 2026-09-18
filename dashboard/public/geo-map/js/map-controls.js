// ============================================================
// MAP-CONTROLS.JS — Карта, границы, подписи (ЛОКАЛЬНАЯ ВЕРСИЯ)
// ============================================================
// Версия: 3.0 — с поддержкой choropleth и VIX
// ============================================================

console.log("🗺️ MAP-CONTROLS.JS загружен (версия 3.0)");

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
    "Kuwait": "Кувейт", "Bahrain": "Бахрейн", "Jordan": "Иордания"
};

// ============================================================
// ЗАГРУЗКА ГРАНИЦ СТРАН (из локального файла)
// ============================================================

let currentGeoJsonLayer = null;
let currentLabelsLayer = null;
let currentChoroplethData = null;

async function loadCountryBoundaries() {
    const map = window.map;
    if (!map) return;

    if (currentGeoJsonLayer) {
        map.removeLayer(currentGeoJsonLayer);
        currentGeoJsonLayer = null;
    }
    if (currentLabelsLayer) {
        map.removeLayer(currentLabelsLayer);
        currentLabelsLayer = null;
    }

    try {
        const response = await fetch('/world.geojson');
        if (!response.ok) {
            throw new Error('Не удалось загрузить world.geojson');
        }
        const data = await response.json();

        if (!data || !data.features) {
            console.warn("⚠️ Некорректный GeoJSON");
            return;
        }

        window.geoJsonData = data;

        const STATUS_COLORS = {
            critical: "#ef4444",
            "pre-war": "#f97316",
            high: "#f59e0b",
            medium: "#eab308",
            normal: "#22c55e",
            low: "#22c55e"
        };

        const INACTIVE_COLORS = ["#3a3a4a", "#454555", "#3f3f4f", "#4a4a5a", "#353545"];
        let inactiveIndex = 0;

        currentGeoJsonLayer = L.geoJSON(data, {
            style: function(feature) {
                const nameEn = feature.properties?.name || feature.properties?.NAME || "";
                const nameRu = COUNTRY_NAME_MAP[nameEn] || nameEn;

                if (currentChoroplethData) {
                    const match = currentChoroplethData.features.find(f => {
                        const fName = f.name || f.properties?.name || '';
                        return fName.toLowerCase() === nameRu.toLowerCase() || fName.toLowerCase() === nameEn.toLowerCase();
                    });
                    if (match) {
                        const value = match.value || match.properties?.value || 0;
                        const min = Math.min(...currentChoroplethData.features.map(f => f.value || f.properties?.value || 0));
                        const max = Math.max(...currentChoroplethData.features.map(f => f.value || f.properties?.value || 0));
                        const range = max - min || 1;
                        const normalized = Math.min(Math.max((value - min) / range, 0), 1);
                        const r = Math.round(34 + (255 - 34) * normalized);
                        const g = Math.round(205 - 180 * normalized);
                        const b = Math.round(80 - 70 * normalized);
                        return {
                            fillColor: `rgb(${r}, ${g}, ${b})`,
                            fillOpacity: 0.75,
                            color: '#ffffff',
                            weight: 1.2,
                            opacity: 0.7,
                            className: "country-boundary"
                        };
                    }
                }

                if (nameEn === "Antarctica") {
                    return { fillColor: "#d0d5dd", fillOpacity: 0.85, color: "#a0a5ad", weight: 1, opacity: 0.5 };
                }

                let fillColor = "#2a3a4a";
                let fillOpacity = 0.4;
                const countries = window.ALL_COUNTRIES || [];

                for (const country of countries) {
                    if (country.name === nameRu || country.name === nameEn) {
                        const status = country.status;
                        fillColor = (STATUS_COLORS[status] || "#22c55e") + "77";
                        fillOpacity = 0.55;
                        break;
                    }
                }

                if (fillColor === "#2a3a4a") {
                    fillColor = INACTIVE_COLORS[inactiveIndex % INACTIVE_COLORS.length];
                    inactiveIndex++;
                    fillOpacity = 0.35;
                }

                return {
                    fillColor: fillColor,
                    fillOpacity: fillOpacity,
                    color: '#ffffff',
                    weight: 1.2,
                    opacity: 0.7,
                    className: "country-boundary"
                };
            },
            onEachFeature: function(feature, layer) {
                const nameEn = feature.properties?.name || feature.properties?.NAME || "";
                const nameRu = COUNTRY_NAME_MAP[nameEn] || nameEn;

                if (nameEn === "Antarctica") {
                    layer.bindPopup(`<div style="padding:4px 0;"><strong style="color:#d0d5dd;font-size:15px;">❄️ Антарктида</strong><br><span style="color:#a0a5ad;font-size:11px;">Континент мира</span></div>`);
                    return;
                }

                let statusText = "Нет данных";
                let color = "#22c55e";

                for (const country of window.ALL_COUNTRIES || []) {
                    if (country.name === nameRu || country.name === nameEn) {
                        const status = country.status;
                        color = STATUS_COLORS[status] || "#22c55e";
                        statusText = status === "critical" ? "🔴 Критический" :
                            status === "pre-war" ? "🟠 Предвоенный" :
                            status === "high" ? "🟠 Высокий" :
                            status === "medium" ? "🟡 Средний" : "🟢 Нормальный";
                        break;
                    }
                }

                let popupContent = `<div style="padding:4px 0;"><strong style="color:#e8f0f8;font-size:15px;">${nameRu}</strong><br><span style="color:${color};font-weight:600;font-size:13px;">${statusText}</span></div>`;

                if (currentChoroplethData) {
                    const match = currentChoroplethData.features.find(f => {
                        const fName = f.name || f.properties?.name || '';
                        return fName.toLowerCase() === nameRu.toLowerCase() || fName.toLowerCase() === nameEn.toLowerCase();
                    });
                    if (match) {
                        const value = match.value || match.properties?.value || 0;
                        popupContent += `<div style="color:#fbbf24;font-size:12px;margin-top:4px;">📊 Значение: ${typeof value === 'number' ? value.toFixed(2) : value}</div>`;
                    }
                }

                layer.bindPopup(popupContent);

                layer.on("mouseover", function() {
                    this.setStyle({ weight: 2.5, opacity: 1, fillOpacity: 0.7 });
                    this.openPopup();
                });
                layer.on("mouseout", function() {
                    this.setStyle({ weight: 1.2, opacity: 0.7, fillOpacity: 0.5 });
                    this.closePopup();
                });
            }
        }).addTo(map);

        currentLabelsLayer = L.layerGroup().addTo(map);
        addCountryLabels(data);

        try {
            const bounds = currentGeoJsonLayer.getBounds();
            if (bounds.isValid()) map.fitBounds(bounds.pad(0.08));
        } catch (e) { map.setView([30, 20], 2.5); }

        console.log("✅ Границы стран загружены локально");

    } catch (e) {
        console.warn("[Geo Map] Ошибка загрузки локального GeoJSON:", e);
    }
}

// ============================================================
// ПОДПИСИ СТРАН
// ============================================================

function addCountryLabels(geoData) {
    const map = window.map;
    if (!map || !geoData || !geoData.features) return;

    for (const feature of geoData.features) {
        const nameEn = feature.properties?.name || feature.properties?.NAME || "";
        const nameRu = COUNTRY_NAME_MAP[nameEn] || nameEn;
        if (!nameRu || nameRu.length < 2) continue;
        if (nameRu === "Антарктида" || nameRu === "Гренландия") continue;

        let isActive = false;
        const countries = window.ALL_COUNTRIES || [];
        for (const country of countries) {
            if (country.name === nameRu || country.name === nameEn) {
                isActive = true;
                break;
            }
        }
        if (nameRu === "Россия" || nameRu === "США" || nameRu === "Китай" || nameRu === "Индия") {
            isActive = true;
        }

        let center = null;
        if (feature.properties?.center) {
            center = feature.properties.center;
        } else if (feature.geometry && feature.geometry.type === "Polygon") {
            const coords = feature.geometry.coordinates[0];
            if (coords && coords.length > 0) {
                let lat = 0, lng = 0, count = 0;
                for (const c of coords) {
                    if (c && c.length >= 2) { lat += c[1]; lng += c[0]; count++; }
                }
                if (count > 0) { center = { lat: lat / count, lng: lng / count }; }
            }
        } else if (feature.geometry && feature.geometry.type === "MultiPolygon") {
            if (feature.geometry.coordinates && feature.geometry.coordinates[0]) {
                const coords = feature.geometry.coordinates[0][0];
                if (coords && coords.length > 0) {
                    let lat = 0, lng = 0, count = 0;
                    for (const c of coords) {
                        if (c && c.length >= 2) { lat += c[1]; lng += c[0]; count++; }
                    }
                    if (count > 0) { center = { lat: lat / count, lng: lng / count }; }
                }
            }
        }

        if (center && center.lat && center.lng) {
            let labelClass = "country-label";
            let labelText = nameRu;

            if (nameRu === "Россия") {
                labelClass = "country-label-russia";
            } else if (!isActive) {
                labelClass = "country-label-inactive";
            }

            const label = L.marker([center.lat, center.lng], {
                icon: L.divIcon({
                    className: labelClass,
                    html: `<span class="${labelClass}">${labelText}</span>`,
                    iconSize: [0, 0],
                    iconAnchor: [0, 0]
                })
            }).addTo(currentLabelsLayer);
        }
    }

    console.log("[Geo Map] Подписи стран добавлены (локально)");
}

// ============================================================
// ЗАКРАСКА СТРАН (CHOROPLETH)
// ============================================================

function applyChoropleth(data) {
    if (!data || !data.features || data.features.length === 0) {
        console.warn('[Choropleth] Нет данных для закраски');
        return;
    }

    currentChoroplethData = data;

    if (currentGeoJsonLayer) {
        currentGeoJsonLayer.eachLayer(function(layer) {
            if (!layer.feature || !layer.feature.properties) return;
            const nameEn = layer.feature.properties.name || layer.feature.properties.NAME || "";
            const nameRu = COUNTRY_NAME_MAP[nameEn] || nameEn;

            const match = data.features.find(f => {
                const fName = f.name || f.properties?.name || '';
                return fName.toLowerCase() === nameRu.toLowerCase() || fName.toLowerCase() === nameEn.toLowerCase();
            });

            if (match) {
                const value = match.value || match.properties?.value || 0;
                const values = data.features.map(f => f.value || f.properties?.value || 0);
                const min = Math.min(...values);
                const max = Math.max(...values);
                const range = max - min || 1;
                const normalized = Math.min(Math.max((value - min) / range, 0), 1);
                const r = Math.round(34 + (255 - 34) * normalized);
                const g = Math.round(205 - 180 * normalized);
                const b = Math.round(80 - 70 * normalized);
                layer.setStyle({
                    fillColor: `rgb(${r}, ${g}, ${b})`,
                    fillOpacity: 0.75,
                    color: '#ffffff',
                    weight: 1.2,
                    opacity: 0.7
                });
            } else {
                layer.setStyle({
                    fillColor: '#3a3a4a',
                    fillOpacity: 0.4,
                    color: '#4a4a5a',
                    weight: 0.8
                });
            }
        });

        console.log(`[Choropleth] Закрашено стран: ${data.features.length}`);
    } else {
        console.warn('[Choropleth] geoJsonLayer не загружен, перезагружаем границы...');
        loadCountryBoundaries().then(() => {
            if (currentGeoJsonLayer && currentChoroplethData) {
                applyChoropleth(currentChoroplethData);
            }
        });
    }

    if (typeof updateLegend === 'function') {
        updateLegend();
    }
}

// ============================================================
// СБРОС ЗАКРАСКИ
// ============================================================

function resetChoropleth() {
    currentChoroplethData = null;
    if (currentGeoJsonLayer) {
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

console.log("✅ MAP-CONTROLS.JS готов (версия 3.0)");

let boundariesLoaded = false;

const originalLoadCountryBoundaries = window.loadCountryBoundaries;

window.loadCountryBoundaries = async function() {
    if (boundariesLoaded) {
        console.log('[Geo Map] Границы уже загружены, пропускаем');
        return;
    }
    boundariesLoaded = true;
    await originalLoadCountryBoundaries();
};

console.log('✅ MAP-CONTROLS.JS: добавлена защита от двойной загрузки');
