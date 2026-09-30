# Inflation Module

## 📋 Описание
**Русский:**
Модуль **Inflation** отслеживает инфляционные индикаторы: CPI, PPI, Core Inflation, дефляторы по странам. Показывает динамику цен, инфляционные ожидания и влияние на монетарную политику. Данные от национальных статистических служб и МВФ.

**English:**
The **Inflation** module tracks inflation indicators: CPI, PPI, Core Inflation, deflators by country. Shows price dynamics, inflation expectations and monetary policy impact. Data from national statistical services and IMF.

## 🎯 Назначение
- Мониторинг цен
- Оценка монетарной политики
- Прогнозирование инфляции

## 🚀 Использование
1. Страница: `/inflation`
2. API: `/api/inflation`
3. Параметры: `?country=US&type=CPI`

## 📍 Местоположение
| Файл | Путь |
|------|------|
| Страница | `dashboard/public/inflation.html` |
| API | `apis/sources/inflation.mjs` |

**Статус:** 🟢 Активен
**Источники:** BLS, Eurostat, IMF
