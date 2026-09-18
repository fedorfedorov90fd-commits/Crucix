// ============================================================
// COUNTRY-BOUNDARIES.JS — Границы и цвета стран
// ============================================================

import { getMap, getCountryData } from './geo-map-core.js';

const COUNTRY_NAME_MAP = {
    'Russia': 'Россия', 'Ukraine': 'Украина', 'United States': 'США',
    'United Kingdom': 'Великобритания', 'France': 'Франция', 'Germany': 'Германия',
    'China': 'Китай', 'India': 'Индия', 'Turkey': 'Турция',
    'Japan': 'Япония', 'South Korea': 'Южная Корея', 'North Korea': 'Северная Корея',
    'Iran': 'Иран', 'Israel': 'Израиль', 'Saudi Arabia': 'Саудовская Аравия',
    'Egypt': 'Египет', 'Pakistan': 'Пакистан', 'Afghanistan': 'Афганистан',
    'Iraq': 'Ирак', 'Syria': 'Сирия', 'Yemen': 'Йемен',
    'Somalia': 'Сомали', 'Ethiopia': 'Эфиопия', 'Sudan': 'Судан',
    'Poland': 'Польша', 'Lithuania': 'Литва', 'Latvia': 'Латвия',
    'Estonia': 'Эстония', 'Armenia': 'Армения', 'Azerbaijan': 'Азербайджан',
    'Venezuela': 'Венесуэла', 'Colombia': 'Колумбия', 'Palestine': 'Палестина',
    'Lebanon': 'Ливан', 'Myanmar': 'Мьянма', 'Kazakhstan': 'Казахстан',
    'Uzbekistan': 'Узбекистан', 'Turkmenistan': 'Туркменистан', 'Kyrgyzstan': 'Кыргызстан',
    'Tajikistan': 'Таджикистан', 'Mongolia': 'Монголия', 'Nepal': 'Непал',
    'Bangladesh': 'Бангладеш', 'Sri Lanka': 'Шри-Ланка', 'Cambodia': 'Камбоджа',
    'Laos': 'Лаос', 'Vietnam': 'Вьетнам', 'Thailand': 'Таиланд',
    'Malaysia': 'Малайзия', 'Indonesia': 'Индонезия', 'Philippines': 'Филиппины',
    'Australia': 'Австралия', 'New Zealand': 'Новая Зеландия', 'Canada': 'Канада',
    'Mexico': 'Мексика', 'Brazil': 'Бразилия', 'Argentina': 'Аргентина',
    'Chile': 'Чили', 'Peru': 'Перу', 'South Africa': 'ЮАР',
    'Nigeria': 'Нигерия', 'Kenya': 'Кения', 'Morocco': 'Марокко',
    'Algeria': 'Алжир', 'Tunisia': 'Тунис', 'Libya': 'Ливия',
    'UAE': 'ОАЭ', 'Qatar': 'Катар', 'Oman': 'Оман',
    'Kuwait': 'Кувейт', 'Bahrain': 'Бахрейн', 'Jordan': 'Иордания'
};

const STATUS_COLORS = {
    critical: '#ef4444',
    'pre-war': '#f97316',
    high: '#f59e0b',
    medium: '#eab308',
    low: '#22c55e'
};

const INACTIVE_COLORS = ['#3a3a4a', '#454555', '#3f3f4f', '#4a4a5a', '#353545'];

export async function loadCountryBoundaries() {
    const map = getMap();
    const countryData = getCountryData();
    
    try {
        const response = await fetch(
            'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson');
        const data = await response.json();
        if (!data || !data.features) return;

        let inactiveIndex = 0;

        const geoJsonLayer = L.geoJSON(data, {
            style: function(feature) {
                const nameEn = feature.properties?.name || feature.properties?.NAME || '';
                const nameRu = COUNTRY_NAME_MAP[nameEn] || nameEn;
                let fillColor = '#2a3a4a';
                let fillOpacity = 0.4;

                for (const [id, country] of Object.entries(countryData)) {
                    if (country.name === nameRu || country.name === nameEn) {
                        const status = country.status;
                        fillColor = (STATUS_COLORS[status] || '#22c55e') + '77';
                        fillOpacity = 0.55;
                        break;
                    }
                }

                if (fillColor === '#2a3a4a') {
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
                    className: 'country-boundary'
                };
            },
            onEachFeature: function(feature, layer) {
                const nameEn = feature.properties?.name || feature.properties?.NAME || '';
                const nameRu = COUNTRY_NAME_MAP[nameEn] || nameEn;
                let statusText = 'Нет данных';
                let color = '#22c55e';

                for (const [id, country] of Object.entries(countryData)) {
                    if (country.name === nameRu || country.name === nameEn) {
                        const status = country.status;
                        color = STATUS_COLORS[status] || '#22c55e';
                        statusText = status === 'critical' ? '🔴 Критический' :
                            status === 'pre-war' ? '🟠 Предвоенный' :
                            status === 'high' ? '🟠 Высокий' :
                            status === 'medium' ? '🟡 Средний' : '🟢 Нормальный';
                        break;
                    }
                }

                layer.bindPopup(`
                    <div style="padding:4px 0;">
                        <strong style="color:#e8f0f8;font-size:15px;">${nameRu}</strong><br>
                        <span style="color:${color};font-weight:600;font-size:13px;">${statusText}</span>
                    </div>
                `);

                layer.on('mouseover', function() {
                    this.setStyle({ weight: 2.5, opacity: 1, fillOpacity: 0.7 });
                    this.openPopup();
                });
                layer.on('mouseout', function() {
                    this.setStyle({ weight: 1.2, opacity: 0.7, fillOpacity: 0.5 });
                    this.closePopup();
                });
            }
        }).addTo(map);

        // Добавляем подписи стран
        addCountryLabels(data);

        try {
            const bounds = geoJsonLayer.getBounds();
            if (bounds.isValid()) map.fitBounds(bounds.pad(0.08));
        } catch (e) { map.setView([30, 20], 2.5); }

    } catch (e) {
        console.warn('[Geo Map] Ошибка границ:', e);
    }
}

function addCountryLabels(geoData) {
    const map = getMap();
    const countryData = getCountryData();
    
    if (!geoData || !geoData.features) return;

    const labelsLayer = L.layerGroup().addTo(map);

    for (const feature of geoData.features) {
        const nameEn = feature.properties?.name || feature.properties?.NAME || '';
        const nameRu = COUNTRY_NAME_MAP[nameEn] || nameEn;
        if (!nameRu || nameRu.length < 2 || nameRu === 'Antarctica') continue;

        let isActive = false;
        for (const [id, country] of Object.entries(countryData)) {
            if (country.name === nameRu || country.name === nameEn) { isActive = true; break; }
        }
        if (nameRu === 'Россия' || nameRu === 'США' || nameRu === 'Китай' || nameRu === 'Индия') {
            isActive = true;
        }

        let center = null;
        if (feature.properties?.center) {
            center = feature.properties.center;
        } else if (feature.geometry && feature.geometry.type === 'Polygon') {
            const coords = feature.geometry.coordinates[0];
            if (coords && coords.length > 0) {
                let lat = 0, lng = 0, count = 0;
                for (const c of coords) {
                    if (c && c.length >= 2) { lat += c[1]; lng += c[0]; count++; }
                }
                if (count > 0) { center = { lat: lat / count, lng: lng / count }; }
            }
        } else if (feature.geometry && feature.geometry.type === 'MultiPolygon') {
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
            let labelClass = 'country-label';
            let labelText = nameRu;
            if (nameRu === 'Россия') { labelClass = 'country-label-russia'; }
            else if (!isActive) { labelClass = 'country-label-inactive'; }

            const label = L.marker([center.lat, center.lng], {
                icon: L.divIcon({
                    className: labelClass,
                    html: `<span class="${labelClass}">${labelText}</span>`,
                    iconSize: [0, 0],
                    iconAnchor: [0, 0]
                })
            }).addTo(labelsLayer);
        }
    }
}
