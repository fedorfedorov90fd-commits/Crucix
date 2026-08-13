#!/bin/bash
# Локальный ИИ управляет бэкапами

case "$1" in
  status)
    ./scripts/ask-ai.sh "
    Проанализируй состояние бэкапов проекта Crucix.

    Ежедневные бэкапы:
    $(ls -la /home/ta8_/Рабочий\ стол/Crucix/backups/daily/ | tail -5)

    Еженедельные:
    $(ls -la /home/ta8_/Рабочий\ стол/Crucix/backups/weekly/ 2>/dev/null | tail -3)

    Ежемесячные:
    $(ls -la /home/ta8_/Рабочий\ стол/Crucix/backups/monthly/ 2>/dev/null | tail -3)

    Всё ли в порядке с бэкапами?
    "
    ;;
  create)
    ./scripts/backup.sh
    ;;
  *)
    echo "Использование:"
    echo "  ./scripts/ai-backup.sh status  # Проверить состояние бэкапов"
    echo "  ./scripts/ai-backup.sh create  # Создать бэкап"
    ;;
esac
