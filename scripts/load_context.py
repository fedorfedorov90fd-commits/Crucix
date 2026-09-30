#!/usr/bin/env python3
"""
Загрузка всех файлов из PROJECT (копия)/ в контекст для Ollama
"""

import os
import sys
import json
import subprocess
from pathlib import Path

PROJECT_DIR = "/home/ta8_/Рабочий стол/Crucix/PROJECT (копия)"
CONTEXT_FILE = "/tmp/crucix_full_context.txt"

def load_all_files():
    """Загрузить все .txt файлы из папки (первые 3000 символов каждого)"""
    files = sorted(Path(PROJECT_DIR).glob("*.txt"))
    context = []
    
    context.append("=== CRUCIX — ПОЛНЫЙ КОНТЕКСТ ПРОЕКТА ===")
    context.append(f"Собрано: {__import__('datetime').datetime.now().isoformat()}")
    context.append(f"Файлов: {len(files)}")
    context.append("")
    
    for file in files:
        context.append("=" * 60)
        context.append(f"ФАЙЛ: {file.name}")
        context.append("=" * 60)
        context.append("")
        try:
            with open(file, 'r', encoding='utf-8') as f:
                content = f.read()
                # Берём первые 3000 символов (чтобы не перегружать)
                if len(content) > 3000:
                    content = content[:3000] + "... (обрезано)"
                context.append(content)
        except Exception as e:
            context.append(f"Ошибка чтения: {e}")
        context.append("")
    
    return "\n".join(context)

def query_ollama(prompt, context, max_chars=8000):
    """Отправить запрос к Ollama с контекстом"""
    # Берём первые max_chars символов контекста
    short_context = context[:max_chars]
    
    full_prompt = f"""Ты — координатор проекта CRUCIX.

Вот полная информация о проекте:
{short_context}

Вопрос пользователя: {prompt}

Отвечай кратко, но конкретно, ссылаясь на файлы проекта."""

    payload = {
        "model": "deepseek-r1:1.5b",
        "prompt": full_prompt,
        "stream": False,
        "options": {
            "temperature": 0.3,
            "num_predict": 600
        }
    }
    
    try:
        # Используем subprocess с большим таймаутом
        result = subprocess.run(
            ["curl", "-s", "http://localhost:11434/api/generate",
             "-H", "Content-Type: application/json",
             "-d", json.dumps(payload)],  # <-- экранирует JSON автоматически
            capture_output=True,
            text=True,
            timeout=120  # 2 минуты вместо 60 секунд
        )
        
        if result.returncode != 0:
            return f"Ошибка curl: {result.stderr}"
            
        try:
            data = json.loads(result.stdout)
            return data.get("response", "Нет ответа от модели")
        except json.JSONDecodeError as e:
            return f"Ошибка парсинга JSON: {e}\nОтвет: {result.stdout[:200]}"
            
    except subprocess.TimeoutExpired:
        return "❌ Таймаут: модель не ответила за 120 секунд"
    except Exception as e:
        return f"❌ Ошибка: {e}"

def main():
    print("=" * 60)
    print("  ЗАГРУЗКА КОНТЕКСТА CRUCIX")
    print("=" * 60)
    
    # Загружаем все файлы
    print("📁 Загрузка файлов из PROJECT (копия)/...")
    context = load_all_files()
    print(f"✅ Загружено {len(list(Path(PROJECT_DIR).glob('*.txt')))} файлов")
    print(f"📊 Размер контекста: {len(context)} символов")
    
    # Сохраняем контекст (полный, не обрезанный)
    with open(CONTEXT_FILE, 'w', encoding='utf-8') as f:
        f.write(context)
    print(f"✅ Контекст сохранён: {CONTEXT_FILE}")
    
    # Если есть вопрос
    if len(sys.argv) > 1:
        question = " ".join(sys.argv[1:])
        print(f"\n💬 Вопрос: {question}")
        print("\n🤖 Ответ:")
        answer = query_ollama(question, context)
        print(answer)
        
        # Сохраняем ответ в лог
        log_file = Path("/home/ta8_/Рабочий стол/Crucix/logs/context_answers.log")
        log_file.parent.mkdir(exist_ok=True)
        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(f"\n{'='*60}\n")
            f.write(f"Вопрос: {question}\n")
            f.write(f"Ответ: {answer}\n")
            f.write(f"Время: {__import__('datetime').datetime.now().isoformat()}\n")
        print(f"\n📝 Ответ сохранён в лог: {log_file}")
        
    else:
        print("\n💡 Использование: python3 scripts/load_context.py \"Ваш вопрос\"")
        print("💡 Без вопроса — просто обновляет контекст")

if __name__ == "__main__":
    main()
