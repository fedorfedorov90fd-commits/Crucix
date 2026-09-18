/**
 * mapController.js — управление геокартой Crucix
 * Инициализация, слои, маркеры, взаимодействие
 */
export const mapController = {
  map: null,
  layers: {},
  markers: [],
  initialized: false,

  init(containerId = 'map') {
    if (this.initialized) return this;
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn('mapController: контейнер не найден');
      return this;
    }
    this.map = { container, center: [0, 0], zoom: 2, layers: {}, markers: [] };
    this.initialized = true;
    console.log('mapController: карта инициализирована');
    return this;
  },

  addLayer(id, config) {
    if (!this.map) return this;
    this.map.layers[id] = { ...config, id, visible: true };
    return this;
  },

  addMarker(lat, lng, data = {}) {
    if (!this.map) return this;
    this.map.markers.push({ lat, lng, ...data });
    return this;
  },

  getState() {
    return this.map ? { initialized: true, layers: Object.keys(this.map.layers).length, markers: this.map.markers.length } : { initialized: false };
  },

  getMap() { return this.map; }
};

window.mapController = mapController;
