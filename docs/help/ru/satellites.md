# Satellites Module

## 📋 Описание
**Русский:**
Модуль **Satellites** отслеживает спутниковые группировки: Starlink, GPS, ГЛОНАСС, Galileo, иридарий, военные спутники. Показывает количество, орбиты, запуски и назначение. Используется для анализа космической активности.

**English:**
The **Satellites** module tracks satellite constellations: Starlink, GPS, GLONASS, Galileo, Iridium, military satellites. Shows number, orbits, launches and purpose. Used for space activity analysis.

## 🎯 Назначение
- Мониторинг спутниковых группировок
- Космическая безопасность
- Анализ запусков

## 🚀 Использование
1. Страница: `/satellites`
2. API: `/api/satellites`
3. Параметры: `?constellation=Starlink&status=active`

## 📍 Местоположение
| Файл | Путь |
|------|------|
| Страница | `dashboard/public/satellites.html` |
| API | `apis/sources/satellites.mjs` |

**Статус:** 🟢 Активен
**Источники:** UCS, SpaceX, Celestrak
