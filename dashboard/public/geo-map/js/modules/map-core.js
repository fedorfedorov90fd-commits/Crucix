// ============================================================
// MAP-CORE.JS — Инициализация карты
// ============================================================

import { getTileLayer } from './map-tiles.js';

let mapInstance = null;

export function initMap(containerId = 'map') {
    if (mapInstance) {
        console.warn('[MapCore] Карта уже инициализирована');
        return mapInstance;
    }

    mapInstance = L.map(containerId, {
        center: [30, 20],
        zoom: 2.5,
        zoomControl: true,
        minZoom: 1.5,
        maxZoom: 10
    });

    // Добавляем тайловый слой
    const tileLayer = getTileLayer();
    tileLayer.addTo(mapInstance);

    console.log('[MapCore] Карта инициализирована');
    return mapInstance;
}

export function getMap() {
    return mapInstance;
}

export function invalidateMap() {
    if (mapInstance) {
        setTimeout(() => mapInstance.invalidateSize(), 300);
    }
}