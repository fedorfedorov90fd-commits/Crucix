# 06. Базовый класс коллектора

[← Назад к INDEX](./INDEX.md)

## Расположение

/home/ta8_/Рабочий стол/Crucix/scripts/collectors/lib/base-collector.mjs

## Назначение

Базовый класс для всех коллекторов SmartScroll.
Определяет общий контракт и вспомогательные методы.

## Класс

BaseCollector

## Методы

- collect() — абстрактный метод сбора. Наследники обязаны реализовать
- hashId(input) — генерация стабильного ID
- _fetch(url, opts) — HTTP-запрос с тайм-аутом через AbortController

## Поля

- url, channel, name, category, enabled, timeoutMs

## Наследники

- RSSCollector — 07-rss-collector.md
- TelegramCollector — 08-telegram-collector.md

## Расширение

Для добавления нового источника достаточно наследовать BaseCollector и реализовать collect().
