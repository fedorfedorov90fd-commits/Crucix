# Gateway Module

## 📋 Описание
**Русский:**
Модуль **Gateway** является единой точкой входа для всех API-запросов к Crucix. Обеспечивает маршрутизацию, аутентификацию, кэширование, лимитирование и логирование. Интегрируется с внутренними и внешними API.

**English:**
The **Gateway** module is the single entry point for all API requests to Crucix. Provides routing, authentication, caching, rate limiting and logging. Integrates with internal and external APIs.

## 🎯 Назначение
- Маршрутизация запросов
- Аутентификация и авторизация
- Управление трафиком

## 🚀 Использование
1. Страница: `/gateway`
2. API: `/api/gateway`
3. Параметры: `?route=/api/layers&method=GET`

## 📍 Местоположение
| Файл | Путь |
|------|------|
| Страница | `dashboard/public/gateway.html` |
| API | `apis/sources/gateway.mjs` |

**Статус:** 🟢 Активен
