#!/bin/bash

echo "📝 Генерация описаний модулей Crucix..."
echo ""

# Список всех модулей
MODULES=$(ls -1 apis/sources/*.mjs | sed 's|apis/sources/||' | sed 's/\.mjs$//' | sort)
TOTAL=$(echo "$MODULES" | wc -l)
COUNT=0

for module in $MODULES; do
  COUNT=$((COUNT + 1))
  echo "[$COUNT/$TOTAL] Обработка: $module"
  
  # Категория
  if echo "$module" | grep -qE "monitor"; then
    CAT="Мониторинг"
    CAT_EN="Monitoring"
  elif echo "$module" | grep -qE "intel|intelligence"; then
    CAT="Разведка"
    CAT_EN="Intelligence"
  elif echo "$module" | grep -qE "predict|forecast"; then
    CAT="Прогнозирование"
    CAT_EN="Prediction"
  elif echo "$module" | grep -qE "infrastructure"; then
    CAT="Инфраструктура"
    CAT_EN="Infrastructure"
  elif echo "$module" | grep -qE "analysis|analyzer"; then
    CAT="Аналитика"
    CAT_EN="Analytics"
  elif echo "$module" | grep -qE "geo|map"; then
    CAT="Картография"
    CAT_EN="Mapping"
  elif echo "$module" | grep -qE "news|feed|rss"; then
    CAT="Новости"
    CAT_EN="News"
  elif echo "$module" | grep -qE "ai|llm"; then
    CAT="AI"
    CAT_EN="AI"
  elif echo "$module" | grep -qE "p2p|network"; then
    CAT="Сеть"
    CAT_EN="Network"
  elif echo "$module" | grep -qE "dark|deepfake|quantum"; then
    CAT="Передовые технологии"
    CAT_EN="Advanced Tech"
  elif echo "$module" | grep -qE "cyber|security|threat"; then
    CAT="Кибербезопасность"
    CAT_EN="Cybersecurity"
  elif echo "$module" | grep -qE "space|satellite"; then
    CAT="Космос"
    CAT_EN="Space"
  elif echo "$module" | grep -qE "energy|oil|gas"; then
    CAT="Энергетика"
    CAT_EN="Energy"
  elif echo "$module" | grep -qE "trade|economy"; then
    CAT="Экономика"
    CAT_EN="Economy"
  elif echo "$module" | grep -qE "health|who"; then
    CAT="Здравоохранение"
    CAT_EN="Health"
  elif echo "$module" | grep -qE "weather|noaa"; then
    CAT="Погода"
    CAT_EN="Weather"
  elif echo "$module" | grep -qE "social|telegram|reddit"; then
    CAT="Соцсети"
    CAT_EN="Social Media"
  else
    CAT="Общее"
    CAT_EN="General"
  fi

  # Статус
  if grep -q "import.*$module" server.mjs 2>/dev/null; then
    STATUS="✅ Подключен"
    STATUS_EN="✅ Connected"
  else
    STATUS="⏳ Не подключен"
    STATUS_EN="⏳ Not Connected"
  fi

  # Русское описание
  cat > "docs/modules/ru/${module}.md" << RUS
# ${module}

## 📌 Основная информация
- **Название:** ${module}
- **Категория:** ${CAT}
- **Статус:** ${STATUS}
- **Файл:** \`apis/sources/${module}.mjs\`

## 📖 Описание
Модуль **${module}** предназначен для работы в системе Crucix.

## 🎯 Функционал
- Сбор и обработка данных
- Интеграция с API
- Визуализация результатов

## 🔗 Связь с другими модулями
Может взаимодействовать с другими компонентами Crucix.

---
*Описание автоматически сгенерировано. Для полного описания обратитесь к документации модуля.*
RUS

  # Английское описание
  cat > "docs/modules/en/${module}.md" << ENG
# ${module}

## 📌 Basic Information
- **Name:** ${module}
- **Category:** ${CAT_EN}
- **Status:** ${STATUS_EN}
- **File:** \`apis/sources/${module}.mjs\`

## 📖 Description
Module **${module}** is designed for the Crucix system.

## 🎯 Functionality
- Data collection and processing
- API integration
- Result visualization

## 🔗 Integration
Can interact with other Crucix components.

---
*Description automatically generated. For full description, refer to module documentation.*
ENG

done

echo ""
echo "✅ ГОТОВО!"
echo "📁 Русские описания: docs/modules/ru/ ($(ls -1 docs/modules/ru/*.md | wc -l) файлов)"
echo "📁 Английские описания: docs/modules/en/ ($(ls -1 docs/modules/en/*.md | wc -l) файлов)"
