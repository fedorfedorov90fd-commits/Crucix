# 04. Фабрика источника

[← Назад к INDEX](./INDEX.md)

## Расположение

/home/ta8_/Рабочий стол/Crucix/apis/sources/smartscroll-local/index.mjs

## Назначение

Точка входа для получения источника SmartScroll.
Возвращает внешний адаптер, локальный движок или авто-переключатель в зависимости от режима в конфигурации.

## Функция

createSmartScrollSource() — возвращает экземпляр источника:
- mode external — SmartScrollAdapter
- mode local — SmartScrollLocalEngine
- mode auto — AutoSwitchSource

## Класс AutoSwitchSource

Обёртка над двумя источниками с автоматическим переключением.

- Кулдаун после сбоя внешнего источника: 60 секунд
- При сбое внешнего — переключение на локальный
- healthCheck() возвращает состояние обоих источников

## Связи

- Импортирует: 03-external-adapter.md, 05-local-engine.md
- Читает конфигурацию: 01-config.md
- Используется: 16-event-ingestion.md
