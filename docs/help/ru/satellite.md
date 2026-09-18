# Satellite Module

## 📋 Описание
**Русский:**
Модуль **Satellite** отображает спутниковые снимки и данные дистанционного зондирования Земли. Показывает ночные огни (VIIRS), тепловые аномалии, изменения поверхности, растительность. Интегрируется с NASA, ESA и коммерческими операторами.

**English:**
The **Satellite** module displays satellite imagery and Earth remote sensing data. Shows night lights (VIIRS), thermal anomalies, surface changes, vegetation. Integrates with NASA, ESA and commercial operators.

## 🎯 Назначение
- ДЗЗ мониторинг
- Анализ ночных огней
- Экологический мониторинг

## 🚀 Использование
1. Страница: `/satellite`
2. API: `/api/satellite`
3. Параметры: `?lat=55.75&lon=37.62&source=viirs`

## 📍 Местоположение
| Файл | Путь |
|------|------|
| Страница | `dashboard/public/satellite.html` |
| API | `apis/sources/satellite.mjs` |

**Статус:** 🟢 Активен
**Источники:** NASA, ESA, NOAA
