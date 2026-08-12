#!/bin/bash
echo "📊 ЕЖЕДНЕВНЫЙ ОТЧЁТ ДЛЯ РАЗРАБОТЧИКА"

echo "1. Состояние проекта:"
cat PROJECT/STATE.txt | head -10

echo ""
echo "2. Последние изменения:"
git log --oneline -3

echo ""
echo "3. Проверка кода:"
./scripts/check-code.sh 2>&1 | head -10

echo ""
echo "4. Что делать дальше:"
./scripts/daily-plan.sh
