/**
 * Адаптивный шлюз для выбора драйвера мессенджера
 * 
 * При запуске проверяет доступность всех драйверов
 * и выбирает тот, у которого наивысший рейтинг.
 * Поддерживает автоматическое переключение при сбоях
 * и ручной выбор пользователя.
 */

import { MAXDriver } from './drivers/max-driver.mjs';

class MessengerRouter {
  constructor() {
    this.drivers = [];
    this.currentDriver = null;
    this.mode = 'auto'; // 'auto' | 'manual'
    this.manualChoice = null;
    this.status = {};
    
    // Регистрируем все доступные драйверы
    this.registerDrivers();
  }

  /**
   * Регистрация всех драйверов
   */
  registerDrivers() {
    // MAX
    try {
      const max = new MAXDriver();
      this.drivers.push(max);
      console.log('[Router] ✅ Зарегистрирован драйвер: MAX');
    } catch (e) {
      console.log('[Router] ⚠️ Не удалось зарегистрировать MAX:', e.message);
    }

    // Telegram (будет добавлен позже)
    // try {
    //   const tg = new TelegramDriver();
    //   this.drivers.push(tg);
    //   console.log('[Router] ✅ Зарегистрирован драйвер: Telegram');
    // } catch (e) {
    //   console.log('[Router] ⚠️ Не удалось зарегистрировать Telegram:', e.message);
    // }
  }

  /**
   * Выбор наилучшего драйвера
   */
  async selectDriver() {
    // Ручной режим
    if (this.mode === 'manual' && this.manualChoice) {
      const driver = this.drivers.find(d => d.getDriverName() === this.manualChoice);
      if (driver) {
        // Проверяем доступность выбранного драйвера
        const status = await driver.checkAvailability();
        if (status.available) {
          this.currentDriver = driver;
          this.status = status;
          return driver;
        } else {
          console.log(`[Router] ⚠️ Выбранный драйвер ${this.manualChoice} недоступен`);
          // Если выбранный недоступен — переключаемся на авто
          this.mode = 'auto';
        }
      }
    }

    // Автоматический режим
    if (this.mode === 'auto') {
      const results = [];
      for (const driver of this.drivers) {
        try {
          const status = await driver.checkAvailability();
          results.push({ driver, status });
        } catch (e) {
          results.push({ driver, status: { available: false, score: 0, latency: 0 } });
        }
      }

      // Сортируем по оценке доступности (убывание)
      results.sort((a, b) => b.status.score - a.status.score);

      if (results.length > 0 && results[0].status.available) {
        this.currentDriver = results[0].driver;
        this.status = results[0].status;
        console.log(`[Router] ✅ Выбран драйвер: ${this.currentDriver.getDriverName()}`);
        return this.currentDriver;
      } else {
        console.log('[Router] ❌ Ни один драйвер не доступен');
        return null;
      }
    }

    return null;
  }

  /**
   * Получение данных через текущий драйвер
   */
  async fetch(options = {}) {
    if (!this.currentDriver) {
      await this.selectDriver();
    }

    if (!this.currentDriver) {
      throw new Error('Ни один драйвер не доступен');
    }

    try {
      return await this.currentDriver.fetch(options);
    } catch (error) {
      // Если драйвер упал — пытаемся переключиться
      console.log(`[Router] ⚠️ Драйвер ${this.currentDriver.getDriverName()} упал, переключение...`);
      this.currentDriver = null;
      await this.selectDriver();
      
      if (this.currentDriver) {
        return await this.currentDriver.fetch(options);
      } else {
        throw error;
      }
    }
  }

  /**
   * Получение списка доступных драйверов
   */
  getAvailableDrivers() {
    return this.drivers.map(d => d.getDriverName());
  }

  /**
   * Получение имени текущего драйвера
   */
  getCurrentDriverName() {
    return this.currentDriver ? this.currentDriver.getDriverName() : 'Не выбран';
  }

  /**
   * Получение статуса всех драйверов
   */
  async getAllStatus() {
    const statuses = {};
    for (const driver of this.drivers) {
      try {
        const status = await driver.checkAvailability();
        statuses[driver.getDriverName()] = status;
      } catch (e) {
        statuses[driver.getDriverName()] = { available: false, score: 0, latency: 0, error: e.message };
      }
    }
    return statuses;
  }

  /**
   * Установка режима работы
   */
  setMode(mode, choice = null) {
    if (mode === 'manual' && choice) {
      this.mode = 'manual';
      this.manualChoice = choice;
    } else {
      this.mode = 'auto';
      this.manualChoice = null;
    }
    this.currentDriver = null; // Сброс, чтобы при следующем запросе выбрался новый
  }
}

// Экспортируем синглтон
export default new MessengerRouter();
