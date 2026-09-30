#!/bin/bash
# copy-world-geojson-forecast.sh
# Копирует world.geojson и countries.js в forecast-map/
# Размещение: dashboard/public/copy-world-geojson-forecast.sh

set -e

PUB="/home/ta8_/Рабочий стол/Crucix/dashboard/public"
DEST="$PUB/forecast-map"

# Создаём папки
mkdir -p "$DEST/data" "$DEST/js"

# 1. world.geojson — ищем в возможных местах
GEO_FOUND=""
for candidate in \
    "$PUB/world.geojson" \
    "$PUB/geo-map/data/world.geojson" \
    "$PUB/geo-map/world.geojson" \
    "$PUB/event-map/data/world.geojson" \
    "$PUB/metrics-map/data/world.geojson"; do
    if [ -f "$candidate" ]; then
        GEO_FOUND="$candidate"
        break
    fi
done

if [ -n "$GEO_FOUND" ]; then
    cp "$GEO_FOUND" "$DEST/data/world.geojson"
    echo "OK: world.geojson <- $GEO_FOUND"
else
    echo "WARN: world.geojson не найден ни в одном из ожидаемых мест"
    echo "      Положите его вручную в $DEST/data/world.geojson"
fi

# 2. countries.js — ищем в geo-map/js/
COUNTRIES_FOUND=""
for candidate in \
    "$PUB/geo-map/js/countries.js" \
    "$PUB/event-map/js/countries.js"; do
    if [ -f "$candidate" ]; then
        COUNTRIES_FOUND="$candidate"
        break
    fi
done

if [ -n "$COUNTRIES_FOUND" ]; then
    cp "$COUNTRIES_FOUND" "$DEST/js/countries.js"
    echo "OK: countries.js <- $COUNTRIES_FOUND"
else
    echo "WARN: countries.js не найден"
    echo "      Положите его вручную в $DEST/js/countries.js"
fi

echo "=== Готово ==="
