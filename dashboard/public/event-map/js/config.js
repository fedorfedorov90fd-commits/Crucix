// ============================================================
//  EVENT MAP — CONFIG
//  Одна задача: определить window.CrucixMap.
//  Загружается ПЕРВЫМ. Остальные файлы читают отсюда.
// ============================================================

window.CrucixMap = {
  // Идентификация
  mapType: 'events',
  name: 'Crucix — Event Map',

  // Источник данных карты
  apiEndpoint: '/api/registry/layers?mapType=events',
  layerDataPrefix: '/api/layers/',

  // Категории слоёв этой карты (справочник для UI-подсказок)
  categories: [
    'geopolitical', 'military', 'cyber', 'space', 'health',
    'energy', 'transport', 'ecological', 'infrastructure',
    'intelligence', 'threats', 'social', 'news'
  ],

  // Типы отрисовки, которые использует эта карта
  vizTypes: ['marker', 'choropleth', 'series'],

  // Карта Leaflet
  defaultCenter: [30, 30],
  defaultZoom: 3,
  minZoom: 2,
  maxZoom: 18,
  worldCopyJump: true,

  // Тайлы (тёмная тема CartoDB)
  tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileAttribution: '© OpenStreetMap contributors',

  // Лимиты
  maxMarkersPerLayer: 500,
  maxLayersTotal: 100,

  // UI
  defaultLanguage: 'ru',
  panelWidth: 360,

  // Флаги функционала
  features: {
    ssi: true,           // Strategic Severity Index
    cii: true,           // Conflict Intensity Index
    heat: true,          // тепловая карта
    timeline: true,      // хронология
    presets: true,       // пресеты слоёв
    copy: true,          // копирование данных
    refresh: true,       // автообновление
    logger: true         // лог-панель
  },

  // Автообновление (значения выпадающего списка)
  refreshOptions: [
    { value: 0,   label: 'Авто: Выкл' },
    { value: 30,  label: '30 сек' },
    { value: 60,  label: '1 мин' },
    { value: 300, label: '5 мин' },
    { value: 600, label: '10 мин' }
  ]
};

console.log('[config] Event Map config загружен: mapType=' + window.CrucixMap.mapType);
