#!/bin/bash
# Автоматическое резервное копирование проекта

BACKUP_DIR="/home/ta8_/Рабочий стол/Crucix/backups"
DATE=$(date +%Y-%m-%d)

echo "💾 СОЗДАНИЕ РЕЗЕРВНОЙ КОПИИ"
echo "============================="

# 1. Бэкап данных (RSS, новости, оценки)
echo "1. Архивирование данных..."
tar -czf "$BACKUP_DIR/daily/data_$DATE.tar.gz" \
  -C "/home/ta8_/Рабочий стол/Crucix" \
  data/ 2>/dev/null || echo "   ⚠️ Нет данных для бэкапа"

# 2. Бэкап кода (без node_modules)
echo "2. Архивирование кода..."
tar -czf "$BACKUP_DIR/daily/code_$DATE.tar.gz" \
  --exclude="node_modules" \
  --exclude="data" \
  --exclude="logs" \
  --exclude="backups" \
  -C "/home/ta8_/Рабочий стол/Crucix" \
  . 2>/dev/null

# 3. Бэкап состояния проекта
echo "3. Архивирование состояния..."
tar -czf "$BACKUP_DIR/daily/state_$DATE.tar.gz" \
  -C "/home/ta8_/Рабочий стол/Crucix" \
  PROJECT/ AI_MEMORY/ 2>/dev/null

# 4. Создание отчёта о бэкапе
BACKUP_SIZE=$(du -sh "$BACKUP_DIR/daily/" | cut -f1)
echo "📊 Размер бэкапа: $BACKUP_SIZE"

# 5. Очистка старых бэкапов (храним 7 дней ежедневных, 4 недельных, 6 месячных)
echo "4. Очистка старых бэкапов..."

# Ежедневные: храним 7 дней
find "$BACKUP_DIR/daily" -name "*.tar.gz" -mtime +7 -delete 2>/dev/null

# Еженедельные: создаём по воскресеньям
if [ $(date +%u) -eq 7 ]; then
  cp "$BACKUP_DIR/daily/data_$DATE.tar.gz" "$BACKUP_DIR/weekly/data_week_$DATE.tar.gz" 2>/dev/null
  cp "$BACKUP_DIR/daily/code_$DATE.tar.gz" "$BACKUP_DIR/weekly/code_week_$DATE.tar.gz" 2>/dev/null
  echo "   ✅ Создан еженедельный бэкап"
fi

# Ежемесячные: создаём 1-го числа
if [ $(date +%d) -eq 01 ]; then
  cp "$BACKUP_DIR/daily/data_$DATE.tar.gz" "$BACKUP_DIR/monthly/data_month_$DATE.tar.gz" 2>/dev/null
  cp "$BACKUP_DIR/daily/code_$DATE.tar.gz" "$BACKUP_DIR/monthly/code_month_$DATE.tar.gz" 2>/dev/null
  echo "   ✅ Создан ежемесячный бэкап"
fi

# Удаляем старые еженедельные (храним 4 недели)
find "$BACKUP_DIR/weekly" -name "*.tar.gz" -mtime +28 -delete 2>/dev/null

# Удаляем старые ежемесячные (храним 6 месяцев)
find "$BACKUP_DIR/monthly" -name "*.tar.gz" -mtime +180 -delete 2>/dev/null

echo ""
echo "✅ Бэкап завершён: $BACKUP_DIR/daily/backup_$DATE.tar.gz"
echo "📁 Хранится:"
echo "   - Ежедневные: 7 дней"
echo "   - Еженедельные: 4 недели"
echo "   - Ежемесячные: 6 месяцев"
