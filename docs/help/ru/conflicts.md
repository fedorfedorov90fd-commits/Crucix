# Conflicts Module

## 📋 Описание
**Русский:**
Модуль **Conflicts** отслеживает вооружённые конфликты по всему миру: локации, стороны, интенсивность, жертвы, динамику. Интегрируется с ACLED, UCDP и другими базами данных конфликтов. Используется для геополитического анализа и оценки рисков.

**English:**
The **Conflicts** module tracks armed conflicts worldwide: locations, parties, intensity, casualties, dynamics. Integrates with ACLED, UCDP and other conflict databases. Used for geopolitical analysis and risk assessment.

## 🎯 Назначение
- Мониторинг конфликтов
- Анализ интенсивности
- Оценка гуманитарных рисков

## 🚀 Использование
1. Страница: `/conflicts`
2. API: `/api/conflicts`
3. Параметры: `?region=MiddleEast&year=2026`

## 📍 Местоположение
| Файл | Путь |
|------|------|
| Страница | `dashboard/public/conflicts.html` |
| API | `apis/sources/conflicts.mjs` |

**Статус:** 🟢 Активен
**Источники:** ACLED, UCDP
