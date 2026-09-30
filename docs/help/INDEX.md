# Crucix — Индекс справок

Документ: docs/help/INDEX.md
Назначение: центральная точка входа в систему справок Crucix.
Правило: любая тема находится за не более трёх шагов.

Быстрый поиск по проблеме

Сборщик не пишет в basket — reference/collectors/collector-helper.md
Basket обнуляется — reference/collectors/collect-rsshub.md
Как создать новый сборщик — how-to/add-collector.md
Два pipeline — почему — explanation/decisions/001-two-pipelines.md
Контракт v3 — правила — reference/contract/
SmartScroll — что это — reference/apis/smartscroll/
Как писать справку — CONTRIBUTING.md

Reference — точное описание модулей

Сборщики:
reference/collectors/collector-helper.md — утилита saveRaw, флаг backwardCompat
reference/collectors/collect-rsshub.md — RSS-сборщик, нарушающий контракт v3

API-модули, Анализаторы, Контракт v3 — структура готова, наполняется.

How-to — как сделать задачу

how-to/add-collector.md — создать новый сборщик.

Explanation — почему так

explanation/decisions/001-two-pipelines.md — два pipeline: SmartScroll и Contract-v3.

Tutorials — обучающие сценарии

Список пополняется.

Связанные документы вне docs/help

docs/architecture/rss-pipelines.md — архитектура двух pipeline.
RULES.txt — правила проекта.
ai-memory-sync/ — память проекта.
