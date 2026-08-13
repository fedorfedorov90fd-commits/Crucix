#!/bin/bash
# Обновляет память локального ИИ из актуальных файлов проекта

echo "=== ОБНОВЛЕНИЕ ПАМЯТИ ЛОКАЛЬНОГО ИИ ==="

# Копируем актуальные файлы
cp PROJECT/STATE.txt AI_MEMORY/06_STATE.txt
cp PROJECT/ROADMAP.txt AI_MEMORY/03_ROADMAP.txt
cp PROJECT/ARCHITECTURE.txt AI_MEMORY/02_ARCHITECTURE.txt
cp PROJECT/DECISIONS.txt AI_MEMORY/07_DECISIONS.txt
cp PROJECT/CODE_CHANGES.txt AI_MEMORY/08_CODE_CHANGES.txt
cp PROJECT/STATUS_REPORT.txt AI_MEMORY/09_STATUS_REPORT.txt

echo "✅ Память локального ИИ обновлена!"
echo ""
echo "Теперь локальный ИИ знает:"
echo "  - Обзор проекта"
echo "  - Архитектуру"
echo "  - План 25 модулей"
echo "  - Состояние проекта"
echo "  - Решения"
echo "  - Изменения кода"
echo "  - Отчёт о состоянии"
