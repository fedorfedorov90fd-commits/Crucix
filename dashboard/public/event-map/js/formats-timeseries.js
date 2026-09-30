/**
 * formats-timeseries.js — справочник правил парсинга T (Time).
 * Личный арсенал event-map. Только данные. Не код.
 * Логика применения — в renderer.js.
 *
 * Возможные форматы ответа для T-слоёв:
 *   1) {schema: 'crucix.basket.v1', series: [{date, value}, ...]}
 *   2) {schema: 'crucix.basket.v1', series: {values: [...]}, dates: [...]}
 *   3) {type: 'FeatureCollection', features: [{properties: {date, value}}]}
 *   4) [{date, value}, ...]  — плоский массив
 *
 * Серверный адаптер: timeseries.mjs v2.2.1
 *   VALUE_FIELDS = ['magnitude','value','count','index','amount','close','price',
 *                   'ships','fires','events','alerts','incidents','cases',
 *                   'deaths','casualties','fatalities','score']
 */

window.FORMATS_TIMESERIES = {

  formatId: 'timeseries',
  dimension: 'T',
  description: 'Временные ряды (дата + числовое значение)',

  // Основной формат — basket v1 с полем series
  '_default': {
    parser: 'basket-v1-series',
    seriesPath: 'series',           // {schema, series: [...]}
    datesPath:  'dates',            // {dates: [...]} — если values отдельно
    valuesPath: 'series.values',    // {series: {values: [...]}}
    dateField:  ['date', 'timestamp', 'time', 'datetime', 't'],
    valueField: ['value', 'magnitude', 'count', 'index', 'amount', 'close', 'price',
                 'ships', 'fires', 'events', 'alerts', 'incidents', 'cases',
                 'deaths', 'casualties', 'fatalities', 'score'],
    extraFrom: null
  },

  // Fallback — плоский массив [{date, value}]
  '_array': {
    parser: 'flat-array',
    dateField:  ['date', 'timestamp', 'time', 'datetime', 't'],
    valueField: ['value', 'magnitude', 'count', 'index', 'amount', 'close', 'price'],
    extraFrom: null
  },

  // Fallback — GeoJSON FeatureCollection, где series зашит в properties
  '_geojson': {
    parser: 'geojson-featurecollection-timeseries',
    dateField:  ['properties.date', 'properties.timestamp', 'properties.time'],
    valueField: ['properties.value', 'properties.magnitude', 'properties.count'],
    extraFrom: 'properties'
  },

  // Слои с нестандартным форматом (заполняется по мере обнаружения)
  byLayer: {}

};

console.log('[formats-timeseries] загружен, dimension=T');
