#!/bin/bash
if [ -z "$1" ]; then
  echo "Использование: ./scripts/generate-module.sh ИмяМодуля"
  exit 1
fi

MODULE_NAME="$1"
MODULE_PATH="apis/sources/$MODULE_NAME.mjs"

./scripts/ask-ai.sh "
Создай шаблон для нового модуля Crucix.

Имя модуля: $MODULE_NAME
Путь: $MODULE_PATH

Шаблон должен содержать:
1. Описание модуля (что делает)
2. Экспорт функции fetch()
3. Экспорт функции checkAvailability()
4. Экспорт getDriverName()
5. Обработку ошибок
6. Логирование с префиксом [Модуль]

Учти архитектуру Crucix.
"
