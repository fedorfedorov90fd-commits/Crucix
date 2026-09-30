#!/bin/bash

echo "=== ТЕСТИРОВАНИЕ ВЕРСИЙ GEO-MAP.HTML ==="
echo ""

VERSIONS_DIR="/home/ta8_/Рабочий стол/Crucix/dashboard/geo-versions"
TARGET="/home/ta8_/Рабочий стол/Crucix/dashboard/public/geo-map.html"

# Сортируем версии по дате (от старых к новым)
for version in $(ls -1 "$VERSIONS_DIR"/*.html 2>/dev/null | sort); do
    name=$(basename "$version")
    size=$(stat -c%s "$version" 2>/dev/null || echo 0)
    date=$(stat -c%y "$version" 2>/dev/null | cut -d. -f1)
    
    echo "────────────────────────────────────────────────────────────"
    echo "📄 Тестируем: $name"
    echo "   Размер: $size байт"
    echo "   Дата: $date"
    echo ""
    
    # Копируем версию
    cp "$version" "$TARGET"
    
    echo "✅ geo-map.html заменён на $name"
    echo ""
    echo "🔄 Перезапустите сервер и проверьте карту:"
    echo "   cd /home/ta8_/Рабочий стол/Crucix && node server.mjs"
    echo "   http://localhost:3117/geo-map"
    echo ""
    echo "────────────────────────────────────────────────────────────"
    echo ""
    
    # Ждём подтверждения от пользователя
    read -p "Нажмите ENTER, чтобы перейти к следующей версии, или Ctrl+C для выхода..."
done

echo "✅ Все версии протестированы!"
