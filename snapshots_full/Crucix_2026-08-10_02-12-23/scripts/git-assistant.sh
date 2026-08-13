#!/bin/bash
if [ -z "$1" ]; then
  echo "Использование:"
  echo "  ./scripts/git-assistant.sh status"
  echo "  ./scripts/git-assistant.sh commit 'Сообщение'"
  echo "  ./scripts/git-assistant.sh help"
  exit 1
fi

case "$1" in
  status)
    git status | ./scripts/ask-ai.sh "
    Проанализируй вывод git status и скажи, что изменилось.
    Что нужно закоммитить? Какие файлы лучше не коммитить?
    "
    ;;
  commit)
    MESSAGE="$2"
    if [ -z "$MESSAGE" ]; then
      echo "❌ Нужно сообщение для коммита"
      exit 1
    fi
    ./scripts/ask-ai.sh "
    Создай понятное сообщение для коммита на основе изменений:
    $MESSAGE
    Дай готовый вариант.
    "
    ;;
  help)
    echo "Помощник по GIT:"
    echo "  ./scripts/git-assistant.sh status"
    echo "  ./scripts/git-assistant.sh commit 'Сообщение'"
    ;;
  *)
    echo "❌ Неизвестная команда"
    ;;
esac
