# NOTAM Monitor Module

## 📋 Описание
**Русский:**
Модуль **NOTAM Monitor** отслеживает уведомления для авиации (NOTAM) — закрытие воздушного пространства, ограничения, опасные зоны. Используется для анализа авиационной безопасности, военной активности и влияния на авиаперевозки.

**English:**
The **NOTAM Monitor** module tracks aviation notices (NOTAM) — airspace closures, restrictions, hazard zones. Used for aviation safety analysis, military activity and impact on air travel.

## 🎯 Назначение
- Мониторинг воздушного пространства
- Анализ военной активности
- Безопасность авиации

## 🚀 Использование
1. Страница: `/notam-monitor`
2. API: `/api/notam-monitor`
3. Параметры: `?region=Europe&type=airspace`

## 📍 Местоположение
| Файл | Путь |
|------|------|
| Страница | `dashboard/public/notam-monitor.html` |
| API | `apis/sources/notam-monitor.mjs` |

**Статус:** 🟢 Активен
**Источник:** FAA, Eurocontrol
