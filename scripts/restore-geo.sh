#!/bin/bash

echo "=== ВОССТАНОВЛЕНИЕ ГЕО-КАРТЫ ИЗ СТАБИЛЬНОГО СОСТОЯНИЯ ==="

# Находим последний архив
BACKUP=$(ls -t backups/geo-stable-*.tar.gz 2>/dev/null | head -1)

if [ -z "$BACKUP" ]; then
  echo "❌ Бэкап не найден!"
  exit 1
fi

echo "📦 Восстанавливаем из: $BACKUP"

# Распаковываем
tar -xzf "$BACKUP" -C /home/ta8_/Рабочий\ стол/Crucix/

echo "✅ Восстановление завершено!"
echo "🔄 Перезапустите сервер: node server.mjs"

# Проверяем, что файлы на месте
ls -la dashboard/public/geo-map.html
ls -la apis/sources/geo-markers-api.mjs
ls -la data/basket/geo-data.json
