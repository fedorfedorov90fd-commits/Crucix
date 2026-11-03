# Миграция БД: 002_alternative_optics.sql

## Простое объяснение (для новичков)

Этот файл — инструкция для базы данных. Он создаёт две таблицы, в которых система будет хранить «улики»: кто молчал и кто синхронизировался.

**Что создаётся:**

1. **`information_gaps`** — журнал «молчания». Сюда записывается: какая тема, когда, как долго о ней молчали, какие источники проигнорировали.
2. **`coordinated_actions`** — журнал «сговоров». Сюда записывается: какие источники опубликовали новость одновременно, с какой силой (сколько раз), и какие детали (заголовок, разброс времени).

**Зачем это нужно:**

Без этих таблиц система работает «в моменте» — увидела аномалию, показала, забыла. С таблицами — сохраняется история. Через месяц можно поднять данные за прошлый месяц и сравнить: «тогда молчали об этом, а сейчас — об этом». Это основа для долгосрочного анализа.

**Как применить:**

Выполнить SQL-файл в базе `crucix` через `psql`:

psql -d crucix -f db/migrations/002_alternative_optics.sql
text


---

## Научная база (для специалистов)

Миграция расширяет схему БД двумя таблицами, хранящими результаты аналитических детекторов.

**`information_gaps`** — таблица для хранения аномалий «информационного молчания». Поля:

- `id` — SERIAL PRIMARY KEY.
- `topic` — TEXT, тема (например, `energy`, `cyber`).
- `gap_type` — TEXT, тип разрыва (`SILENCE`, `BURST`, `POLARIZATION`).
- `severity` — TEXT, уровень серьёзности (`LOW`, `MEDIUM`, `HIGH`).
- `detected_at` — TIMESTAMP, время обнаружения (по умолчанию `NOW()`).
- `source_list` — TEXT[], список источников, которые «молчали» или «синхронизировались».
- `duration` — INTERVAL, длительность разрыва (опционально).

**`coordinated_actions`** — таблица для хранения обнаруженных синхронных действий. Поля:

- `id` — SERIAL PRIMARY KEY.
- `event_cluster_id` — UUID, идентификатор кластера событий.
- `participating_sources` — TEXT[], массив источников, сделавших «залп».
- `coordination_score` — FLOAT, коэффициент координации (0.0–1.0).
- `detected_at` — TIMESTAMP, время обнаружения.
- `narrative_vector` — TEXT, хеш тональности (для последующего сравнения).

**Индексы:**

- `idx_gaps_topic` — по `topic` (ускоряет выборку по теме).
- `idx_coordinated_score` — по `coordination_score` (ускоряет сортировку по силе координации).

---

## Как работает (пошагово)

1. SQL-файл выполняется один раз при развёртывании.
2. Создаются две таблицы с полями и индексами.
3. Детекторы (`source-coordination-api.mjs`, `alert-dispatcher-api.mjs`) пишут в эти таблицы через `INSERT`.
4. Дашборды (`dashboard-coordination.html`, `dashboard-signals.html`) читают через `SELECT`.
5. Повторное выполнение миграции безопасно: используется `CREATE TABLE IF NOT EXISTS`.

---

## Пример использования

```sql
-- Найти все HIGH-разрывы за последние 24 часа
SELECT topic, gap_type, severity, detected_at
FROM information_gaps
WHERE severity = 'HIGH'
  AND detected_at > NOW() - INTERVAL '24 hours'
ORDER BY detected_at DESC;

-- Найти все синхронные события с силой > 5
SELECT event_cluster_id, participating_sources, coordination_score
FROM coordinated_actions
WHERE coordination_score > 5
ORDER BY coordination_score DESC;

Практические рекомендации

    CREATE TABLE IF NOT EXISTS — миграция идемпотентна, можно запускать повторно.

    source_list и participating_sources — массивы TEXT[], а не отдельные таблицы. Это упрощает чтение: один SELECT даёт полный список источников.

    duration — опциональное поле. Если оно не заполняется — не страшно, detected_at + gap_type дают достаточно информации.

    Индексы по topic и coordination_score — обязательны, иначе выборка по большим таблицам будет медленной.

    Полная очистка (DELETE FROM information_gaps) перед повторным INSERT — если детектор пересчитывает метрику «с нуля». Иначе копятся дубликаты.

    Порядок миграций: 002 применяется после 001 (базовая схема). Не перепутать.

Что было объединено

Эта справка покрывает функционал одного файла из песочницы:
Файл из песочницы	Куда влился	Что добавлено
db/migrations/002_alternative_optics.sql	db/migrations/002_alternative_optics.sql	Добавлены information_gaps, coordinated_actions

Дополнительно (в основном проекте): позже были созданы миграции 008_information_gaps_extend.sql, 009_topic_gaps.sql, 010_coordinated_actions_extend.sql, 011_framing_gaps.sql. Они расширяют эти таблицы новыми полями. Но базовая структура — здесь.
