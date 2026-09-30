# Система справок Crucix

Документ: docs/help/README.md
Назначение: описать принципы, структуру и правила ведения справок в проекте Crucix.
Статус: действующий стандарт.

Зачем этот документ

Справка в Crucix — это не набор отдельных файлов, а система знаний проекта. Любая проблема находится через INDEX.md за не более трёх шагов. Если не находится — справка недоделана и требует переписать.

Пять принципов

1. Diataxis: четыре типа — четыре назначения. Каждая справка относится ровно к одному из четырёх типов по методологии Diataxis (diataxis.fr), используемой Django, Python, JetBrains, Hugging Face, Cloudflare: Tutorial (обучающий сценарий с нуля) в docs/help/tutorials/, How-to (как решить задачу) в docs/help/how-to/, Reference (точное описание модуля) в docs/help/reference/, Explanation (почему архитектура такая) в docs/help/explanation/. Запрещено смешивать.

2. Docs-as-Code. Вся документация — Markdown в docs/help/. Версионируется через Git.

3. ADR: журнал архитектурных решений. Каждое решение фиксируется в docs/help/explanation/decisions/ по формату ADR (Microsoft Azure Well-Architected). Принятая запись не редактируется. Изменилось решение — новая запись со статусом superseded by NNN.

4. INDEX: точка входа за три шага. docs/help/INDEX.md — центральный навигатор.

5. Синхронизация ru/en. Каждая справка существует в двух версиях: docs/help/ru/ и docs/help/en/. Одно имя файла. Обновление одновременно.

Структура каталогов

docs/help/ содержит: README.md (манифест), INDEX.md (навигатор), CONTRIBUTING.md (правила), _templates/ (шаблоны reference, how-to, adr), reference/ (collectors, apis, analyzers, contract), how-to/, explanation/decisions/ (ADR), tutorials/, ru/ (устаревшее, под миграцию), en/ (устаревшее, под миграцию).

Правило справки до кода

При создании модуля: (1) сначала справка в docs/help/reference/тип/id.md, (2) затем код модуля, (3) после обновить INDEX.md, (4) параллельно en-версия. Соответствует правилу 29 проекта и усиливается требованием Diataxis.

Связанные документы

INDEX.md — центральный навигатор.
CONTRIBUTING.md — правила создания справок.
explanation/decisions/001-two-pipelines.md — ADR-001.
