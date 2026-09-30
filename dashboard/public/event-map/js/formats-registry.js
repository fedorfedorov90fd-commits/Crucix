/**
 * formats-registry.js — реестр всех форматов данных, встречающихся в OSINT.
 * Личный арсенал event-map. Только данные. Не парсит, не хранит.
 * По этому реестру создаются потребители (renderer-*.js).
 *
 * Таксономия: T/S/C/R/X + dispatcher (5+1).
 */

window.FORMATS_REGISTRY = {

  // A. Что сервер отдаёт в ответе /api/layers/<route>
  serverResponseFormats: {
    'geojson-featurecollection': { desc: 'GeoJSON FeatureCollection — основной формат', examples: ['acled', 'aviation', 'botnets'] },
    'flat-array':                { desc: 'Плоский массив объектов',                       examples: [] },
    'crucix-basket-v1':          { desc: 'Нормализованная корзина v1',                   examples: ['aviation'] },
    'crucix-basket-legacy':      { desc: 'Старая корзина (array)',                       examples: ['botnets'] },
    'choropleth-geojson':        { desc: 'GeoJSON с заливкой по ISO-коду',               examples: [] },
    'series':                    { desc: 'Временной ряд',                                 examples: [] },
    'graph':                     { desc: 'Граф узлов и рёбер',                            examples: [] },
    'documents':                 { desc: 'Массив документов',                             examples: [] }
  },

  // B. Пять измерений + dispatcher
  dimensions: {
    'T':          { name: 'Time',        desc: 'Даты, ряды, ISO 8601',           clientParser: 'formats-timeseries.js',  serverAdapter: 'timeseries.mjs',   serverStatus: 'IMPLEMENTED v2.2.1' },
    'S':          { name: 'Space',       desc: 'WGS84, точки',                   clientParser: 'formats-spatial.js',     serverAdapter: 'points.mjs',       serverStatus: 'IMPLEMENTED v2.2.1' },
    'C':          { name: 'Category',    desc: 'Страны, регионы, ISO-коды',      clientParser: 'formats-categorical.js', serverAdapter: 'regions.mjs',      serverStatus: 'IMPLEMENTED v2.1.0' },
    'R':          { name: 'Relation',    desc: 'Граф связей source→target',      clientParser: 'formats-relational.js',  serverAdapter: null,               serverStatus: 'NOT_IMPLEMENTED' },
    'X':          { name: 'Text',        desc: 'Документы, новости',             clientParser: 'formats-textual.js',     serverAdapter: null,               serverStatus: 'NOT_IMPLEMENTED' },
    'dispatcher': { name: 'Hierarchical',desc: 'Разворот вложенности',           clientParser: 'formats-dispatch.js',    serverAdapter: 'hierarchical.mjs', serverStatus: 'IMPLEMENTED v1.1.0' }
  },

  // C. Композиции измерений
  compositions: {
    '{T}':       { desc: 'Чистый ряд',            examples: ['yield-curve', 'fred'] },
    '{S}':       { desc: 'Чистые точки',          examples: ['botnets', 'military-bases'] },
    '{C}':       { desc: 'Чистый справочник',     examples: ['big-mac'] },
    '{R}':       { desc: 'Чистый граф',           examples: [] },
    '{X}':       { desc: 'Чистый текст',          examples: [] },
    '{T,S}':     { desc: 'Событие: время + место',examples: ['acled', 'earthquakes'] },
    '{T,C}':     { desc: 'Панельные данные',      examples: ['inflation', 'cii'] },
    '{T,S,C}':   { desc: 'Полное событие',        examples: ['aviation', 'gdelt-events'] },
    '{S,C}':     { desc: 'Точки с категорией',    examples: ['military-bases'] },
    '{T,X}':     { desc: 'Лента новостей',        examples: ['rss', 'currents'] },
    '{T,S,X}':   { desc: 'Гео-новости',           examples: ['gdelt-news'] },
    '{S,X}':     { desc: 'Гео-текст',             examples: [] },
    '{T,S,X,C}': { desc: 'Полная запись события', examples: ['acled'] },
    '{R,S}':     { desc: 'Пространственный граф', examples: ['cascade'] }
  },

  // D. Форматы вложенности
  nestingFormats: {
    'flat':    { desc: 'Плоский массив [{...}, {...}]' },
    'wrapped': { desc: 'Массив в контейнере {features: [...]}' },
    'deep':    { desc: 'Глубокая вложенность {data: {values: [...]}}' },
    'single':  { desc: 'Один объект (не массив) {iss: {...}}' },
    'mixed':   { desc: 'Комбинация массивов {points: [...], series: [...]}' }
  },

  // E. Форматы источника данных
  sourceFormats: {
    'json-flat':   { status: 'active' },
    'json-nested': { status: 'active' },
    'geojson':     { status: 'active' },
    'csv':         { status: 'planned' },
    'netcdf':      { status: 'planned' },
    'binary':      { status: 'planned' }
  },

  // F. Форматы координат
  coordinateFormats: {
    '[lng, lat]':             { desc: 'GeoJSON стандарт', status: 'active' },
    '[lat, lng]':             { desc: 'Обратный порядок', status: 'fallback' },
    '{lat, lng}':             { desc: 'Объект',           status: 'fallback' },
    '{lat, lon}':             { desc: 'Объект с lon',     status: 'fallback' },
    '{latitude, longitude}':  { desc: 'Полные имена',     status: 'fallback' },
    '{y, x}':                 { desc: 'Математический',   status: 'fallback' }
  },

  // G. Форматы ошибок сервера
  errorFormats: {
    'route_not_found':            { http: 404,  action: 'skip_silent', desc: 'Route не найден в реестре' },
    'registry_not_loaded':        { http: 503,  action: 'skip_silent', desc: 'Реестр не загружен' },
    'unrecognized_basket_format': { http: 500,  action: 'skip_warn',   desc: 'Basket неизвестного формата' },
    'data_source_error':          { http: 500,  action: 'skip_warn',   desc: 'Ошибка источника' },
    'http_500_generic':           { http: 500,  action: 'skip_warn',   desc: 'Внутренняя ошибка сервера' },
    'http_503_generic':           { http: 503,  action: 'skip_silent', desc: 'Сервис недоступен' },
    'http_4xx_client':            { http: 400,  action: 'skip_warn',   desc: 'Ошибка клиента' }
  },

  meta: {
    version: '1.1.0',
    created: '2026-09-27',
    taxonomy: '5+1 (T/S/C/R/X + hierarchical)',
    principle: 'Изоляция карт — личный арсенал',
    serverAdapters: {
      'T': 'timeseries.mjs v2.2.1',
      'S': 'points.mjs v2.2.1',
      'C': 'regions.mjs v2.1.0',
      'T+S': 'events.mjs v2.2.0',
      'dispatcher': 'hierarchical.mjs v1.1.0',
      'R': null,
      'X': null
    },
    observations: {
      'acled':       { http: 200, format: 'geojson-featurecollection', coords: '[lng, lat]' },
      'aviation':    { http: 200, format: 'crucix-basket-v1',          coords: '[lng, lat]', basket_shape: 'v1.points' },
      'botnets':     { http: 200, format: 'crucix-basket-legacy',      coords: '[lng, lat]', basket_shape: 'array' },
      'cii':         { http: 503, format: null },
      'earthquakes': { http: 500, format: null },
      'currents':    { http: 503, format: null },
      'conflicts':   { http: 404, format: null },
      'cyber':       { http: 500, format: null, error: 'unrecognized_basket_format' }
    }
  }
};

console.log('[formats-registry] загружен, v' + window.FORMATS_REGISTRY.meta.version);
