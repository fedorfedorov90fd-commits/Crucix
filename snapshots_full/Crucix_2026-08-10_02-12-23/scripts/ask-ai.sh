#!/bin/bash
# Быстрый вопрос к локальному ИИ с полным контекстом

# Загружаем всю память
CONTEXT=""
for file in /home/ta8_/Рабочий\ стол/Crucix/AI_MEMORY/*.txt; do
  CONTEXT="$CONTEXT
=== $(basename "$file") ===
$(cat "$file")
"
done

QUESTION="$1"

if [ -z "$QUESTION" ]; then
  echo "Использование: ./scripts/ask-ai.sh 'Твой вопрос'"
  echo ""
  echo "Пример: ./scripts/ask-ai.sh 'Какой модуль сейчас в разработке?'"
  exit 1
fi

ollama run deepseek-r1:7b "$CONTEXT

=== ВАЖНОЕ ПРАВИЛО ===
ОТВЕЧАЙ ТОЛЬКО НА РУССКОМ ЯЗЫКЕ. НЕ ИСПОЛЬЗУЙ АНГЛИЙСКИЕ СЛОВА. ПИШИ КРАТКО.

Вопрос: $QUESTION"
