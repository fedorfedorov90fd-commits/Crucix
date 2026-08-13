#!/bin/bash
cd "/home/ta8_/Рабочий стол/Crucix"

REPORT_FILE="reports/community_report_$(date +%Y-%m-%d).md"
mkdir -p reports

cat > "$REPORT_FILE" << 'REPORT_HEADER'
# Отчёт о разработке Crucix

Дата: $(date +%d.%m.%Y)

## Прогресс проекта

REPORT_HEADER

echo "### Текущее состояние" >> "$REPORT_FILE"
cat PROJECT/STATE.txt >> "$REPORT_FILE"

echo "" >> "$REPORT_FILE"
echo "### Последние изменения" >> "$REPORT_FILE"
cat PROJECT/CODE_CHANGES.txt >> "$REPORT_FILE"

echo "" >> "$REPORT_FILE"
echo "### Ближайшие планы" >> "$REPORT_FILE"
head -20 PROJECT/ROADMAP.txt >> "$REPORT_FILE"

echo "" >> "$REPORT_FILE"
echo "---" >> "$REPORT_FILE"
echo "Отчёт сгенерирован автоматически" >> "$REPORT_FILE"

echo "✅ Отчёт создан: $REPORT_FILE"
