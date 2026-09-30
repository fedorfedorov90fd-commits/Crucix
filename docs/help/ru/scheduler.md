# Scheduler Module

## 📋 Описание
**Русский:**
Модуль **Scheduler** управляет задачами по расписанию: запуск сборщиков, генерация отчётов, обновление данных, отправка уведомлений. Поддерживает cron-выражения, ручной запуск и приоритеты.

**English:**
The **Scheduler** module manages scheduled tasks: collector runs, report generation, data updates, notifications. Supports cron expressions, manual start and priorities.

## 🎯 Назначение
- Автоматизация задач
- Управление расписанием
- Мониторинг выполнения

## 🚀 Использование
1. Страница: `/scheduler`
2. API: `/api/scheduler`
3. Параметры: `?task=collector&schedule=0 */6 * * *`

## 📍 Местоположение
| Файл | Путь |
|------|------|
| Страница | `dashboard/public/scheduler.html` |
| API | `apis/sources/scheduler.mjs` |

**Статус:** 🟢 Активен
**Формат:** Cron, Interval
