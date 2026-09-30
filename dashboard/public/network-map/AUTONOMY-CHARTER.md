# AUTONOMY CHARTER — Network Map

## Принцип: ПОЛНАЯ ИЗОЛЯЦИЯ (FULL_ISOLATION)

### R1: Все скрипты локальные
Ни один <script src> не ссылается на ../ — все пути js/...

### R2: Данные локальные
world.geojson не требуется (Network Map использует SVG graph, не Leaflet)
countries.js — локальная копия для метаданных узлов

### R3: Слои изолированы
layers.js содержит только 12 слоёв Network Map (не 195)

### R4: Изоляция сбоев
Сбой в network-map не влияет на event-map, metrics-map, semantic-map, forecast-map

### R5: Cross-map зависимости = 0
manifest.json: local_cross_map = 0

### R6: Чек-лист верификации
- grep '../' index.html | grep script → 0
- grep "id:" layers.js → 12
- fetch paths → all local
