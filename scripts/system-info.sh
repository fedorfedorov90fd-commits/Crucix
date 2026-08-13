#!/bin/bash
# Собирает информацию о системе для локального ИИ

echo "=== ИНФОРМАЦИЯ О СИСТЕМЕ ==="
echo ""

echo "1. ЖЕЛЕЗО:"
echo "   Процессор: $(cat /proc/cpuinfo | grep "model name" | head -1 | cut -d: -f2 | xargs)"
echo "   Ядер: $(nproc)"
echo "   Оперативная память: $(free -h | grep Mem | awk '{print $2}')"
echo "   Свободно памяти: $(free -h | grep Mem | awk '{print $4}')"
echo "   Диск: $(df -h / | grep / | awk '{print $2}') (свободно: $(df -h / | grep / | awk '{print $4}'))"
echo ""

echo "2. ВИДЕОКАРТА:"
if command -v nvidia-smi &> /dev/null; then
  echo "   $(nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>/dev/null || echo 'NVIDIA GPU (информация недоступна)')"
elif command -v lspci &> /dev/null; then
  echo "   $(lspci | grep -i "vga\|3d" | head -1 | cut -d: -f3- | xargs || echo 'Не найдена')"
else
  echo "   Не удалось определить"
fi
echo ""

echo "3. ОПЕРАЦИОННАЯ СИСТЕМА:"
echo "   $(lsb_release -d 2>/dev/null | cut -f2 || cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d '"')"
echo "   Ядро: $(uname -r)"
echo ""

echo "4. УСТАНОВЛЕННЫЕ ПРОГРАММЫ:"
echo "   Node.js: $(node -v 2>/dev/null || echo 'не установлен')"
echo "   npm: $(npm -v 2>/dev/null || echo 'не установлен')"
echo "   Git: $(git --version 2>/dev/null | cut -d' ' -f3 || echo 'не установлен')"
echo "   Ollama: $(ollama -v 2>/dev/null || echo 'не установлен')"
echo "   Tor: $(tor --version 2>/dev/null | head -1 || echo 'не установлен')"
echo "   Docker: $(docker --version 2>/dev/null | cut -d' ' -f3 || echo 'не установлен')"
echo "   Python: $(python3 --version 2>/dev/null || echo 'не установлен')"
echo ""

echo "5. ЗАНЯТЫЕ ПОРТЫ:"
echo "   $(ss -tlnp 2>/dev/null | grep LISTEN | awk '{print $4}' | cut -d: -f2 | sort -n | uniq | head -10 | tr '\n' ' ' || echo 'нет данных')"
echo ""

echo "6. ИСТОРИЯ КОМАНД (последние 10):"
echo "   $(history | tail -10 | sed 's/^[ ]*[0-9]*[ ]*//' | tr '\n' '; ')"
echo ""

echo "7. ТЕКУЩИЕ ПРОЦЕССЫ ПРОЕКТА:"
ps aux | grep -E "node|ollama|tor|Crucix" | grep -v grep | head -10
