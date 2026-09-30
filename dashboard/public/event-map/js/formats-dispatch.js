/**
 * formats-dispatch.js — диспетчер форматов.
 * Личный арсенал event-map. Только данные. Не код.
 * Логика применения — в renderer.js.
 *
 * Задача: определить формат ответа /api/layers/<route> и направить
 * в нужный парсер (formats-timeseries / spatial / categorical / relational / textual).
 *
 * Серверный адаптер: hierarchical.mjs v1.1.0
 *   UNWRAP_KEYS = ['objects', 'features', 'data', 'items', 'rows']
 *   Стратегия: найти массив в верхнеуровневых ключах.
 */

window.FORMATS_DISPATCH = {

  formatId: 'dispatch',

  // Ключи, по которым определяется вложенность
  unwrapKeys: ['objects', 'features', 'data', 'items', 'rows', 'values', 'measurements', 'cities', 'airports', 'iss'],

  // Определение формата верхнего уровня
  detectors: {
    'isGeojsonFC':     '(d) => d && d.type === "FeatureCollection" && Array.isArray(d.features)',
    'isBasketV1':      '(d) => d && d.schema === "crucix.basket.v1"',
    'isFlatArray':     '(d) => Array.isArray(d)',
    'isWrappedArray':  '(d) => d && typeof d === "object" && !Array.isArray(d) && Object.keys(d).some(k => Array.isArray(d[k]))',
    'isSingleObject':  '(d) => d && typeof d === "object" && !Array.isArray(d)'
  },

  // Маршрутизация: определённый формат → какой парсер
  routes: {
    'geojson-featurecollection': 'formats-spatial.js',
    'crucix-basket-v1':          'по полю meta.basket_shape',
    'crucix-basket-legacy':      'formats-spatial.js',
    'flat-array':                'по содержимому элементов',
    'series':                    'formats-timeseries.js',
    'choropleth-geojson':        'formats-categorical.js',
    'graph':                     'formats-relational.js',
    'documents':                 'formats-textual.js'
  },

  // Определение измерения по basket_shape
  basketShapeMap: {
    'v1.points':   'S',
    'v1.series':   'T',
    'v1.regions':  'C',
    'v1.graph':    'R',
    'v1.documents':'X',
    'array':       'по содержимому'
  }

};

console.log('[formats-dispatch] загружен');
