# actions

## Описание
Слой действий Crucix. Превращает дашборд в операционную систему: показывает и действует. Регистрирует типы действий, выполняет их, ведёт audit.

## Три категории действий
- notification — отправка уведомлений (alert, digest, escalation)
- document — генерация документов (report, summary)
- state — изменение состояния (watchlist, tag, favorite)

## Файлы
- apis/actions/_registry.mjs — реестр типов действий
- apis/actions/action-alert.mjs — отправка алертов
- apis/actions/action-report.mjs — генерация отчётов
- apis/actions/action-watchlist.mjs — watchlist CRUD
- apis/actions/action-api.mjs — HTTP-обработчик

## Эндпоинты
Все под /api/services/actions (Service-модуль, мультиметодный GET+POST).

- GET  /api/services/actions — корень (список эндпоинтов + статистика)
- GET  /api/services/actions/list — список действий (?category=notification)
- GET  /api/services/actions/stats — статистика реестра
- GET  /api/services/actions/categories — категории
- GET  /api/services/actions/actions/:id — определение действия
- POST /api/services/actions/execute/:id — выполнить (body: args)
- POST /api/services/actions/execute — выполнить (body: {actionId, args})
- POST /api/services/actions/watchlist/add — добавить в watchlist
- POST /api/services/actions/watchlist/remove — удалить
- GET  /api/services/actions/watchlist — список (?priority=&tag=&limit=)
- GET  /api/services/actions/watchlist/stats — статистика
- POST /api/services/actions/report — сгенерировать отчёт
- POST /api/services/actions/alert — отправить алерт

## Действия
1. send_alert — отправка алерта (channels: log, slack, webhook, email)
   Аргументы: title (обязательный), message, severity (info/warning/critical),
   source, channels[], dedupMinutes (по умолчанию 15), webhookUrl
2. generate_report — генерация отчёта
   Аргументы: title, period, format (markdown/json/csv/html), categories[], sections[], saveToFile
3. watchlist_add — добавить в watchlist
   Аргументы: key (обязательный), reason, priority (low/normal/high/urgent), tags[]
4. watchlist_remove — удалить по ключу
5. watchlist_update — обновить запись
6. watchlist_list — список с фильтрами

## Хранение
- data/persist/actions/alert-state.json — состояние дедупликации
- data/persist/actions/watchlist.json — список наблюдения
- data/reports/ — сгенерированные отчёты

## Дедупликация
Каждый алерт имеет ключ (severity::source::title). По умолчанию один и тот же алерт не отправляется чаще, чем раз в 15 минут. Настраивается через dedupMinutes.

## Стратегическое назначение
Дашборд показывает. Слой действий исполняет. Без него система — BI-панель. С ним — операционная система.
