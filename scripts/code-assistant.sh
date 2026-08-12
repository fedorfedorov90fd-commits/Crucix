#!/bin/bash
if [ -z "$1" ]; then
  echo "Использование: ./scripts/code-assistant.sh 'Что нужно написать?'"
  exit 1
fi

./scripts/ask-ai.sh "Ты — опытный разработчик Node.js. Помоги написать код для Crucix.

Задача: $1

Дай готовый код с комментариями на русском языке. Учти архитектуру Crucix."
