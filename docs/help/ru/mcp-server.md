# MCP-сервер Crucix — Инструкция

## Что такое MCP-сервер?

MCP-сервер (Model Context Protocol) — это интерфейс для подключения AI-агентов (Claude, Cursor, и другие) к данным Crucix. Он позволяет AI напрямую запрашивать аналитику, риски стран, рыночные данные и ранние предупреждения.

## Как это работает?

1. AI-агент отправляет запрос к MCP-серверу
2. Сервер обрабатывает запрос и возвращает данные из корзины Crucix
3. AI использует эти данные для анализа и ответа пользователю

## Где находится?

- Файл: `apis/sources/mcp-server.mjs`
- Эндпоинт: `http://localhost:3117/api/mcp/`
- Документация инструментов: `http://localhost:3117/api/mcp/tools`

---

## Доступные инструменты

### 1. `get_country_risk` — Риск страны
Получить уровень риска для любой страны.

**Параметры:**
| Параметр | Тип | Описание |
|----------|-----|----------|
| country | string | Название страны (на русском или английском) |

**Пример запроса:**
```json
{
  "tool": "get_country_risk",
  "arguments": { "country": "Россия" }
}
Пример ответа:

json
{
  "result": {
    "country": "Россия",
    "risk": "pre-war",
    "score": 78.5
  }
}
2. get_world_brief — Глобальная сводка
Получить краткую сводку по глобальной ситуации.

Параметры: нет

Пример запроса:

json
{
  "tool": "get_world_brief",
  "arguments": {}
}
Пример ответа:

json
{
  "result": {
    "timestamp": "2026-08-30T13:00:00Z",
    "status": "HIGH_ALERT",
    "critical_events": 3,
    "high_events": 8,
    "summary": "Обнаружено 3 критических и 8 высоких событий"
  }
}
3. get_market_data — Рыночные данные
Получить рыночные индикаторы (VIX, Gold/Oil, BDI и др.)

Параметры:

indicators	array	Список индикаторов (опционально)
Доступные индикаторы: vix, gold-oil-ratio, bdi, copper-gold, uranium, inflation, unemployment, pmi, recession, dxy, tips, ovx, hy-spread, consumer-confidence

Пример запроса:

json
{
  "tool": "get_market_data",
  "arguments": { "indicators": ["vix", "gold-oil-ratio", "bdi"] }
}
Пример ответа:

json
{
  "result": {
    "vix": 16.73,
    "gold-oil-ratio": 27.56,
    "bdi": 2070
  }
}
4. get_conflicts — Активные конфликты
Получить список активных конфликтов.

Параметры:

limit	number	Максимальное количество (по умолчанию 10)
Пример запроса:

json
{
  "tool": "get_conflicts",
  "arguments": { "limit": 5 }
}
Пример ответа:

json
{
  "result": [
    { "location": "Донбасс", "severity": "critical", "date": "2026-08-30" },
    { "location": "Газа", "severity": "critical", "date": "2026-08-30" },
    { "location": "Судан", "severity": "critical", "date": "2026-08-29" }
  ]
}
5. get_early_warnings — Ранние предупреждения
Получить все активные ранние предупреждения.

Параметры: нет

Пример запроса:

json
{
  "tool": "get_early_warnings",
  "arguments": {}
}
Пример ответа:

json
{
  "result": [
    {
      "region": "Ближний Восток",
      "severity": "critical",
      "reason": "Рост военной активности",
      "timestamp": "2026-08-30T10:00:00Z"
    }
  ]
}
Как подключить в Claude Desktop
Добавьте в claude_desktop_config.json:

json
{
  "mcpServers": {
    "crucix": {
      "url": "http://localhost:3117/api/mcp"
    }
  }
}
После этого Claude сможет использовать инструменты Crucix напрямую.

Как проверить работу
Проверить список инструментов:

bash
curl http://localhost:3117/api/mcp/tools | jq .
Проверить глобальную сводку:

bash
curl -X POST http://localhost:3117/api/mcp/call \
  -H "Content-Type: application/json" \
  -d '{"tool":"get_world_brief","arguments":{}}' | jq .
Требования
Сервер Crucix должен быть запущен на порту 3117

В корзине должны быть данные (файлы в data/basket/)

Для полноценной работы рекомендуется настроить сборщики

Связанные модули
/api/early-warning/ — система раннего предупреждения

/api/global-index/ — глобальный индекс напряжённости

/api/correlation/ — кросс-корреляционный анализатор

/dashboard-5in1 — центральный дашборд с индикаторами