# Patternique

В репозитории находятся исходники нового продукта, созданного на основе дизайна и лицензионной архитектуры из `tracebase-full-set.zip`:

- [`pattern-plugin/`](pattern-plugin/) — Figma-плагин для бесшовных узоров;
- [`pattern-backend/`](pattern-backend/) — сайт покупки, API лицензий и схема Supabase.

## Быстрая проверка

```bash
cd pattern-plugin
bash build.sh
node test/core.test.js

cd ../pattern-backend
node test/backend.test.js
node test/site.test.js
```

Цены на сайте и в платёжном API: **1 год — 690 ₽**, **бессрочно — 1 790 ₽**.

Подробные инструкции находятся в README каждого каталога.
