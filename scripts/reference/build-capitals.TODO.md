# TODO: build-capitals.mjs — список улучшений

Дата создания: 2026-09-19
Текущая версия генератора: 2.0.3
Текущая версия справочника: 1.0.0

## Приоритет средний

### TODO-1. timezone неточен для 20 стран с несколькими часовыми поясами

**Проблема:** `pickTimezone()` ищет tz с `gmtOffset ≈ lon/15`. Для Москвы (lon=37.6) ожидаемый offset +3. Kirov и Moscow оба +3, но Kirov идёт раньше в массиве dr5hn → берётся Kirov.

**Затронуты:** US, RU, CN, BR, AU, IN, CA, MX, ID, KZ, AR и другие страны с несколькими tz.

**Фикс (академический):** Wikidata SPARQL с P421 (time zone) у столицы. Проблема: P421 возвращает Q-ID, а не строку tz. Требуется второй запрос через wbgetentities API. Проверка через SPARQL с `P31 wd:Q12143` дала undefined.

**Фикс (простой):** ручной маппинг столичных tz для 20 стран:
- US → America/New_York
- RU → Europe/Moscow
- CN → Asia/Shanghai
- BR → America/Sao_Paulo
- AU → Australia/Sydney
- IN → Asia/Kolkata
- CA → America/Toronto
- MX → America/Mexico_City
- ID → Asia/Jakarta
- KZ → Asia/Almaty
- AR → America/Argentina/Buenos_Aires
(остальные аналогично)

**Приоритет:** средний (влияет на локальное время, но не на координаты).

### TODO-2. 7 территорий с координатами территории вместо столицы

**Проблема:** у UMI, BES, SJM, BVT, HMD, TKL, ATA нет столиц (необитаемые или архипелаги). Использована P625 территории.

**Фикс:** ручной маппинг админ-центров:
- SJM → Longyearbyen (78.22, 15.65)
- TKL → Fakaofo (-9.38, -171.23)
- BES → Kralendijk (12.15, -68.28)
- UMI → Wake Island (уже есть 19.3, 166.63)
- BVT, HMD, ATA — оставить координаты территории (у них нет центров).

**Приоритет:** низкий. Для EPA эти территории не важны (нет людей).

## Приоритет низкий

### TODO-3. Проверка дубликатов устаревших кодов Wikidata

**Проблема:** в Wikidata есть устаревшие/альтернативные коды: AFI (Джибути-дубликат), ANT (Нидерландские Антильские, распались 2010), FXX (метрополия Франции), GEL (Кирибати-дубликат, у нас KIR), SOL (Сомалиленд).

**Текущее состояние:** отфильтрованы по списку 250 iso3 из countries.json.

**Фикс:** вручную проверить, что ни один реальный код не потерялся.

### TODO-4. name_local пустой у части записей

**Проблема:** у стран в countries.json `names.local` заполнен не везде, dr5hn.native тоже не везде.

**Фикс:** дополнить name_local из Wikidata (P1705 native label).

### TODO-5. Расширение ISO-маппинга NE ↔ наши

**Текущий маппинг:** KOS→XKX, SAH→ESH (в коде `ISO_MAP`).

**Фикс:** проверить, есть ли другие несовпадения между Natural Earth и countries.json.

## Архив изменений генератора

- v1.0.0 (19.09.2026): первая версия. Natural Earth + mledoze + dr5hn + Wikipedia.
- v2.0.0 (19.09.2026): Wikidata SPARQL как основной источник. Wikipedia prop=coordinates (не работает для столиц).
- v2.0.1 (19.09.2026): POST для Wikidata (попытка фикса 403, не помогла — причина в другом).
- v2.0.2 (19.09.2026): фикс spread-бага — `...options` перезаписывал headers, теряя User-Agent. Wikidata 403 устранён. 239 столиц.
- v2.0.3 (19.09.2026): Wikidata P625 для 7 missing территорий. missing: 0.

## Бэкапы

Все версии сохранены в `backups/build-capitals-YYYYMMDD/build-capitals.mjs.HHMMSS`.
