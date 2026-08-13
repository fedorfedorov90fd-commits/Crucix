/**
 * Базовый класс для всех драйверов источников данных
 *
 * Каждый драйвер должен наследовать этот класс и реализовать:
 * - fetch() - получение данных
 * - checkAvailability() - проверка доступности
 * - getDriverName() - имя драйвера
 *
 * Все драйверы возвращают данные в едином формате:
 * {
 *   source: 'max' | 'telegram' | 'rss',
 *   fetchedAt: '2026-08-09T14:00:00.000Z',
 *   total: 100,
 *   items: [ { id, title, date, url, summary, source } ]
 * }
 */

export class BaseDriver {
  constructor() {
    this.name = 'base';
    this.isAvailable = false;
    this.lastError = null;
  }

  /**
   * Проверка доступности источника
   * @returns {Promise<{available: boolean, score: number, latency: number}>}
   */
  async checkAvailability() {
    throw new Error('Метод checkAvailability() должен быть реализован');
  }

  /**
   * Получение данных из источника
   * @param {Object} options - параметры запроса
   * @param {number} options.limit - максимальное количество записей
   * @param {string} options.channel - идентификатор канала (опционально)
   * @returns {Promise<Object>} - данные в едином формате
   */
  async fetch(options = {}) {
    throw new Error('Метод fetch() должен быть реализован');
  }

  /**
   * Получение имени драйвера
   * @returns {string}
   */
  getDriverName() {
    return this.name;
  }

  /**
   * Получение статуса драйвера
   * @returns {Object}
   */
  getStatus() {
    return {
      name: this.name,
      available: this.isAvailable,
      lastError: this.lastError,
    };
  }

  /**
   * Приведение данных к единому формату
   * @param {Array} items - сырые данные
   * @param {string} sourceName - название источника
   * @returns {Object}
   */
  normalize(items, sourceName) {
    return {
      source: sourceName || this.name,
      fetchedAt: new Date().toISOString(),
      total: items ? items.length : 0,
      items: items || [],
    };
  }
}
