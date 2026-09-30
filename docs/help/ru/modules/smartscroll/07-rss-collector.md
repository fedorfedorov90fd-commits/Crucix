# 07. RSS-коллектор

[← Назад к INDEX](./INDEX.md)

## Расположение

/home/ta8_/Рабочий стол/Crucix/scripts/collectors/lib/rss-collector.mjs

## Назначение

Парсинг RSS 2.0 и Atom. Основной парсер — rss-parser (при наличии в node_modules), резервный — встроенный regex-парсер. Поддерживается детекция кодировки из XML declaration для корректной обработки источников в windows-1251 и koi8-r.

## Класс

RSSCollector extends BaseCollector

## Алгоритм

1. HTTP-запрос к RSS-фиду с заголовком User-Agent
2. Чтение ответа как ArrayBuffer — не text, для сохранения исходных байт до декодирования
3. Детекция кодировки через метод `_detectEncoding(buffer)`: парсинг XML declaration из первых 256 байт ответа
4. Декодирование через метод `_decodeBuffer(buffer)`: применение TextDecoder с определённой кодировкой
5. Попытка парсинга через rss-parser (если доступен в node_modules)
6. При отсутствии rss-parser или ошибке — fallback на встроенный regex-парсер
7. Поиск элементов item (RSS 2.0) или entry (Atom)
8. Извлечение полей: title, link, description, pubDate
9. Очистка CDATA и HTML-сущностей
10. Валидация даты: отбрасывание старше 10 лет и в будущем более чем на 24 часа
11. Возврат массива событий

## Методы

- `collect()` — основной метод сбора событий из фида
- `_getParser()` — динамический импорт rss-parser, кэширование результата
- `_detectEncoding(buffer)` — определение кодировки из XML declaration
- `_decodeBuffer(buffer)` — декодирование ArrayBuffer в строку
- `_fromParsed(parsed)` — преобразование результата rss-parser в формат событий
- `_parseXml(xml)` — regex-парсинг XML
- `_parseItem(itemXml)` — извлечение полей из отдельного item
- `_validateDate(dateStr)` — проверка даты (не старше 10 лет, не более 24 часов в будущем)
- `_cleanHtml(s)` — очистка HTML
- `_decodeHtml(s)` — декодирование HTML-сущностей

## Детекция кодировки

Метод `_detectEncoding` читает первые 256 байт ответа, извлекает значение атрибута encoding из XML declaration. Поддерживаемые кодировки:

- windows-1251 / cp1251 → windows-1251
- koi8-r / koi8r → koi8-r
- utf-8 / utf8 → utf-8
- При отсутствии encoding или неизвестной кодировке → utf-8

Это критично для российских источников (iz.ru, часть региональных фидов), которые отдают контент в windows-1251. Без детекции Node.js декодирует их через стандартный text() как UTF-8, что приводит к битым заголовкам.

## Интеграция rss-parser

Метод `_getParser` пытается динамически импортировать rss-parser из node_modules. При успехе создаётся экземпляр с настройками timeout. Результат кэшируется в `this._parser` — при повторных вызовах возвращается уже созданный экземпляр. Если rss-parser недоступен, `_getParser` возвращает false, и collect переходит на встроенный regex-парсер.

## Формат события

- id — хеш от ссылки
- source — rss:имя
- published_at — ISO-дата
- title, body, url, category

## Ограничения

- Тело события обрезается до 5000 символов
- Резервный парсер основан на регулярных выражениях
- Дата в будущем (более 24 часов) отбрасывается
- Дата старше 10 лет отбрасывается

## Связи

- Наследует: 06-base-collector.md
- Используется: 05-local-engine.md
