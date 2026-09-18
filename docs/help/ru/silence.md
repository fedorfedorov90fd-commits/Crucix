# Silence Detector Module

## 📋 Описание
**Русский:**
Модуль **Silence Detector** отслеживает "тишину" — отсутствие информации по ключевым источникам. Обнаруживает информационные блокировки, цензуру, прекращение вещания. Используется для мониторинга информационной безопасности.

**English:**
The **Silence Detector** module tracks "silence" — absence of information from key sources. Detects information blockages, censorship, broadcast interruptions. Used for information security monitoring.

## 🎯 Назначение
- Обнаружение информационных блокировок
- Мониторинг цензуры
- Анализ доступности данных

## 🚀 Использование
1. Страница: `/silence`
2. API: `/api/silence`
3. Параметры: `?source=telegram&period=24h`

## 📍 Местоположение
| Файл | Путь |
|------|------|
| Страница | `dashboard/public/silence.html` |
| API | `apis/sources/silence.mjs` |

**Статус:** 🟢 Активен
