# Crucix -> Neo4j Export

Экспорт Multi-Layer Causal Graph в Neo4j для визуализации.

## Установка

~~~bash
pip install neo4j
~~~

## Быстрый старт

~~~bash
# Запустить Neo4j (Docker)
docker run -d \
  --name crucix-neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  neo4j:5

# Экспорт
python scripts/neo4j_export.py --clear --analyze

# Или через env vars
NEO4J_URI=bolt://localhost:7687 \
NEO4J_USER=neo4j \
NEO4J_PASSWORD=password \
python scripts/neo4j_export.py
~~~

## Что экспортируется

Тип | Описание
-----|----------
:CrucixNode | Узлы из 4 слоёв (cyber/info/finance/physical)
:CrucixLayer | Мета-узлы слоёв
:CrucixNarrative | Нарративы (из unified narrative)
:CrucixScenario | Сценарии (из scenario generator)
:CAUSES | Рёбра с атрибутами strength, lagHours, crossLayer

## Полезные запросы

### Все узлы в слое

~~~cypher
MATCH (n:CrucixNode {layer: 'cyber'})
RETURN n
~~~

### Кросс-слойные связи

~~~cypher
MATCH (a:CrucixNode)-[r:CAUSES]->(b:CrucixNode)
WHERE r.crossLayer = true
RETURN a, r, b
ORDER BY r.strength DESC
~~~

### Пути распространения от кибератаки

~~~cypher
MATCH path = (a:CrucixNode {id:'cyberAttack'})-[:CAUSES*1..4]->(end)
RETURN path
~~~

### Влияние между слоями

~~~cypher
MATCH (a:CrucixNode)-[r:CAUSES]->(b:CrucixNode)
WHERE r.crossLayer = true
RETURN a.layer AS from_layer, b.layer AS to_layer,
       count(r) AS edges, avg(r.strength) AS avg_strength
ORDER BY edges DESC
~~~

### Узлы с высокой вероятностью

~~~cypher
MATCH (n:CrucixNode)
WHERE n.currentProb > 0.5
RETURN n.name, n.layer, n.currentProb
ORDER BY n.currentProb DESC
~~~

## Визуализация

Neo4j Browser автоматически подбирает layout. Для более наглядной визуализации:

- Установить плагин Neo4j Bloom — графовый интерфейс.
- Использовать APOC для кастомных визуализаций:

~~~cypher
CALL apoc.nlp.gcp.classify.graph(...)
~~~

## Интеграция с CI

~~~yaml
# .github/workflows/neo4j-export.yml
name: Nightly Neo4j Export

on:
  schedule:
    - cron: '0 3 * * *'
  workflow_dispatch:

jobs:
  export-neo4j:
    runs-on: ubuntu-latest
    services:
      neo4j:
        image: neo4j:5
        env:
          NEO4J_AUTH: neo4j/testpassword
        ports:
          - 7474:7474
          - 7687:7687
    steps:
      - uses: actions/checkout@v4
      - name: Export
        run: python scripts/neo4j_export.py --clear --analyze
~~~

## Troubleshooting

Connection refused: проверьте, что Neo4j запущен и Bolt порт 7687 доступен.

Auth failed: установите NEO4J_PASSWORD или сбросьте пароль в Neo4j.

Empty graph after import: проверьте runs/predictions/latest_forecast.json — если граф пустой, скрипт использует fallback-узлы из _get_default_nodes().
