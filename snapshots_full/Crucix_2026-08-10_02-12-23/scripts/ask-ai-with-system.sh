#!/bin/bash
# Задаёт вопрос локальному ИИ с учётом системной информации

SYSTEM_INFO=$(./scripts/system-info.sh)
QUESTION="$1"

if [ -z "$QUESTION" ]; then
  echo "Использование: ./scripts/ask-ai-with-system.sh 'Твой вопрос'"
  exit 1
fi

./scripts/ask-ai.sh "
Ты — локальный AI-помощник проекта Crucix.

Вот информация о системе, на которой ты работаешь:
$SYSTEM_INFO

Вопрос пользователя: $QUESTION

Ответь, учитывая возможности этой системы. Если что-то не хватает — предложи установить.
"
