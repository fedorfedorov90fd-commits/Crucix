#!/bin/bash
# Восстановление из резервной копии

echo "🔄 ВОССТАНОВЛЕНИЕ ПРОЕКТА"
echo "=========================="

# Показываем доступные бэкапы
echo "Доступные бэкапы (ежедневные):"
ls -la /home/ta8_/Рабочий\ стол/Crucix/backups/daily/ | head -10

echo ""
echo "Введите дату для восстановления (YYYY-MM-DD):"
read DATE

BACKUP_FILE="/home/ta8_/Рабочий стол/Crucix/backups/daily/code_$DATE.tar.gz"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Бэкап для $DATE не найден"
  exit 1
fi

echo "⚠️ Восстановление перезапишет текущие файлы!"
echo "Продолжить? (y/n)"
read CONFIRM

if [ "$CONFIRM" != "y" ]; then
  echo "❌ Отмена"
  exit 1
fi

echo "🔄 Восстановление кода..."
tar -xzf "$BACKUP_FILE" -C "/home/ta8_/Рабочий стол/Crucix"

echo "🔄 Восстановление данных..."
tar -xzf "/home/ta8_/Рабочий стол/Crucix/backups/daily/data_$DATE.tar.gz" -C "/home/ta8_/Рабочий стол/Crucix" 2>/dev/null

echo "✅ Восстановление завершено"
