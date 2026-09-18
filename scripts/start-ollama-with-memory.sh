#!/bin/bash
# ============================================================
# START-OLLAMA-WITH-MEMORY.sh — Запуск Ollama с памятью проекта
# ============================================================

# 1. Останавливаем старый процесс
sudo killall ollama 2>/dev/null
pkill -f ollama 2>/dev/null
sleep 2

# 2. Загружаем память
echo "📚 Загрузка памяти проекта..."
/home/ta8_/Рабочий\ стол/Crucix/scripts/load-ai-memory.sh

# 3. Запускаем Ollama с CORS
echo "🚀 Запуск Ollama с памятью..."
OLLAMA_ORIGINS="*" ollama serve > /tmp/ollama.log 2>&1 &

# 4. Ждём запуска
sleep 5

# 5. Проверяем
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "✅ Ollama запущен с памятью!"
    echo "📁 Память загружена из: /home/ta8_/Рабочий стол/Crucix/AI_MEMORY/"
    echo "📄 Файл контекста: /tmp/ai_memory_context.txt"
else
    echo "❌ Ошибка запуска Ollama"
    cat /tmp/ollama.log | tail -10
fi
