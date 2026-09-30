/**
 * map-controller.mjs
 * Единый контроллер карты для всех слоёв Crucix
 *
 * Особенности:
 * - Один экземпляр карты для всей страницы
 * - Переключение слоёв без потери зума и центра
 * - Поддержка: маркеры, полигоны, тепловая карта, хороплет
 */

class MapController {
  constructor(elementId = 'map') {
    this.elementId = elementId;
    this.map = null;
    this.currentLayer = null;
    this.layerType = null;
    this.zoom = 2;
    this.center = [20, 0];
    this.initialized = false;
    this.tileLayer = null;
  }

  /**
   * Инициализация карты
   */
  init() {
    if (this.initialized) return this.map;

    this.map = L.map(this.elementId, {
      center: this.center,
      zoom: this.zoom,
      minZoom: 2,
      maxZoom: 12,
      zoomControl: true,
      fadeAnimation: true,
      zoomAnimation: true
    });

    // Тёмная подложка без надписей
    this.tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; CartoDB',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(this.map);

    // Сохраняем состояние при изменении
    this.map.on('zoomend', () => {
      this.zoom = this.map.getZoom();
    });
    this.map.on('moveend', () => {
      this.center = this.map.getCenter();
    });

    this.initialized = true;
    console.log('🗺️ MapController инициализирован');
    return this.map;
  }

  /**
   * Получить экземпляр карты
   */
  getMap() {
    if (!this.initialized) return this.init();
    return this.map;
  }

  /**
   * Загрузить слой
   * @param {string} type - тип слоя: 'markers', 'choropleth', 'heatmap', 'polygons'
   * @param {Array} data - данные в формате GeoJSON FeatureCollection
   * @param {Object} options - опции рендеринга
   */
  loadLayer(type, data, options = {}) {
    const map = this.getMap();

    // Удаляем старый слой
    if (this.currentLayer) {
      map.removeLayer(this.currentLayer);
      this.currentLayer = null;
    }

    if (!data || !data.features || data.features.length === 0) {
      console.warn('⚠️ Нет данных для отображения');
      return;
    }

    this.layerType = type;
    let layer;

    switch (type) {
      case 'markers':
        layer = this.renderMarkers(data, options);
        break;
      case 'choropleth':
        layer = this.renderChoropleth(data, options);
        break;
      case 'heatmap':
        layer = this.renderHeatmap(data, options);
        break;
      case 'polygons':
        layer = this.renderPolygons(data, options);
        break;
      default:
        console.warn('⚠️ Неизвестный тип слоя:', type);
        return;
    }

    if (layer) {
      layer.addTo(map);
      this.currentLayer = layer;

      // Если нужно — подгоняем границы
      if (options.fitBounds !== false) {
        try {
          map.fitBounds(layer.getBounds(), { padding: [40, 40] });
        } catch (e) {
          // Если слой не имеет границ — игнорируем
        }
      }

      console.log(`✅ Загружен слой: ${type}, элементов: ${data.features.length}`);
    }
  }

  /**
   * Рендеринг маркеров (кружки)
   */
  renderMarkers(data, options) {
    const layer = L.layerGroup();
    const defaultRadius = options.radius || 12;
    const defaultColor = options.color || '#4d6bfe';

    data.features.forEach(f => {
      const coords = f.geometry.coordinates;
      const props = f.properties || {};
      const value = props.value || 0;

      let color = defaultColor;
      let radius = defaultRadius;

      if (options.colorMap) {
        if (typeof options.colorMap === 'function') {
          color = options.colorMap(value);
        } else if (value > 25) { color = '#ef4444'; radius = 18; }
        else if (value > 18) { color = '#f59e0b'; radius = 15; }
        else if (value > 12) { color = '#4d6bfe'; radius = 12; }
        else { color = '#22c55e'; radius = 10; }
      }

      const marker = L.circleMarker([coords[1], coords[0]], {
        radius: radius,
        fillColor: color,
        color: '#fff',
        weight: 1.5,
        opacity: 0.8,
        fillOpacity: 0.7
      });

      // Попап
      const label = props.label || `Значение: ${value}`;
      const region = props.region || props.country || 'Неизвестно';
      const popupContent = `
        <div style="font-family: system-ui; color: #1a1a2e; min-width: 160px;">
          <div style="font-weight: 600; font-size: 15px;">${label}</div>
          <div style="color: #666; font-size: 12px;">📍 ${region}</div>
          <div style="color: #888; font-size: 11px;">🕐 ${props.timestamp || ''}</div>
        </div>
      `;
      marker.bindPopup(popupContent);
      layer.addLayer(marker);
    });

    return layer;
  }

  /**
   * Рендеринг хороплета (заливка стран)
   */
  renderChoropleth(data, options) {
    const layer = L.layerGroup();
    const colorMap = options.colorMap || ((v) => {
      if (v > 25) return '#ef4444';
      if (v > 18) return '#f59e0b';
      if (v > 12) return '#4d6bfe';
      return '#22c55e';
    });

    data.features.forEach(f => {
      const coords = f.geometry.coordinates;
      const props = f.properties || {};
      const value = props.value || 0;

      // Для хороплета нужны полигоны, но если у нас точки — показываем кружки
      if (f.geometry.type === 'Point') {
        const marker = L.circleMarker([coords[1], coords[0]], {
          radius: 15,
          fillColor: colorMap(value),
          color: '#fff',
          weight: 1.5,
          opacity: 0.8,
          fillOpacity: 0.8
        });
        marker.bindPopup(`<b>${props.label || 'VIX'}</b><br>${value}`);
        layer.addLayer(marker);
      } else if (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') {
        // Полигоны — заливаем цветом
        const polygon = L.geoJSON(f, {
          style: {
            fillColor: colorMap(value),
            fillOpacity: 0.7,
            color: '#ffffff',
            weight: 1,
            opacity: 0.5
          },
          onEachFeature: (feature, layer) => {
            layer.bindPopup(`<b>${props.country || props.name || 'Страна'}</b><br>VIX: ${value}`);
          }
        });
        layer.addLayer(polygon);
      }
    });

    return layer;
  }

  /**
   * Рендеринг тепловой карты
   */
  renderHeatmap(data, options) {
    // Проверяем наличие библиотеки
    if (typeof L.heatLayer === 'undefined') {
      console.warn('⚠️ L.heatLayer не загружена, загружаем...');
      // Загружаем библиотеку динамически
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.heat/0.2.0/leaflet-heat.js';
      document.head.appendChild(script);
    }

    const points = data.features
      .map(f => {
        const coords = f.geometry.coordinates;
        const value = f.properties?.value || 1;
        return [coords[1], coords[0], value];
      })
      .filter(p => p[0] !== undefined && p[1] !== undefined);

    if (points.length === 0) {
      console.warn('⚠️ Нет точек для тепловой карты');
      return L.layerGroup();
    }

    const intensity = options.intensity || 0.5;
    const radius = options.radius || 20;

    try {
      return L.heatLayer(points, {
        radius: radius,
        blur: 15,
        maxZoom: 10,
        intensity: intensity,
        gradient: {
          0.0: '#22c55e',
          0.3: '#4d6bfe',
          0.6: '#f59e0b',
          0.9: '#ef4444',
          1.0: '#dc2626'
        }
      });
    } catch (e) {
      console.error('Ошибка создания тепловой карты:', e);
      return L.layerGroup();
    }
  }

  /**
   * Рендеринг полигонов
   */
  renderPolygons(data, options) {
    const layer = L.layerGroup();
    const style = options.style || {
      fillColor: '#4d6bfe',
      fillOpacity: 0.4,
      color: '#ffffff',
      weight: 1.5,
      opacity: 0.6
    };

    L.geoJSON(data, {
      style: style,
      onEachFeature: (feature, layer) => {
        const props = feature.properties || {};
        if (props.label) {
          layer.bindPopup(props.label);
        }
      }
    }).eachLayer(l => layer.addLayer(l));

    return layer;
  }

  /**
   * Очистить слой
   */
  clearLayer() {
    if (this.currentLayer) {
      this.map.removeLayer(this.currentLayer);
      this.currentLayer = null;
    }
    this.layerType = null;
  }

  /**
   * Получить состояние карты
   */
  getState() {
    return {
      zoom: this.zoom,
      center: this.center,
      layerType: this.layerType,
      initialized: this.initialized
    };
  }

  /**
   * Установить состояние
   */
  setState(state) {
    if (state.zoom) this.zoom = state.zoom;
    if (state.center) this.center = state.center;
    if (state.layerType) this.layerType = state.layerType;
    if (this.initialized && state.zoom && state.center) {
      this.map.setView(state.center, state.zoom);
    }
  }
}

// Создаём глобальный экземпляр
window.mapController = new MapController();

export default window.mapController;
