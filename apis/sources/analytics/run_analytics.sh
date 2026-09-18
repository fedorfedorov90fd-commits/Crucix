#!/bin/bash
# ============================================================
# Запуск аналитического движка Crucix
# ============================================================

echo "🧠 Запуск Crucix Analytics Engine..."

# Путь к скрипту
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Запуск
python3 analyzer.py

echo "✅ Анализ завершён!"
echo "📂 Результаты: /home/ta8_/Рабочий стол/Crucix/data/analytics/"
