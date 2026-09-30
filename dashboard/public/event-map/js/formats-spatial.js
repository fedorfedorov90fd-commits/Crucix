/**
 * formats-spatial.js — справочник правил парсинга S (Space).
 * Личный арсенал event-map. Только данные. Не код.
 * Логика применения — в renderer.js.
 *
 * Реальный формат ответа /api/layers/<route> для S-слоёв:
 *   {type: 'FeatureCollection', meta: {...}, features: [{geometry: {coordinates: [lng, lat]}, properties: {...}}]}
 *
 * Особенность: properties у каждого слоя свой.
 *   acled:   {id, eventType, eventLabel, actor1, actor2, country, fatalities, date, severity, color, category, icon}
 *   aviation:{flight, aircraft, altitude, altitudeBand, altitudeLabel, speed}
 *   botnets: {id, name, ip, asn, malware, severity}
 * Справочник НЕ знает все поля — только правила извлечения.
 * Остальные поля properties отдаются в renderer как есть (extraFrom).
 */

window.FORMATS_SPATIAL = {

  formatId: 'spatial',
  dimension: 'S',
  description: 'Пространственные точки WGS84',

  '_default': {
    parser: 'geojson-featurecollection',
    lng: 'geometry.coordinates[0]',
    lat: 'geometry.coordinates[1]',
    title: [
      'properties.eventLabel',
      'properties.title',
      'properties.name',
      'properties.description'
    ],
    time: [
      'properties.date',
      'properties.timestamp',
      'properties.event_date',
      'properties.updated_at'
    ],
    color:    ['properties.color'],
    icon:     ['properties.icon'],
    severity: ['properties.severity'],
    category: ['properties.category'],
    country:  ['properties.country', 'properties.countryCode'],
    extraFrom: 'properties',
    metaSource: ['meta.source', 'meta.collector', 'meta.category', 'meta.unit', 'meta.updated_at'],
    legendFrom: ['legend', 'bands']
  },

  '_array': {
    parser: 'flat-array',
    lng: ['lng', 'lon', 'longitude', 'x'],
    lat: ['lat', 'latitude', 'y'],
    title: ['title', 'name', 'description', 'eventLabel'],
    time:  ['date', 'timestamp', 'event_date', 'updated_at'],
    color: ['color'],
    icon:  ['icon'],
    extraFrom: null
  },

  '_swapped': {
    parser: 'flat-array-swapped',
    coordOrder: '[lat, lng]',
    lng: ['lng', 'lon', 'longitude', 'x'],
    lat: ['lat', 'latitude', 'y'],
    title: ['title', 'name', 'description'],
    time:  ['date', 'timestamp']
  },

  // Слои с нестандартным ответом (пока пусто — все S-слои нормализованы сервером)
  byLayer: {}

};

console.log('[formats-spatial] загружен, dimension=S');
