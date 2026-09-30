# PMI Module

## 📋 Описание
**Русский:**
Модуль **PMI** отслеживает индексы деловой активности (PMI) по странам и секторам. Показывает Manufacturing PMI, Services PMI, Composite PMI. Используется для оценки экономической активности и прогнозирования ВВП.

**English:**
The **PMI** module tracks Purchasing Managers' Indices (PMI) by country and sector. Shows Manufacturing PMI, Services PMI, Composite PMI. Used for economic activity assessment and GDP forecasting.

## 🎯 Назначение
- Оценка деловой активности
- Прогнозирование ВВП
- Сравнение экономик

## 🚀 Использование
1. Страница: `/pmi`
2. API: `/api/pmi`
3. Параметры: `?country=US&sector=manufacturing`

## 📍 Местоположение
| Файл | Путь |
|------|------|
| Страница | `dashboard/public/pmi.html` |
| API | `apis/sources/pmi.mjs` |

**Статус:** 🟢 Активен
**Источники:** S&P Global, ISM, Markit
