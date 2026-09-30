#!/bin/bash
# copy-world-geojson-network.sh — Копирование countries.js для Network Map
# Network Map не использует world.geojson (нет Leaflet), но countries.js нужен для метаданных

PUBLIC_DIR="/home/ta8_/Рабочий стол/Crucix/dashboard/public"
SOURCE="${PUBLIC_DIR}/geo-map/js/countries.js"
TARGET="${PUBLIC_DIR}/network-map/js/countries.js"

if [ -f "$SOURCE" ]; then
    cp "$SOURCE" "$TARGET"
    echo "OK: countries.js <- $SOURCE"
else
    echo "WARN: countries.js не найден в geo-map, используется локальная копия"
fi

echo "=== Готово ==="
