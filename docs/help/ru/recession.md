# Recession Module

## 📋 Описание
**Русский:**
Модуль **Recession** отслеживает индикаторы рецессии: кривая доходности, PMI, потребительское доверие, производственные индексы. Прогнозирует вероятность рецессии по модели Sahm и другим алгоритмам. Используется для макроэкономического анализа.

**English:**
The **Recession** module tracks recession indicators: yield curve, PMI, consumer confidence, manufacturing indices. Forecasts recession probability using Sahm model and other algorithms. Used for macroeconomic analysis.

## 🎯 Назначение
- Прогнозирование рецессии
- Оценка экономического цикла
- Макроэкономический анализ

## 🚀 Использование
1. Страница: `/recession`
2. API: `/api/recession`
3. Параметры: `?country=US&model=sahm`

## 📍 Местоположение
| Файл | Путь |
|------|------|
| Страница | `dashboard/public/recession.html` |
| API | `apis/sources/recession.mjs` |

**Статус:** 🟢 Активен
**Модели:** Sahm, Yield Curve, PMI
