# collect-infrastructure

## Источник
Локальный файл data/infrastructure/objects.json (114 объектов критической инфраструктуры).

## Периодичность
По требованию. Запуск вручную или в составе общего цикла сборщиков.

## Формат данных
Массив объектов:
{
  "id": "string",
  "name": "string",
  "type": "string",
  "country": "string",
  "lat": number,
  "lon": number,
  "severity": number,
  "timestamp": "ISO8601"
}

## Пример данных
[
  {
    "id": "mil-base-001",
    "name": "Пентагон",
    "type": "штаб",
    "country": "США",
    "lat": 38.8719,
    "lon": -77.0563,
    "severity": 0.5,
    "timestamp": "2026-09-18T00:00:00.000Z"
  }
]

## Запуск
node scripts/collectors/collect-infrastructure.mjs

## Результат
data/basket/infrastructure.json

## Лог
logs/collectors/collect-infrastructure.log
