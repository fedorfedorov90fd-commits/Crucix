#!/bin/bash
# Создаёт ПОЛНЫЙ снимок проекта (с node_modules и данными)

SNAPSHOT_DIR="/home/ta8_/Рабочий стол/Crucix/snapshots_full"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
MAX_SNAPSHOTS=6

mkdir -p "$SNAPSHOT_DIR"

echo "💾 СОЗДАНИЕ ПОЛНОГО СНИМКА ПРОЕКТА"
echo "==================================="

echo "1. Копирование проекта (полное)..."
cp -r "/home/ta8_/Рабочий стол/Crucix" "$SNAPSHOT_DIR/Crucix_$DATE"

echo "✅ Полный снимок создан: $SNAPSHOT_DIR/Crucix_$DATE"
echo "   Размер: $(du -sh "$SNAPSHOT_DIR/Crucix_$DATE" | cut -f1)"

# Ротация
echo "2. Ротация (храним $MAX_SNAPSHOTS полных снимков)..."
cd "$SNAPSHOT_DIR"
ls -t | tail -n +$((MAX_SNAPSHOTS + 1)) | xargs -r rm -rf

echo "✅ Готово"
echo ""
echo "📁 Текущие полные снимки:"
ls -la "$SNAPSHOT_DIR"
