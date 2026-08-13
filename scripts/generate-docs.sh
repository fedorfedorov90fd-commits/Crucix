#!/bin/bash
echo "📚 ГЕНЕРАЦИЯ ДОКУМЕНТАЦИИ"
npx jsdoc apis/sources/*.mjs -d docs/
