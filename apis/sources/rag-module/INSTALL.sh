#!/bin/bash
# ============================================================
# УСТАНОВЩИК RAG-МОДУЛЯ ДЛЯ CRUCIX
# ============================================================

echo "╔══════════════════════════════════════════╗"
echo "║   🧠 УСТАНОВКА RAG-МОДУЛЯ              ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Проверяем Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не найден. Установите Node.js 18+"
    echo "   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
    echo "   sudo apt install -y nodejs"
    exit 1
fi
echo "✅ Node.js $(node -v)"

# Устанавливаем зависимости
echo ""
echo "📦 Установка зависимостей..."
npm install

# Создаём папку для данных
mkdir -p rag_data

# Копируем конфиг
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Создан .env (отредактируйте при необходимости)"
fi

echo ""
echo "========================================="
echo "✅ УСТАНОВКА ЗАВЕРШЕНА!"
echo "========================================="
echo ""
echo "🚀 ЗАПУСК:"
echo "   node rag-server.mjs"
echo ""
echo "🌐 ЧАТ-ИНТЕРФЕЙС:"
echo "   http://localhost:3120/rag-chat.html"
echo ""
echo "📋 ИЛИ вставьте rag-chat.html в папку"
echo "   dashboard/public/ Crucix"
echo "========================================="
