# AIS Tracker Module

## 📋 Описание
**Русский:**
Модуль **AIS Tracker** отображает движение судов в реальном времени через систему Automatic Identification System (AIS). Показывает положение, курс, скорость, тип судна и порт назначения. Интегрируется с морскими картами и системами безопасности.

**English:**
The **AIS Tracker** module displays real-time vessel movement via the Automatic Identification System (AIS). Shows position, course, speed, vessel type and destination port. Integrates with maritime charts and security systems.

## 🎯 Назначение
- Отслеживание торговых судов
- Мониторинг рыболовного флота
- Обнаружение "тёмных" судов
- Анализ морских маршрутов

## 🚀 Использование
1. Страница: `/ais-tracker`
2. API: `/api/ais-tracker`
3. Параметры: `?lat=55.75&lon=37.62&radius=100`

## 📍 Местоположение
| Файл | Путь |
|------|------|
| Страница | `dashboard/public/ais-tracker.html` |
| API | `apis/sources/ais-tracker.mjs` |

**Статус:** 🟢 Активен
**Источники:** AIS, MarineTraffic, VesselFinder
