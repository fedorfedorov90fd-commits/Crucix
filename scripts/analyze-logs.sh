#!/bin/bash
LOG_FILE="logs/$(ls -t logs/ 2>/dev/null | head -1)"

if [ -z "$LOG_FILE" ]; then
  echo "❌ Нет логов"
  exit 1
fi

echo "📊 Анализ лога: $LOG_FILE"

tail -100 "$LOG_FILE" | ./scripts/ask-ai.sh "
Проанализируй эти логи и найди:
1. Ошибки
2. Предупреждения
3. Проблемы с производительностью
4. Что нужно исправить
"
