# Air Quality Module

## 📋 Описание
**Русский:**
Модуль **Air Quality** отслеживает качество воздуха в реальном времени: концентрацию PM2.5, PM10, NO2, O3, SO2 и CO. Данные собираются с датчиков по всему миру через OpenAQ, EPA и местные станции мониторинга. Используется для экологического мониторинга, предупреждения о смоге и оценки влияния на здоровье.

**English:**
The **Air Quality** module monitors real-time air quality: PM2.5, PM10, NO2, O3, SO2 and CO concentrations. Data is collected from global sensors via OpenAQ, EPA and local monitoring stations. Used for environmental monitoring, smog warnings and health impact assessment.

## 🎯 Назначение
- Мониторинг загрязнения воздуха
- Предупреждение о превышении ПДК
- Интеграция с системами экологического контроля
- Анализ трендов качества воздуха

## 🚀 Использование
1. Страница: `/air-quality`
2. API: `/api/air-quality`
3. Параметры: `?city=Moscow&days=7`

## 📍 Местоположение
| Файл | Путь |
|------|------|
| Страница | `dashboard/public/air-quality.html` |
| API | `apis/sources/air-quality.mjs` |

**Статус:** 🟢 Активен
**Источники:** OpenAQ, EPA, IQAir
