/**
 * Crucix Server Configuration
 * Версия: v13.0
 * Порт, MIME-типы, настройки сервера
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const PORT = 3117;

export const STATIC_DIR = join(__dirname, '../dashboard/public');

export const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.xml': 'application/xml',
  '.yml': 'application/x-yaml',
  '.yaml': 'application/x-yaml',
  '.toml': 'application/toml',
  '.sh': 'text/x-shellscript',
};

export const MODULES_DIR = join(__dirname, '../apis/sources');
export const PAGES_DIR = join(__dirname, '../dashboard/public');
export const DATA_DIR = join(__dirname, '../data');
export const BASKET_DIR = join(__dirname, '../data/basket');
export const HELP_DIR = join(__dirname, '../data/help');

export const CORS_ORIGINS = ['*'];

export const API_PREFIX = '/api';

export const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];

export const MAX_REQUEST_SIZE = 1024 * 1024 * 10; // 10MB

export const TIMEOUT = 30000; // 30 секунд

export default {
  PORT,
  STATIC_DIR,
  MIME_TYPES,
  MODULES_DIR,
  PAGES_DIR,
  DATA_DIR,
  BASKET_DIR,
  HELP_DIR,
  CORS_ORIGINS,
  API_PREFIX,
  ALLOWED_METHODS,
  MAX_REQUEST_SIZE,
  TIMEOUT,
};
