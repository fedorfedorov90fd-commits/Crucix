# Реестры Crucix

**Назначение.** Эта папка — единая точка истины о составе проекта Crucix: какие модули, сборщики, страницы, слои, basket-файлы и связи между ними существуют в проекте прямо сейчас. Реестры лежат **на диске**, не на сервере. Если сервер упал, страница `/registry` не открывается — реестры на диске остаются и читаются напрямую.

**Принцип.** Реестр — не рукописный список. Он **генерируется** из фактов файловой системы: скрипт обходит `apis/sources/`, `scripts/collectors/`, `dashboard/public/`, `data/basket/`, `data/schemas/`, `docs/help/` — и собирает актуальное состояние. Ручные правки — только там, где автоматика не может: битые связи, архитектурные решения, комментарии.

---

## Состав папки

| Файл | Кто создаёт | Назначение |
|------|-------------|------------|
| `registry-api.json` | вручную / устаревший | Старый реестр API-модулей. Заменяется живым `server/registry.generated.json`. |
| `registry-collectors.json` | вручную / устаревший | Старый реестр сборщиков. Требует пересборки. |
| `registry-pages.json` | вручную / устаревший | Старый реестр страниц. Требует пересборки. |
| `registry-layers.json` | вручную / устаревший | Старый реестр слоёв (15 записей). Требует пересборки. |
| `registry-descriptions.json` | `server/build-registry.mjs` | Описания компонентов (917 записей). |
| `registry-basket.json` | `server/build-registry.mjs` v3.3.0+ | Реестр корзины: все `data/basket/*.json` с колонками id/file/schema/has_meta/missing_meta_fields/series_len/readers/writers/status. |
| `registry-broken.json` | вручную | Реестр битых связей: API-модули, ссылающиеся на отсутствующие basket-файлы. |
| `registry-architecture.json` | вручную | Архитектурная карта: поток данных, динамические читатели basket, карта справок, порядок работы сессии. |
| `modules.json` | — | Скелет, 1 запись. Требует решения (заполнить или объединить с registry-api). |

---

## Шапка-паспорт

Каждый файл реестра обязан содержать в `meta`:

- `schema_version` — версия схемы (например, `crucix.registry.basket.v1`);
- `generated_by` — кто создал (скрипт или `manual (…, дата)`);
- `generated_at` — дата/время;
- `description` — краткое назначение;
- `help_ru_link` — ссылка на русскую справку;
- `help_en_link` — ссылка на английскую справку.

Это малый паспорт файла. Применяется ко всем документам проекта.

---

## Порядок работы сессии

### Начало сессии

Первая команда любой сессии:

    cd "/home/ta8_/Рабочий стол/Crucix" && node scripts/show-registry-summary.mjs

Выводит сводку: сколько API-модулей, сборщиков, страниц, basket-файлов, битых связей. AI получает контекст за одно сообщение — без сканирования проекта вручную.

Дополнительно прочитать:

1. `data/registry/registry-architecture.json` — карта потока данных.
2. `data/registry/registry-broken.json` — известные битые связи.
3. `server/registry.generated.json` (поле `meta`) — актуальная сводка.

### Конец сессии

Последняя команда сессии:

    cd "/home/ta8_/Рабочий стол/Crucix" && node scripts/rebuild-all-registries.mjs

Обходит проект, пересобирает реестры, пишет актуальные данные в `data/registry/`. Запускается **после каждой рабочей сессии** — чтобы следующая начиналась не с нуля.

---

## Что делать, если страница `/registry` отвалилась

1. Проверить, что `server/registry.generated.json` существует и не пустой:

       cd "/home/ta8_/Рабочий стол/Crucix" && node -e 'const d=JSON.parse(require("fs").readFileSync("server/registry.generated.json","utf8"));console.log(d.meta);'

2. Пересобрать реестр вручную:

       cd "/home/ta8_/Рабочий стол/Crucix" && node server/build-registry.mjs

3. Перезапустить сервер:

       cd "/home/ta8_/Рабочий стол/Crucix" && pkill -f "node server.mjs"; sleep 2; node server.mjs > /tmp/crucix-server.log 2>&1 &

4. Если и после этого не открывается — читать реестры **напрямую с диска**: `data/registry/registry-basket.json`, `data/registry/registry-broken.json`. Файлы не зависят от сервера.

---

## Что делать при добавлении нового модуля / сборщика / страницы

Правило №29 RULES.txt (порядок создания модуля):

1. Справка на двух языках — первой:
   - `docs/help/ru/<категория>/<id>.md`
   - `docs/help/en/<категория>/<id>.md`
2. Сборщик (если источник внешний): `scripts/collectors/collect-<id>.mjs`
3. API-модуль: `apis/sources/<id>-api.mjs`
4. Страница: `dashboard/public/<id>.html`
5. Подключение в `server.mjs` **одним блоком** (импорт, обработчик, страница, маршрут API).
6. Проверка синтаксиса: `cd "/home/ta8_/Рабочий стол/Crucix" && node --check server.mjs`
7. Запуск сборщика: `cd "/home/ta8_/Рабочий стол/Crucix" && node scripts/collectors/collect-<id>.mjs`
8. Запуск сервера: `cd "/home/ta8_/Рабочий стол/Crucix" && node server.mjs`
9. **Пересборка реестров:** `cd "/home/ta8_/Рабочий стол/Crucix" && node scripts/rebuild-all-registries.mjs`

---

## Реестр корзины (`registry-basket.json`)

**Колонки** каждой записи:

- `id` — идентификатор basket-файла (без `.json`);
- `file` — путь (`data/basket/<id>.json`);
- `schema` — из тела файла (`crucix.basket.v1` или `null`);
- `has_meta` — есть ли полный meta-блок (11 обязательных полей);
- `missing_meta_fields` — массив отсутствующих полей;
- `series_len` — длина `series` / `points` / `regions`;
- `readers` — массив API-модулей, читающих этот файл (статически);
- `writers` — массив сборщиков (из `meta.collector`);
- `status` — `active` (есть schema + полный meta) / `legacy` (schema есть, meta неполный) / `unknown` (нет schema);
- `help_ru_link` / `help_en_link` — ссылки на справку.

**Динамические читатели** (`join(BASKET_DIR, <переменная>)`) не видны статическому grep. Их список — в `registry-architecture.json` → `dynamic_basket_readers.modules` (18 модулей на 20.09.2026).

**Статистика на 20.09.2026:**

- всего файлов: 270;
- с полным meta: 114;
- без полного meta: 156;
- по статусу: `active` — 114, `legacy` — 0, `unknown` — 156.

---

## Связь с другими реестрами

- **`server/registry.generated.json`** — живой реестр, генерируется `server/build-registry.mjs` при старте сервера. Читается `server/router.mjs`, отдаётся по `/api/registry/*` (подпути: `/layers`, `/services`, `/summary`, `/modules`, `/module/:id`, `/health`, `/stats`; корень `/api/registry/` отдаёт 404 — это норма).
- **`data/registry/*.json`** — дисковые реестры. Не зависят от сервера.
- **Веб-страница `/registry`** — читает `/api/registry/*`, который читает `server/registry.generated.json`. Если нужна независимость от сервера — переключить на чтение `data/registry/*.json` напрямую (план, шаг 6, отложен).

---

## Правила, применимые к этой папке

- **RULES.txt №16** — корзина единственный источник данных.
- **RULES.txt №17** — логи сборщиков только в `logs/collectors/`.
- **RULES.txt №18** — сборщики только в `scripts/collectors/`.
- **RULES.txt №29** — порядок создания модуля (справка → сборщик → API → страница → подключение).
- **RULES.txt №40** — подготовительная папка `Crucix_GIT` для отправки в интернет.
- **RULES.txt №42** — фильтрация личных файлов (русские имена, скобки, цифры в начале) при инвентаризации.
- **Правило 20.09.2026** — шапка-паспорт в каждом реестре.
- **Правило 20.09.2026** — у каждой категории реестра свои колонки.
- **Правило 20.09.2026** — все команды с абсолютным `cd "/home/ta8_/Рабочий стол/Crucix"` в начало.

---

## Что ещё предстоит создать (план 6 шагов)

- **Шаг 4** — `scripts/show-registry-summary.mjs` (сводка в терминал для начала сессии) и `scripts/rebuild-all-registries.mjs` (пересборка всех реестров для конца сессии).
- **Шаг 5** — `server/build-registry.mjs` v3.3.1: расширенный сбор `readers` (паттерн `BASKET_DIR, '<id>'` + динамические), разделение warnings на категории (`basket_file_missing_static`, `basket_source_multi`, `basket_dynamic_reader`), разбор `meta.source` со знаком `+`.
- **Шаг 6 (отложен)** — правка `server/router.mjs` + `dashboard/public/registry.html`: читать `data/registry/*.json` с диска. Сейчас не критично, `/api/registry/*` работает.

---

**Создан:** 20.09.2026 (шаг 3 плана единого дискового реестра).
**Обновляется:** при добавлении новых реестров и изменении структуры папки.
