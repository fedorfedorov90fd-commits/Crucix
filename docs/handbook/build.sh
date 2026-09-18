#!/usr/bin/env bash
# Сборка Crucix Handbook в PDF/HTML/EPUB
# Требует: pandoc, xelatex (для PDF)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

OUTPUT_DIR="$ROOT/_build"
mkdir -p "$OUTPUT_DIR"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "================================================"
echo "  Crucix Handbook - Build"
echo "================================================"

if ! command -v pandoc >/dev/null 2>&1; then
    echo -e "${RED}pandoc не установлен${NC}"
    echo "Установить:"
    echo "  macOS:  brew install pandoc"
    echo "  Ubuntu: apt install pandoc"
    exit 1
fi

PANDOC_VERSION=$(pandoc --version | head -1)
echo "  $PANDOC_VERSION"
echo ""

FILES=(
    "00-intro.md"
    "01-architecture.md"
    "02-sciences.md"
    "03-models.md"
)

if [ -d "sciences" ]; then
    for f in sciences/*.md; do
        [ -f "$f" ] && FILES+=("$f")
    done
fi

echo "[1/3] Сборка PDF (xelatex)..."
if command -v xelatex >/dev/null 2>&1; then
    pandoc "${FILES[@]}" \
        -o "$OUTPUT_DIR/crucix-handbook.pdf" \
        --pdf-engine=xelatex \
        --toc \
        --toc-depth=2 \
        --number-sections \
        --highlight-style tango \
        --metadata title="Crucix Handbook" \
        --metadata author="Crucix Team" \
        -V geometry:margin=2.5cm \
        -V fontsize=11pt \
        2>&1 | grep -v "^$" || true
    if [ -f "$OUTPUT_DIR/crucix-handbook.pdf" ]; then
        SIZE=$(stat -c%s "$OUTPUT_DIR/crucix-handbook.pdf" 2>/dev/null || stat -f%z "$OUTPUT_DIR/crucix-handbook.pdf")
        echo -e "  ${GREEN}OK${NC} crucix-handbook.pdf ($((SIZE / 1024)) KB)"
    fi
else
    echo -e "  ${YELLOW}WARN${NC} xelatex не установлен — пропускаем PDF"
fi

echo ""
echo "[2/3] Сборка HTML..."
pandoc "${FILES[@]}" \
    -o "$OUTPUT_DIR/crucix-handbook.html" \
    --standalone \
    --toc \
    --toc-depth=2 \
    --number-sections \
    --highlight-style tango \
    --metadata title="Crucix Handbook" \
    --metadata author="Crucix Team"

if [ -f "$OUTPUT_DIR/crucix-handbook.html" ]; then
    SIZE=$(stat -c%s "$OUTPUT_DIR/crucix-handbook.html" 2>/dev/null || stat -f%z "$OUTPUT_DIR/crucix-handbook.html")
    echo -e "  ${GREEN}OK${NC} crucix-handbook.html ($((SIZE / 1024)) KB)"
fi

echo ""
echo "[3/3] Сборка EPUB..."
pandoc "${FILES[@]}" \
    -o "$OUTPUT_DIR/crucix-handbook.epub" \
    --toc \
    --toc-depth=2 \
    --metadata title="Crucix Handbook" \
    --metadata author="Crucix Team" \
    --metadata lang=ru

if [ -f "$OUTPUT_DIR/crucix-handbook.epub" ]; then
    SIZE=$(stat -c%s "$OUTPUT_DIR/crucix-handbook.epub" 2>/dev/null || stat -f%z "$OUTPUT_DIR/crucix-handbook.epub")
    echo -e "  ${GREEN}OK${NC} crucix-handbook.epub ($((SIZE / 1024)) KB)"
fi

echo ""
echo "================================================"
echo -e "${GREEN}OK Сборка завершена${NC}"
echo "================================================"
ls -lh "$OUTPUT_DIR"
