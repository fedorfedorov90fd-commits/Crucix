#!/bin/bash
./scripts/ask-ai.sh "
Проверь возможные конфликты между модулями Crucix.

Текущие модули:
- RSS-сборщик (collect-feeds.mjs)
- Telegram-драйвер (telegram-driver.mjs)
- AI-фильтр (ai-filter.mjs)
- Адаптивный шлюз (router.mjs)

Новый модуль (если есть): $1

Есть ли конфликты? Если да — какие? Как их избежать?
"
