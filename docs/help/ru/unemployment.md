# Unemployment Module

## 📋 Описание
**Русский:**
Модуль **Unemployment** отслеживает безработицу по странам: уровень, динамику, по возрастным группам и секторам. Интегрируется с BLS, Eurostat и национальными статистическими службами.

**English:**
The **Unemployment** module tracks unemployment by country: rate, dynamics, by age groups and sectors. Integrates with BLS, Eurostat and national statistical services.

## 🎯 Назначение
- Мониторинг рынка труда
- Оценка экономической активности
- Прогнозирование социальных рисков

## 🚀 Использование
1. Страница: `/unemployment`
2. API: `/api/unemployment`
3. Параметры: `?country=US&type=seasonal`

## 📍 Местоположение
| Файл | Путь |
|------|------|
| Страница | `dashboard/public/unemployment.html` |
| API | `apis/sources/unemployment.mjs` |

**Статус:** 🟢 Активен
**Источники:** BLS, Eurostat
