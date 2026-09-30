#!/bin/bash
# patch-layers.sh — удаляет override v1.3 из layers.js
set -e

DIR="/home/ta8_/Рабочий стол/Crucix/dashboard/public/metrics-map/js"
FILE="$DIR/layers.js"

if [ ! -f "$FILE" ]; then
    echo "ОШИБКА: $FILE не найден"
    exit 1
fi

# Бэкап
cp "$FILE" "$FILE.bak"
echo "Бэкап: $FILE.bak"

# 1. Удалить override (от строки с v1.3 или ENABLE-ALL-OVERRIDE до конца)
python3 -c "
with open('$FILE', 'r') as f:
    content = f.read()

idx = content.find('// ПАТЧ v1.3')
if idx == -1:
    idx = content.find('// ENABLE-ALL-OVERRIDE')
if idx == -1:
    print('Патч не найден — пропускаем')
else:
    content = content[:idx].rstrip() + '\n'
    print('Override удалён')

content = content.replace('interceptLoad(layerId, activeLayers)', 'interceptLoad(layerId)')
content = content.replace("getElementById('active-count')", "getElementById('active-layers-count')")
content = content.replace('getElementById("active-count")', 'getElementById("active-layers-count")')

with open('$FILE', 'w') as f:
    f.write(content)
"

echo ""
echo "=== Проверка ==="
echo "v1.3 вхождений: $(grep -c 'v1.3' "$FILE" || true) (ожидание: 0)"
echo "activeLayers в вызове interceptLoad: $(grep 'interceptLoad(layerId,' "$FILE" | wc -l) (ожидание: 0)"
echo ""
echo "✅ patch-layers.sh завершён"
