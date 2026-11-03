# Справочники Crucix

## Структура

data/reference/
├── _raw/ ← исходники (не удалять — из них собирается всё остальное)
│ ├── cities5000.txt ← GeoNames, города >5000 населения
│ ├── cities5000.zip ← архив GeoNames
│ ├── ofac-sdn.csv ← OFAC SDN (основной санкционный список)
│ ├── ofac-alt.csv ← OFAC альтернативные имена
│ └── ofac-cons-prim.csv ← OFAC связи между сущностями
│
├── cities.json ← 69992 города (собирается из _raw/cities5000.txt)
├── cities-lookup.json ← 539303 алиаса (город → {alpha2, lat, lng, name, population})
├── sanctions.jsonl ← 19484 санкционные записи (собирается из _raw/ofac-*.csv)
├── sanctions-lookup.json ← 39329 имён (санкционное имя → [ent_num])
├── countries.json ← 252 страны (штатный, с расширенными полями)
├── capitals-coords.json ← координаты столиц
├── country-aliases.json ← алиасы стран (en, ru, alpha2, alpha3) → alpha3
├── country-characteristics.json
├── gini-index.json
├── subdivisions.json
└── iso-3166-1.json ← 257 стран (alpha2, alpha3, numeric, name_en, name_ru)

config/reference/
├── currencies.json ← 181 валюта (ISO 4217)
├── languages.json ← языки (ISO 639-2)
└── _raw/
└── iso-3166-1-full.json ← полный ISO-3166-1 с aliases (исходник для country-aliases.json)
text


## Как пересобрать

```bash
node scripts/reference/rebuild-reference.mjs

Собирает из data/reference/_raw/:

    cities.json + cities-lookup.json (из cities5000.txt)

    sanctions.jsonl + sanctions-lookup.json (из ofac-sdn.csv + ofac-alt.csv)

Как обновить справочники

GeoNames (города):

    Скачать cities5000.zip с https://download.geonames.org/export/dump/

    Распаковать в _raw/cities5000.txt

    node scripts/reference/rebuild-reference.mjs

OFAC (санкции):

    Скачать sdn.csv, alt.csv, cons_prim.csv с https://sanctionslistservice.ofac.treas.gov/

    Положить в _raw/

    node scripts/reference/rebuild-reference.mjs

ISO-3166 (страны):

    iso-3166-1.json — статический, меняется редко

    iso-3166-1-full.json — исходник для country-aliases.json (с русскими алиасами)

Известные нюансы

    sanctions-lookup.json — ключи в формате фамилия, имя (латиница). В коде искать подстроку, а не точное совпадение.

    cities-lookup.json — при коллизии имён выбирается город с максимальным населением (после фикса от 2026-11-03).

    country-aliases.json — с 2026-11-03 содержит русские алиасы («США», «РФ», «Британия»).
    EOF

echo "✅ README.md создан"
wc -l data/reference/README.md
text


## Итог

| Справочник | Статус | Где |
|---|---|---|
| Города (GeoNames) | ✅ исправлен | `data/reference/cities.json`, `cities-lookup.json` |
| Санкции (OFAC) | ✅ работает | `data/reference/sanctions.jsonl`, `sanctions-lookup.json` |
| Страны (ISO) | ✅ штатный | `data/reference/iso-3166-1.json` |
| Алиасы стран | ⚠️ дополняем (Команда 1) | `data/reference/country-aliases.json` |
| Столицы | ✅ штатный | `data/reference/capitals-coords.json` |
| Валюты | ✅ | `config/reference/currencies.json` |
| Языки | ✅ | `config/reference/languages.json` |
| Полный ISO | ✅ исходник | `config/reference/_raw/iso-3166-1-full.json` |
