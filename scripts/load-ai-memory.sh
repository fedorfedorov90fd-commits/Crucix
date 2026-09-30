#!/bin/bash
# ============================================================
# LOAD-AI-MEMORY.sh — Загрузка памяти для локального ИИ
# ============================================================
# Собирает все файлы из AI_MEMORY/ и формирует системный промпт
# Используется при каждом запуске Ollama
# ============================================================

AI_MEMORY_DIR="/home/ta8_/Рабочий стол/Crucix/AI_MEMORY"
OUTPUT_FILE="/tmp/ai_memory_context.txt"

echo "=== ПАМЯТЬ CRUCIX ДЛЯ ЛОКАЛЬНОГО ИИ ===" > "$OUTPUT_FILE"
echo "Дата загрузки: $(date)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Собираем все .txt файлы в правильном порядке
for file in 00_RULES.txt \
             00_CRUCIX_CONTEXT.txt \
             01_PROJECT_OVERVIEW.txt \
             02_ARCHITECTURE.txt \
             03_ROADMAP.txt \
             06_STATE.txt \
             07_DECISIONS.txt \
             08_CODE_CHANGES.txt \
             09_STATUS_REPORT.txt \
             11_MODULES_COMPLETE.txt \
             12_OLLAMA_MEMORY.txt; do
    
    if [ -f "$AI_MEMORY_DIR/$file" ]; then
        echo "" >> "$OUTPUT_FILE"
        echo "=== $(basename $file .txt) ===" >> "$OUTPUT_FILE"
        cat "$AI_MEMORY_DIR/$file" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
    fi
done

# Ограничиваем размер (первые 50000 символов, чтобы не перегружать)
truncate -s 50000 "$OUTPUT_FILE"

echo "✅ Память загружена: $OUTPUT_FILE"
echo "📊 Размер: $(wc -c < $OUTPUT_FILE) байт"
echo "📄 Строк: $(wc -l < $OUTPUT_FILE)"
