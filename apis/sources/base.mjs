/**
 * Base Module for Crucix API
 * Базовый класс, от которого наследуются все API-модули
 *
 * Расположение: /home/ta8_/Рабочий стол/Crucix/apis/sources/base.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Базовый класс API-модуля
 * Предоставляет общие методы для всех модулей Crucix
 */
export class BaseModule {
    /**
     * @param {Object} options - Параметры модуля
     * @param {string} options.name - Имя модуля
     * @param {string} options.version - Версия модуля
     * @param {Object} options.config - Конфигурация модуля
     */
    constructor(options = {}) {
        this.name = options.name || 'base-module';
        this.version = options.version || '1.0.0';
        this.config = options.config || {};
        this.cache = new Map();
        this.logs = [];
        this.startTime = Date.now();

        // Пути
        this.rootDir = path.resolve(__dirname, '../../');
        this.dataDir = path.join(this.rootDir, 'data');
        this.basketDir = path.join(this.dataDir, 'basket');
        this.logsDir = path.join(this.rootDir, 'logs');

        // Создаём необходимые директории
        this._ensureDirectories();

        console.log(`[${this.name}] Модуль инициализирован v${this.version}`);
    }

    /**
     * Создать необходимые директории
     */
    _ensureDirectories() {
        const dirs = [this.dataDir, this.basketDir, this.logsDir];
        for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }
    }

    /**
     * Основной обработчик запроса
     * @param {Object} req - HTTP запрос
     * @param {Object} res - HTTP ответ
     */
    async handleRequest(req, res) {
        try {
            const method = req.method || 'GET';
            const url = new URL(req.url, `http://${req.headers.host}`);
            const params = this._parseParams(url);

            // Логируем запрос
            this._log('info', `${method} ${url.pathname}`, { params });

            // Проверяем кеш для GET запросов
            if (method === 'GET' && this.config.cacheEnabled !== false) {
                const cached = this._getCache(url.pathname, params);
                if (cached) {
                    this._sendResponse(res, 200, cached);
                    return;
                }
            }

            // Обработка в дочернем классе
            const result = await this._handleRequest(method, url, params, req, res);

            // Кешируем результат для GET запросов
            if (method === 'GET' && this.config.cacheEnabled !== false) {
                this._setCache(url.pathname, params, result);
            }

            this._sendResponse(res, result.status || 200, result.data || { success: true });

        } catch (error) {
            this._log('error', `Ошибка обработки запроса: ${error.message}`, { stack: error.stack });
            this._sendResponse(res, 500, {
                success: false,
                error: error.message,
                module: this.name
            });
        }
    }

    /**
     * Метод для переопределения в дочерних классах
     */
    async _handleRequest(method, url, params, req, res) {
        return {
            status: 200,
            data: {
                success: true,
                message: `Module ${this.name} is running`,
                version: this.version,
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Парсинг параметров запроса
     */
    _parseParams(url) {
        const params = {};
        for (const [key, value] of url.searchParams.entries()) {
            params[key] = value;
        }
        return params;
    }

    /**
     * Отправка ответа
     */
    _sendResponse(res, status, data) {
        res.writeHead(status, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        res.end(JSON.stringify(data, null, 2));
    }

    /**
     * Кеширование
     */
    _getCache(pathname, params) {
        const key = this._cacheKey(pathname, params);
        if (this.cache.has(key)) {
            const entry = this.cache.get(key);
            if (Date.now() - entry.timestamp < (this.config.cacheTTL || 60000)) {
                return entry.data;
            }
            this.cache.delete(key);
        }
        return null;
    }

    _setCache(pathname, params, data) {
        const key = this._cacheKey(pathname, params);
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    _cacheKey(pathname, params) {
        const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
        const str = `${pathname}?${sorted}`;
        return crypto.createHash('md5').update(str).digest('hex');
    }

    /**
     * Логирование
     */
    _log(level, message, meta = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            module: this.name,
            level,
            message,
            ...meta
        };
        this.logs.push(entry);
        if (this.logs.length > 1000) {
            this.logs.shift();
        }

        // Запись в файл
        try {
            const logFile = path.join(this.logsDir, `${this.name}.log`);
            fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
        } catch (err) {
            // Игнорируем ошибки записи в лог
        }
    }

    /**
     * Получить состояние модуля
     */
    getStatus() {
        return {
            name: this.name,
            version: this.version,
            uptime: Math.round((Date.now() - this.startTime) / 1000),
            cacheSize: this.cache.size,
            logCount: this.logs.length,
            config: this.config,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Прочитать данные из корзины
     */
    _readBasket(type = 'all') {
        const basket = {};
        if (!fs.existsSync(this.basketDir)) {
            return basket;
        }

        const files = fs.readdirSync(this.basketDir);
        for (const file of files) {
            if (file.endsWith('.json')) {
                try {
                    const data = JSON.parse(fs.readFileSync(path.join(this.basketDir, file), 'utf8'));
                    const name = path.basename(file, '.json');
                    basket[name] = data;
                } catch (err) {
                    // Игнорируем ошибки чтения
                }
            }
        }
        return basket;
    }
}

/**
 * Фабрика для создания модулей
 */
export function createModule(name, config = {}) {
    class CustomModule extends BaseModule {
        constructor() {
            super({ name, version: config.version || '1.0.0', config });
        }

        async _handleRequest(method, url, params, req, res) {
            // Проверяем наличие кастомных обработчиков
            const action = params.action || 'default';

            if (this[`_handle_${action}`]) {
                return await this[`_handle_${action}`](params, req, res);
            }

            if (this[`_handle_${method.toLowerCase()}`]) {
                return await this[`_handle_${method.toLowerCase()}`](params, req, res);
            }

            return {
                status: 200,
                data: {
                    success: true,
                    module: name,
                    action: action,
                    message: `Handler for "${action}" not implemented`,
                    available: Object.keys(this)
                        .filter(k => k.startsWith('_handle_'))
                        .map(k => k.replace('_handle_', ''))
                }
            };
        }
    }

    return CustomModule;
}

/**
 * Утилиты для работы с файлами
 */
export const FileUtils = {
    readJSON(filePath) {
        if (!fs.existsSync(filePath)) return null;
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch {
            return null;
        }
    },

    writeJSON(filePath, data) {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    },

    readText(filePath) {
        if (!fs.existsSync(filePath)) return null;
        return fs.readFileSync(filePath, 'utf8');
    },

    writeText(filePath, content) {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, content);
    },

    exists(filePath) {
        return fs.existsSync(filePath);
    },

    list(dirPath, pattern = null) {
        if (!fs.existsSync(dirPath)) return [];
        const files = fs.readdirSync(dirPath);
        if (pattern) {
            return files.filter(f => f.match(pattern));
        }
        return files;
    }
};

export default BaseModule;
