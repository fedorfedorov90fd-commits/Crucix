/**
 * formats-categorical.js — справочник правил парсинга C (Category).
 * Личный арсенал event-map. Только данные. Не код.
 * Логика применения — в renderer.js.
 *
 * Возможные форматы ответа для C-слоёв:
 *   1) {schema: 'crucix.basket.v1', regions: [{iso3, value, name?}, ...]}
 *   2) {type: 'FeatureCollection', features: [{properties: {iso_a3, value}}]}
 *   3) [{country: 'USA', value: 42}, ...]  — плоский массив
 *
 * Серверный адаптер: regions.mjs v2.1.0
 *   Справочник стран: data/reference/countries.json
 *   Поля: region, country, value, count, score
 */

window.FORMATS_CATEGORICAL = {

  formatId: 'categorical',
  dimension: 'C',
  description: 'Регионы и категории (страна/регион + числовое значение)',

  // Основной формат — basket v1 с полем regions
  '_default': {
    parser: 'basket-v1-regions',
    regionsPath: 'regions',
    countryField: ['iso3', 'iso_a3', 'country_code', 'country', 'region', 'name'],
    valueField:   ['value', 'count', 'score', 'index', 'amount'],
    labelField:   ['name', 'label', 'title', 'description'],
    extraFrom: null
  },

  // Fallback — плоский массив объектов
  '_array': {
    parser: 'flat-array',
    countryField: ['country', 'country_code', 'iso_a3', 'iso3', 'name', 'region'],
    valueField:   ['value', 'count', 'score', 'index'],
    labelField:   ['name', 'label', 'title', 'description'],
    extraFrom: null
  },

  // Fallback — GeoJSON FeatureCollection (choropleth)
  '_geojson': {
    parser: 'geojson-featurecollection-choropleth',
    countryField: ['properties.ISO_A3', 'properties.iso_a3', 'properties.ADM0_A3', 'properties.name'],
    valueField:   ['properties.value', 'properties.count', 'properties.index'],
    extraFrom: 'properties'
  },

  // Слои с нестандартным форматом
  byLayer: {}

};

console.log('[formats-categorical] загружен, dimension=C');
