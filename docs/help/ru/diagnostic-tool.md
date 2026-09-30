# Diagnostic Tool Module

## 📋 Описание
**Русский:**
Модуль **Diagnostic Tool** предоставляет инструменты для диагностики системы Crucix: проверка API-эндпоинтов, статус сборщиков, доступность источников данных, задержки и ошибки. Используется для мониторинга здоровья системы.

**English:**
The **Diagnostic Tool** module provides tools for diagnosing the Crucix system: API endpoint testing, collector status, data source availability, latencies and errors. Used for system health monitoring.

## 🎯 Назначение
- Проверка API-эндпоинтов
- Мониторинг сборщиков
- Выявление проблем

## 🚀 Использование
1. Страница: `/diagnostic-tool`
2. API: `/api/diagnostic-tool`
3. Параметры: `?check=all`

## 📍 Местоположение
| Файл | Путь |
|------|------|
| Страница | `dashboard/public/diagnostic-tool.html` |
| API | `apis/sources/diagnostic-tool.mjs` |

**Статус:** 🟢 Активен
**Источники:** Внутренние метрики Crucix
