/**
 * formats-textual.js — справочник правил парсинга X (Text).
 * Личный арсенал event-map. Только данные. Не код.
 * Логика применения — в renderer.js.
 *
 * ВНИМАНИЕ: серверный адаптер X (textual.mjs) НЕ РЕАЛИЗОВАН.
 * Справочник — заготовка под будущие слои (currents, rss, gdelt-news).
 *
 * Возможные форматы ответа (будущее):
 *   1) {schema: 'crucix.basket.v1', documents: [{title, description, url, ...}]}
 *   2) [{title, description, source, published_at}, ...]
 */

window.FORMATS_TEXTUAL = {

  formatId: 'textual',
  dimension: 'X',
  description: 'Текстовые документы (новости, статьи)',
  status: 'NOT_IMPLEMENTED_SERVER_SIDE',

  '_default': {
    parser: 'basket-v1-documents',
    documentsPath: 'documents',
    titleField: ['title', 'headline', 'name'],
    textField:  ['description', 'text', 'body', 'summary', 'content'],
    urlField:   ['url', 'link', 'href'],
    sourceField:['source', 'domain', 'publisher'],
    timeField:  ['published_at', 'pubDate', 'date', 'timestamp'],
    extraFrom: null
  },

  '_array': {
    parser: 'flat-array-documents',
    titleField: ['title', 'headline', 'name'],
    textField:  ['description', 'text', 'body', 'summary'],
    urlField:   ['url', 'link', 'href'],
    sourceField:['source', 'domain', 'publisher'],
    timeField:  ['published_at', 'pubDate', 'date'],
    extraFrom: null
  },

  byLayer: {}

};

console.log('[formats-textual] загружен, dimension=X (NOT IMPLEMENTED server-side)');
