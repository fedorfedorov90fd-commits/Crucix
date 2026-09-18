// ============================================================
// GEO-MAP-CORE.JS — Ядро карты (инициализация Leaflet)
// ============================================================

let map = null;

export function initMap() {
    if (map) return map;
    map = L.map('map', {
        center: [30, 20],
        zoom: 2.5,
        zoomControl: true,
        minZoom: 1.5,
        maxZoom: 10
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap, © CartoDB',
        maxZoom: 19,
        opacity: 0.9
    }).addTo(map);

    return map;
}

export function getMap() { return map; }
