#!/bin/bash
# ============================================================
# consolidate-forecast-map.sh
# Склеивает все текстовые файлы forecast-map в один .txt
# для отправки в чат
# ============================================================

BASE="/home/ta8_/Рабочий стол/Crucix/dashboard/public/forecast-map"
OUT="$BASE/ALL-FILES-CONSOLIDATED.txt"

# Расширения, которые считаем текстовыми
EXTS="js css html json md sh geojson"

# Папки, которые обходим (рекурсивно)
DIRS="_archive backups blocks css data js presets templates"

# Очистка выходного файла
> "$OUT"

echo "========================================" >> "$OUT"
echo " CONSOLIDATED FORECAST-MAP FILES" >> "$OUT"
echo " Generated: $(date)" >> "$OUT"
echo "========================================" >> "$OUT"
echo "" >> "$OUT"

# Файлы в корне
echo "--- ROOT FILES ---" >> "$OUT"
for f in "$BASE"/*.html "$BASE"/*.json "$BASE"/*.md "$BASE"/*.sh; do
  [ -f "$f" ] || continue
  echo "" >> "$OUT"
  echo "############################################################" >> "$OUT"
  echo "# FILE: $(basename "$f")" >> "$OUT"
  echo "# PATH: ${f}" >> "$OUT"
  echo "# SIZE: $(wc -c < "$f") bytes, $(wc -l < "$f") lines" >> "$OUT"
  echo "############################################################" >> "$OUT"
  echo "" >> "$OUT"
  cat "$f" >> "$OUT"
  echo "" >> "$OUT"
  echo "--- END OF $(basename "$f") ---" >> "$OUT"
  echo "" >> "$OUT"
done

# Файлы в подпапках
for dir in $DIRS; do
  D="$BASE/$dir"
  [ -d "$D" ] || continue
  echo "" >> "$OUT"
  echo "=== DIRECTORY: $dir/ ===" >> "$OUT"
  echo "" >> "$OUT"
  
  # Рекурсивный обход
  while IFS= read -r -d '' f; do
    ext="${f##*.}"
    # Пропускаем бинарные и большие файлы (world.geojson может быть большим)
    case "$ext" in
      js|css|html|json|md|sh|geojson)
        SIZE=$(wc -c < "$f")
        # Пропускаем файлы больше 500 КБ
        if [ "$SIZE" -gt 512000 ]; then
          echo "" >> "$OUT"
          echo "############################################################" >> "$OUT"
          echo "# FILE: ${f#$D/}" >> "$OUT"
          echo "# SKIPPED: too large ($SIZE bytes)" >> "$OUT"
          echo "############################################################" >> "$OUT"
          echo "" >> "$OUT"
          continue
        fi
        ;;
      *)
        continue
        ;;
    esac
    
    echo "" >> "$OUT"
    echo "############################################################" >> "$OUT"
    echo "# FILE: ${f#$BASE/}" >> "$OUT"
    echo "# SIZE: $SIZE bytes, $(wc -l < "$f") lines" >> "$OUT"
    echo "############################################################" >> "$OUT"
    echo "" >> "$OUT"
    cat "$f" >> "$OUT"
    echo "" >> "$OUT"
    echo "--- END OF ${f#$BASE/} ---" >> "$OUT"
    echo "" >> "$OUT"
  done < <(find "$D" -type f -print0)
done

# Итоговая статистика
TOTAL_LINES=$(wc -l < "$OUT")
TOTAL_SIZE=$(wc -c < "$OUT")
echo "" >> "$OUT"
echo "========================================" >> "$OUT"
echo " TOTAL: $TOTAL_LINES lines, $TOTAL_SIZE bytes" >> "$OUT"
echo "========================================" >> "$OUT"

echo ""
echo "✅ Готово! Файл создан:"
echo "   $OUT"
echo "   Строк: $TOTAL_LINES"
echo "   Размер: $TOTAL_SIZE байт"
echo ""
echo "   Скопируйте его содержимое и отправьте в чат,"
echo "   либо прикрепите сам файл к сообщению."
