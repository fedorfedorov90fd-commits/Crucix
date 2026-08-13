#!/bin/bash
# scripts/ollama-api-chat.sh - Запуск через API с системным промптом

SYSTEM_PROMPT="/home/ta8_/Рабочий стол/Crucix/ollama-system-prompt.txt"
MODEL="deepseek-r1:1.5b"

if [ -z "$1" ]; then
    echo "Использование: ./scripts/ollama-api-chat.sh \"Ваш вопрос\""
    exit 1
fi

if [ -f "$SYSTEM_PROMPT" ]; then
    SYSTEM_TEXT=$(cat "$SYSTEM_PROMPT" | sed 's/"/\\"/g' | tr '\n' ' ')
    curl -s http://localhost:11434/api/generate -d "{
        \"model\": \"$MODEL\",
        \"system\": \"$SYSTEM_TEXT\",
        \"prompt\": \"$1\",
        \"stream\": false
    }" | jq -r '.response' 2>/dev/null || curl -s http://localhost:11434/api/generate -d "{
        \"model\": \"$MODEL\",
        \"system\": \"$SYSTEM_TEXT\",
        \"prompt\": \"$1\",
        \"stream\": false
    }"
else
    echo "❌ Системный промпт не найден: $SYSTEM_PROMPT"
    exit 1
fi
