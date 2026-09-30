# Collector Manager Module

## 📋 Описание
**Русский:**
Модуль **Collector Manager** управляет всеми сборщиками данных Crucix. Позволяет включать/отключать сборщики, управлять API-ключами, настраивать лимиты и мониторить их статус. Интегрируется с /api/collector-config.

**English:**
The **Collector Manager** module manages all Crucix data collectors. Allows enabling/disabling collectors, managing API keys, configuring limits and monitoring their status. Integrates with /api/collector-config.

## 🎯 Назначение
- Управление сборщиками
- Конфигурация источников
- Мониторинг статуса

## 🚀 Использование
1. Страница: `/collector-manager`
2. API: `/api/collector-config`
3. Параметры: `?collector=acled&action=toggle`

## 📍 Местоположение
| Файл | Путь |
|------|------|
| Страница | `dashboard/public/collector-manager.html` |
| API | `apis/sources/collector-manager.mjs` |

**Статус:** 🟢 Активен
**Источники:** Все сборщики Crucix
