#!/bin/bash
# scripts/load-context.sh — Загрузка всего контекста в Ollama

PROJECT_DIR="/home/ta8_/Рабочий стол/Crucix/PROJECT (копия)"
CONTEXT_FILE="/tmp/crucix_full_context.txt"

echo "📁 Сбор всех файлов из PROJECT (копия)/..."

# Очищаем старый контекст
> "$CONTEXT_FILE"

echo "=== CRUCIX — ПОЛНЫЙ КОНТЕКСТ ПРОЕКТА ===" >> "$CONTEXT_FILE"
echo "Собрано: $(date)" >> "$CONTEXT_FILE"
echo "" >> "$CONTEXT_FILE"

# Собираем все .txt файлы
for file in "$PROJECT_DIR"/*.txt; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        echo "" >> "$CONTEXT_FILE"
        echo "========================================" >> "$CONTEXT_FILE"
        echo "ФАЙЛ: $filename" >> "$CONTEXT_FILE"
        echo "========================================" >> "$CONTEXT_FILE"
        cat "$file" >> "$CONTEXT_FILE"
    fi
done

echo "✅ Контекст создан: $CONTEXT_FILE"
echo "📊 Размер: $(wc -c < "$CONTEXT_FILE") байт"
echo "📄 Строк: $(wc -l < "$CONTEXT_FILE")"

echo ""
echo "💡 Чтобы задать вопрос с контекстом:"
echo "   cat $CONTEXT_FILE | head -c 12000 | xargs -0 ollama run deepseek-r1:1.5b \"Вопрос\""
