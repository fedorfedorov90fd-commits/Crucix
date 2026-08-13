#!/bin/bash
cd "/home/ta8_/Рабочий стол/Crucix"

./scripts/ask-ai.sh "
Создай обновлённый README.md для проекта Crucix на основе текущего состояния.

Используй информацию из:
- PROJECT/STATE.txt
- PROJECT/ARCHITECTURE.txt
- PROJECT/ROADMAP.txt

README должен содержать:
1. Название и описание проекта
2. Установку
3. Архитектуру
4. Список готовых модулей
5. План разработки
6. Как помочь проекту

Напиши на русском языке, кратко и ясно.
" > README_NEW.md

echo "✅ README_NEW.md создан"
