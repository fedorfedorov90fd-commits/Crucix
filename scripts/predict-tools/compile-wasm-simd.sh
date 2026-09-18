#!/usr/bin/env bash
# Компиляция SIMD WASM-модуля
# Требует wabt с поддержкой SIMD

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/apis/predict/wasm"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "════════════════════════════════════════════════"
echo "  Compile WASM SIMD"
echo "════════════════════════════════════════════════"

if ! command -v wat2wasm >/dev/null 2>&1; then
    echo -e "${RED}wat2wasm не установлен${NC}"
    echo "Установить:"
    echo "  npm install -g wabt        # через npm"
    echo "  apt install wabt           # Debian/Ubuntu"
    echo "  brew install wabt          # macOS"
    exit 1
fi

WAT2WASM_VERSION=$(wat2wasm --version 2>&1 || echo "unknown")
echo "wat2wasm: $WAT2WASM_VERSION"
echo ""

if [ -f "linear_algebra.wat" ]; then
    echo "[1/2] Компиляция скалярной версии..."
    wat2wasm linear_algebra.wat -o linear_algebra.wasm
    SIZE=$(stat -c%s linear_algebra.wasm 2>/dev/null || stat -f%z linear_algebra.wasm)
    echo -e "  ${GREEN}✓${NC} linear_algebra.wasm ($SIZE bytes)"
fi

if [ -f "linear_algebra_simd.wat" ]; then
    echo ""
    echo "[2/2] Компиляция SIMD версии..."
    if wat2wasm --enable-simd linear_algebra_simd.wat -o linear_algebra_simd.wasm 2>&1; then
        SIZE=$(stat -c%s linear_algebra_simd.wasm 2>/dev/null || stat -f%z linear_algebra_simd.wasm)
        echo -e "  ${GREEN}✓${NC} linear_algebra_simd.wasm ($SIZE bytes)"
    else
        echo -e "  ${YELLOW}⚠${NC}  SIMD-компиляция не удалась"
        echo "     Ваш wat2wasm может не поддерживать --enable-simd"
        echo "     Обновите wabt: npm install -g wabt@latest"
    fi
fi

echo ""
echo "════════════════════════════════════════════════"
echo -e "${GREEN}✓ Компиляция завершена${NC}"
echo "════════════════════════════════════════════════"
echo ""
echo "Проверка:"
echo "  node -e \"import('./apis/predict/wasm/simd_loader.mjs').then(async m => {"
echo "    await m.initSIMD();"
echo "    console.log(m.simdStatus());"
echo "    console.log(m.benchmarkAll(100));"
echo "  })\""
