#!/bin/bash
if [ -z "$1" ]; then
  echo "Использование: ./scripts/review-code.sh путь/к/файлу.mjs"
  exit 1
fi

CODE=$(cat "$1")

./scripts/ask-ai.sh "
Ты — эксперт по Node.js. Проверь этот код на ошибки и дай рекомендации.

Код:
$CODE

Что нужно исправить?
Какие есть улучшения?
Соответствует ли код архитектуре Crucix?
"
