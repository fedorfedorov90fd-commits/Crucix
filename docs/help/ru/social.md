# Social — Социальные сети и OSINT

## Что это

Social — OSINT-модуль для сбора данных из социальных сетей: Twitter/X, Telegram, Reddit, VK, Facebook, Instagram, YouTube. Собирает публичные посты, комментарии, реакции, хештеги, геолокации, изображения. Анализирует тональность и тренды.

## Как пользоваться

1. Получите API-ключи для нужных платформ
2. В `.env` пропишите ключи
3. Запустите сборщик: `node scripts/collectors/collect-social.mjs`
4. Данные сохраняются в `/basket/social/`
5. Используйте `http://localhost:3117/api/social?platform=twitter&q=война`

## Профессиональное использование

- **Маркетологи** анализируют бренды
- **Политические аналитики** отслеживают настроения
- **Специалисты по безопасности** выявляют угрозы
- **Журналисты** находят источники

## ❓ Часто задаваемые вопросы

**Вопрос:** Какие платформы поддерживаются?
**Ответ:** Twitter/X, Telegram, Reddit, VK, Facebook, Instagram, YouTube.

**Вопрос:** Требуются ли API-ключи?
**Ответ:** Да, для большинства платформ.

**Вопрос:** Какие метрики собираются?
**Ответ:** Текст, лайки, репосты, комментарии, геолокация, медиа.

## 🎯 Интерактивный туториал

**Шаг 1:** Получите API ключи (Twitter, Telegram)

```
# Twitter: https://developer.twitter.com
# Telegram: https://core.telegram.org/api
```

**Шаг 2:** Сохраните ключи

```
echo "TWITTER_API_KEY=ключ" >> .env
echo "TELEGRAM_API_KEY=ключ" >> .env
```

**Шаг 3:** Запустите сборщик

```
node scripts/collectors/collect-social.mjs
```

**Шаг 4:** Поиск по Twitter

```
curl "http://localhost:3117/api/social?platform=twitter&q=конфликт"
```