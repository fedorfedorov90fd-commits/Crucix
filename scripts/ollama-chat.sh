#!/bin/bash
# scripts/ollama-chat.sh - Запуск Ollama с системным промптом

SYSTEM_PROMPT="/home/ta8_/Рабочий стол/Crucix/ollama-system-prompt.txt"
MODEL="deepseek-r1:1.5b"

if [ -z "$1" ]; then
    echo "Использование: ./scripts/ollama-chat.sh \"Ваш вопрос\""
    echo "Пример: ./scripts/ollama-chat.sh \"Что такое Crucix?\""
    exit 1
fi

if [ -f "$SYSTEM_PROMPT" ]; then
    ollama run "$MODEL" --system "$(cat "$SYSTEM_PROMPT")" "$1"
else
    echo "❌ Системный промпт не найден: $SYSTEM_PROMPT"
    exit 1
fi
