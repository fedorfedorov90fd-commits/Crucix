# 08. Telegram-коллектор

[← Назад к INDEX](./INDEX.md)

## Расположение

/home/ta8_/Рабочий стол/Crucix/scripts/collectors/lib/telegram-collector.mjs

## Назначение

Чтение публичных Telegram-каналов через веб-превью t.me/s/<channel> без API-ключей и токенов.

## Класс

TelegramCollector extends BaseCollector

## Алгоритм

1. HTTP-запрос к https://t.me/s/<channel>
2. Поиск блоков сообщений по атрибуту data-post
3. Извлечение текста из tgme_widget_message_text
4. Извлечение времени из time datetime
5. Возврат массива событий

## Формат события

- id — хеш от идентификатора поста
- source — telegram:канал
- published_at — ISO-дата
- title — первые 120 символов
- body — до 5000 символов
- url — ссылка на пост

## Ограничения

- Работает только с публичными каналами
- Приватные каналы недоступны

## Связи

- Наследует: 06-base-collector.md
- Используется: 05-local-engine.md
