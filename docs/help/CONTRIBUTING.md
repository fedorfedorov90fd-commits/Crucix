# Как писать справки в Crucix

Документ: docs/help/CONTRIBUTING.md
Назначение: правила создания справок.
Обязательно: прочитать перед созданием любой справки.

Шаг 1. Определить тип (Diataxis)

Вопрос 1: action или cognition? Action — Tutorial или How-to. Cognition — Reference или Explanation.
Вопрос 2: приобретает или применяет? Приобретает — Tutorial или Explanation. Применяет — How-to или Reference.

Матрица: Action+приобретает = Tutorial. Action+применяет = How-to. Cognition+приобретает = Explanation. Cognition+применяет = Reference.
Запрещено смешивать.

Шаг 2. Определить место

Tutorial — docs/help/tutorials/slug.md
How-to — docs/help/how-to/slug.md
Reference — docs/help/reference/категория/id.md
Explanation — docs/help/explanation/slug.md
ADR — docs/help/explanation/decisions/NNN-slug.md

Категории Reference: collectors, apis, analyzers, contract.

Шаг 3. Назвать файл

Только латиница, нижний регистр. Многословные через дефис. Запрещены скобки, знак равно, суффиксы _0, _1, _2. Одно имя для ru и en.
ADR: NNN-краткое-название.md.

Шаг 4. Использовать шаблон

Шаблоны в docs/help/_templates/. Запрещено создавать справку без шаблона.

Шаг 5. Связывать с другими

Обязательные связи: ссылка назад на INDEX.md, ссылки на смежные справки, ссылки на код. Правило 3 шагов.

Шаг 6. Синхронизировать ru/en

Каждая справка в двух версиях. Одно имя. Обновление одновременно.

Шаг 7. Обновить INDEX

После создания справки добавить ссылку в INDEX.md.

Чего НЕ делать

Запрещено: смешивать типы; создавать без шаблона; суффиксы _0/_1/_2; скобки; знак равно; ru без en; дубли имён; слова Изменения/Changelog/История в Reference; упоминать версии модуля в тексте.

Разрешено: дополнять существующие справки; создавать новые типы с обоснованием в ADR.

Правило при создании модуля

Справка пишется ДО кода. Порядок: (1) справка Reference ru, (2) справка Reference en, (3) обновить INDEX, (4) код модуля, (5) тесты, (6) обновить ADR.

Связанные документы

README.md — манифест.
INDEX.md — центральный навигатор.
Diataxis Framework (diataxis.fr) — оригинальный стандарт.
