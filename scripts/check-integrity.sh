#!/bin/bash
echo "=== ПРОВЕРКА ЦЕЛОСТНОСТИ ПРОЕКТА ==="

REQUIRED_FILES=(
  "apis/sources/drivers/base.mjs"
  "apis/sources/drivers/telegram-driver.mjs"
  "apis/sources/router.mjs"
  "apis/sources/ai-filter.mjs"
  "scripts/collect-feeds.mjs"
  "scripts/daily-report.mjs"
  "scripts/clean-old.mjs"
  "scripts/coordinator.mjs"
  "PROJECT/STATE.txt"
  "PROJECT/ARCHITECTURE.txt"
  "PROJECT/ROADMAP.txt"
  "PROJECT/STATUS_REPORT.txt"
  "AI_MEMORY/01_PROJECT_OVERVIEW.txt"
)

MISSING=0
for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "/home/ta8_/Рабочий стол/Crucix/$file" ]; then
    echo "❌ Отсутствует: $file"
    MISSING=1
  fi
done

if [ $MISSING -eq 0 ]; then
  echo "✅ Все обязательные файлы на месте"
else
  echo "⚠️ Есть пропущенные файлы"
fi
