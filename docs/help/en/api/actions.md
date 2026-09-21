# actions

## Description
Crucix actions layer. Turns the dashboard into an operating system: shows and acts. Registers action types, executes them, keeps audit.

## Three action categories
- notification - sending notifications (alert, digest, escalation)
- document - document generation (report, summary)
- state - state changes (watchlist, tag, favorite)

## Files
- apis/actions/_registry.mjs - actions registry
- apis/actions/action-alert.mjs - sending alerts
- apis/actions/action-report.mjs - report generation
- apis/actions/action-watchlist.mjs - watchlist CRUD
- apis/actions/action-api.mjs - HTTP handler

## Endpoints
All under /api/services/actions (Service module, multi-method GET+POST).

- GET  /api/services/actions - root (endpoints list + stats)
- GET  /api/services/actions/list - actions list (?category=notification)
- GET  /api/services/actions/stats - registry stats
- GET  /api/services/actions/categories - categories
- GET  /api/services/actions/actions/:id - action definition
- POST /api/services/actions/execute/:id - execute (body: args)
- POST /api/services/actions/execute - execute (body: {actionId, args})
- POST /api/services/actions/watchlist/add - add to watchlist
- POST /api/services/actions/watchlist/remove - remove
- GET  /api/services/actions/watchlist - list (?priority=&tag=&limit=)
- GET  /api/services/actions/watchlist/stats - stats
- POST /api/services/actions/report - generate report
- POST /api/services/actions/alert - send alert

## Actions
1. send_alert - send alert (channels: log, slack, webhook, email)
   Args: title (required), message, severity (info/warning/critical),
   source, channels[], dedupMinutes (default 15), webhookUrl
2. generate_report - generate report
   Args: title, period, format (markdown/json/csv/html), categories[], sections[], saveToFile
3. watchlist_add - add to watchlist
   Args: key (required), reason, priority (low/normal/high/urgent), tags[]
4. watchlist_remove - remove by key
5. watchlist_update - update entry
6. watchlist_list - list with filters

## Storage
- data/persist/actions/alert-state.json - dedup state
- data/persist/actions/watchlist.json - watchlist
- data/reports/ - generated reports

## Deduplication
Each alert has a key (severity::source::title). By default the same alert is not sent more than once per 15 minutes. Configurable via dedupMinutes.

## Strategic purpose
A dashboard shows. The actions layer executes. Without it the system is a BI panel. With it - an operating system.
