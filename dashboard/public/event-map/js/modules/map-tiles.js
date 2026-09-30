// ============================================================
// MAP-TILES.JS — Настройка тайлового слоя (тёмная тема)
// ============================================================

export function getTileLayer() {
    // Stadia Maps — Alidade Smooth Dark (бесплатно, без ключа, без водяных знаков)
    return L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
        attribution: '© Stadia Maps, © OpenStreetMap',
        maxZoom: 20,
        opacity: 0.9
    });
}

// Альтернативные варианты:
//
// 1. OpenStreetMap (светлая) — без ключа, без водяных знаков
// return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//     attribution: '© OpenStreetMap contributors',
//     maxZoom: 19,
//     opacity: 0.9
// });
//
// 2. CartoDB (тёмная) — требует ключа, иначе водяные знаки
// return L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
//     attribution: '© OpenStreetMap, © CartoDB',
//     maxZoom: 19,
//     opacity: 0.9
// });
