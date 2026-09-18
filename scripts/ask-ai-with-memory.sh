#!/bin/bash
# ============================================================
# ASK-AI-WITH-MEMORY.sh — Задать вопрос ИИ с памятью проекта
# ============================================================

QUESTION="${1:-Что такое Crucix?}"
MEMORY_FILE="/tmp/ai_memory_context.txt"

# Если файла памяти нет — загружаем
if [ ! -f "$MEMORY_FILE" ]; then
    echo "📚 Загрузка памяти..."
    /home/ta8_/Рабочий\ стол/Crucix/scripts/load-ai-memory.sh
fi

# Читаем память (первые 15000 символов)
MEMORY=$(head -c 15000 "$MEMORY_FILE" | sed 's/"/\\"/g' | tr '\n' ' ')

# Формируем промпт
PROMPT="Ты — эксперт по проекту Crucix. Используй информацию из памяти проекта.

ПАМЯТЬ ПРОЕКТА:
$MEMORY

ВОПРОС: $QUESTION

ОТВЕТЬ КРАТКО, НО КОНКРЕТНО, НА РУССКОМ ЯЗЫКЕ."

# Отправляем запрос в Ollama
curl -s http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"deepseek-r1:1.5b\",
    \"prompt\": \"$PROMPT\",
    \"stream\": false,
    \"options\": {
      \"num_predict\": 500,
      \"temperature\": 0.3
    }
  }" | jq -r '.response // .error'
