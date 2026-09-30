#!/bin/bash
# ============================================================
# CLEAN-ARCHIVE.SH — Перенос устаревших файлов в _archive/
# ============================================================
# Принцип: НИЧЕГО НЕ УДАЛЯТЬ. Только mv в _archive/.
# Правило №19: недоделанные модули не удаляются.
# Правило №40: удаление — только с разрешения пользователя.
# ============================================================

set -e
cd "/home/ta8_/Рабочий стол/Crucix/dashboard/public/metrics-map"

# Создаём структуру _archive/
mkdir -p _archive/_root _archive/js _archive/css _archive/other
mkdir -p _archive/_presets _archive/_v1 _archive/_v2 _archive/_v3
mkdir -p _archive/blocks _archive/templates
mkdir -p _archive/js_modules _archive/js_popup

MOVED=0

mv_to() {
    local src="$1"
    local dst="$2"
    if [ -e "$src" ]; then
        mv "$src" "$dst"
        echo "→ $src → $dst"
        MOVED=$((MOVED+1))
    fi
}

echo "=== АРХИВАЦИЯ КОРНЯ ==="
mv_to "metrics-map-index.html" "_archive/_root/"
mv_to "geo-map.new" "_archive/_root/"
mv_to "README.en.txt" "_archive/_root/"
mv_to "README.ru.txt" "_archive/_root/"
mv_to "GEO-MAP_—_МАНИФЕСТ_СОСТОЯНИЯ.txt" "_archive/_root/"
mv_to "=.txt" "_archive/_root/"
mv_to "2-5 карт создание.txt" "_archive/_root/"
mv_to "world.geojson" "_archive/other/world.geojson.root"

echo ""
echo "=== АРХИВАЦИЯ JS ==="
for f in layers60.js "layers60 СЛОЁВ, 12 КАТЕГОРИЙ.js" "LAYERSCrucix.JS " \
         "LAYERSCrucix.JS" layers-dynamic.js country-boundaries.js \
         geo-map-core.js graph-view.js graph-panel.js preset-multi-map.js \
         relations.js map-ui.js metrics-map-config.js metrics-map-layers.js \
         metrics-map-orchestrator.js metrics-map-series-adapter.js \
         renderer.js logger.mjs news-markers.mjs popups.mjs; do
    mv_to "js/$f" "_archive/js/"
done

echo ""
echo "=== АРХИВАЦИЯ CSS ==="
for f in cii.css core.css geo-map.css header.css layers-panel.css \
         map.css responsive.css "layers-panel.css.backup_2026-08-29"; do
    mv_to "css/$f" "_archive/css/"
done

echo ""
echo "=== АРХИВАЦИЯ КАТАЛОГОВ ==="
[ -d js/modules ] && mv js/modules _archive/js_modules && echo "→ js/modules/" && MOVED=$((MOVED+1))
[ -d js/popup ] && mv js/popup _archive/js_popup && echo "→ js/popup/" && MOVED=$((MOVED+1))
[ -d blocks ] && mv blocks _archive/blocks && echo "→ blocks/" && MOVED=$((MOVED+1))
[ -d templates ] && mv templates _archive/templates && echo "→ templates/" && MOVED=$((MOVED+1))
[ -d пресеты ] && mv пресеты _archive/_presets && echo "→ пресеты/" && MOVED=$((MOVED+1))
[ -d 1 ] && mv 1 _archive/_v1 && echo "→ 1/" && MOVED=$((MOVED+1))
[ -d 2 ] && mv 2 _archive/_v2 && echo "→ 2/" && MOVED=$((MOVED+1))
[ -d 3 ] && mv 3 _archive/_v3 && echo "→ 3/" && MOVED=$((MOVED+1))

echo ""
echo "=== АРХИВАЦИЯ СКРИПТОВ ==="
for f in deploy-all-maps.sh copy-world-geojson.sh copy-world-geojson-semantic.sh \
         copy-world-geojson-forecast.sh copy-world-geojson-network.sh; do
    mv_to "$f" "_archive/other/"
done

echo ""
echo "=== АРХИВАЦИЯ ЗАВЕРШЕНА ==="
echo "Всего перемещено: $MOVED файлов/каталогов"
echo "Удаления не было — только перемещение в _archive/"
echo ""
echo "=== ТЕКУЩАЯ СТРУКТУРА ==="
find . -maxdepth 2 -type f \( -name "*.js" -o -name "*.html" -o -name "*.css" -o -name "*.json" -o -name "*.md" \) | grep -v "_archive\|backups" | sort
