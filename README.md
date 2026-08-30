# Patternique

В репозитории находятся исходники продуктов, созданных на основе дизайна и лицензионной архитектуры из `tracebase-full-set.zip`:

- [`pattern-plugin/`](pattern-plugin/) — Figma-плагин для редактируемых бесшовных узоров 256 × 256 px;
- [`veer-plugin/`](veer-plugin/) — Figma-плагин Veer для вееров из изображений (до 12 штук, дуга от прямой линии до полного круга);
- [`pattern-backend/`](pattern-backend/) — сайт покупки Patternique, API лицензий и схема Supabase;
- [`veer-backend/`](veer-backend/) — отдельный сайт покупки Veer с собственной базой и личным кабинетом (оранжевая тема с градиентом в чёрный).

## Быстрая проверка

```bash
cd pattern-plugin
bash build.sh
node test/core.test.js

cd ../veer-plugin
bash build.sh
node test/core.test.js
node test/ui-smoke.test.js

cd ../pattern-backend
node test/backend.test.js
node test/site.test.js

cd ../veer-backend
node test/backend.test.js
node test/site.test.js
```

Или всё сразу из корня: `bash test.sh`.

Цены Patternique: **1 год — 690 ₽**, **бессрочно — 1 790 ₽**.
Цены Veer: **1 год — 290 ₽**, **навсегда — 790 ₽**.

Подробные инструкции находятся в README каждого каталога.
