# Collector Monitor Module

## 📋 Описание
**Русский:**
Модуль **Collector Monitor** отображает статус всех сборщиков Crucix в реальном времени. Показывает состояние, ошибки, время последнего запуска и логи. Интегрируется с /api/collector-monitor и /api/collector/logs/{name}.

**English:**
The **Collector Monitor** module displays real-time status of all Crucix collectors. Shows state, errors, last run time and logs. Integrates with /api/collector-monitor and /api/collector/logs/{name}.

## 🎯 Назначение
- Мониторинг сборщиков
- Отображение ошибок
- Просмотр логов

## 🚀 Использование
1. Страница: `/collector-monitor`
2. API: `/api/collector-monitor`
3. Параметры: `?collector=all&status=error`

## 📍 Местоположение
| Файл | Путь |
|------|------|
| Страница | `dashboard/public/collector-monitor.html` |
| API | `apis/sources/collector-monitor.mjs` |

**Статус:** 🟢 Активен
**Источники:** Все сборщики Crucix
