#!/bin/bash
# Определяет, что изменилось в проекте

cd "/home/ta8_/Рабочий стол/Crucix"

echo "=== ИЗМЕНЕНИЯ В ПРОЕКТЕ ==="

# 1. Изменения в Git
echo "1. Изменения в Git:"
git status --porcelain 2>/dev/null | head -20 || echo "   Нет изменений"
echo ""

# 2. Последние коммиты
echo "2. Последние коммиты:"
git log --oneline -5 2>/dev/null || echo "   Нет коммитов"
echo ""

# 3. Новые файлы
echo "3. Новые файлы (за последний час):"
find . -type f -newermt "1 hour ago" ! -path "./node_modules/*" ! -path "./.git/*" ! -path "./backups/*" | head -20 || echo "   Нет новых файлов"
echo ""

# 4. Изменения в ключевых файлах
echo "4. Изменения в ключевых файлах:"
for file in PROJECT/STATE.txt PROJECT/ROADMAP.txt PROJECT/ARCHITECTURE.txt; do
  if [ -f "$file" ]; then
    echo "   $file: $(stat -c %y "$file" 2>/dev/null | cut -d. -f1)"
  fi
done
echo ""

# 5. Логи ошибок
echo "5. Ошибки в логах (последние 5):"
tail -10 logs/*.log 2>/dev/null | grep -i error | tail -5 || echo "   Нет ошибок"
