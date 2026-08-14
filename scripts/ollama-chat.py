#!/usr/bin/env python3
import json
import subprocess
import sys
import os

CODEBASE = "/home/ta8_/AI_MEMORY/codebase"
prompt = " ".join(sys.argv[1:]) or "Что такое Crucix?"

# Читаем обзор
overview = "Индексация не найдена"
try:
    with open(os.path.join(CODEBASE, "00_OVERVIEW.md"), "r") as f:
        overview = f.read()[:2000]
except:
    pass

# Читаем список файлов из чанков
files_list = []
for i in range(1, 3):
    try:
        with open(os.path.join(CODEBASE, f"chunk_{i:03d}.txt"), "r") as f:
            content = f.read()
            headers = [line.strip() for line in content.split("\n") if line.startswith("===")]
            files_list.extend(headers[:10])
    except:
        pass

full_prompt = f"""Ты — эксперт по Crucix.

ОБЗОР: {overview}

ФАЙЛЫ В ПРОЕКТЕ:
{chr(10).join(files_list[:30])}

ВОПРОС: {prompt}

ОТВЕТЬ КРАТКО, НО КОНКРЕТНО. УКАЗЫВАЙ ФАЙЛЫ."""

# Отправляем запрос через subprocess (безопаснее)
payload = {
    "model": "deepseek-r1:1.5b",
    "prompt": full_prompt,
    "stream": False
}

try:
    result = subprocess.run(
        ["curl", "-s", "http://localhost:11434/api/generate",
         "-H", "Content-Type: application/json",
         "-d", json.dumps(payload)],
        capture_output=True,
        text=True,
        timeout=60
    )
    data = json.loads(result.stdout)
    print(data.get("response", result.stdout))
except Exception as e:
    print(f"Ошибка: {e}")
