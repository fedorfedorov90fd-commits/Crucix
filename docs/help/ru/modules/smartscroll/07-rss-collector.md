# 07. RSS-коллектор

[← Назад к INDEX](./INDEX.md)

## Расположение

/home/ta8_/Рабочий стол/Crucix/scripts/collectors/lib/rss-collector.mjs

## Назначение

Парсинг RSS 2.0 и Atom без внешних зависимостей.

## Класс

RSSCollector extends BaseCollector

## Алгоритм

1. HTTP-запрос к RSS-фиду с заголовком User-Agent
2. Удаление комментариев
3. Поиск элементов item (RSS 2.0) или entry (Atom)
4. Извлечение полей: title, link, description, pubDate
5. Очистка CDATA и HTML-сущностей
6. Возврат массива событий

## Формат события

- id — хеш от ссылки
- source — rss:имя
- published_at — ISO-дата
- title, body, url, category

## Ограничения

- Тело события обрезается до 5000 символов
- Парсер основан на регулярных выражениях

## Связи

- Наследует: 06-base-collector.md
- Используется: 05-local-engine.md
