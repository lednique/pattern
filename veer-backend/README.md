# Veer licensing site

Статический сайт покупки в оранжевой теме `#F2A24C` с фоном-протяжкой от оранжевого сверху до чёрного снизу, локализацией на 7 языков + serverless API для Vercel, Robokassa и Supabase. Структура и оформление повторяют сайт Patternique; личный кабинет (`/manage.html`) и база лицензий — отдельные, независимые от Patternique.

## Тарифы

- **1 год — 290 ₽** (`annual`): 365 дней с момента первой активации ключа;
- **Бессрочно — 790 ₽** (`lifetime`): без даты окончания.

Цены заданы в `vercel-site/api/_shared.js` и могут быть переопределены переменными `PRICE_ANNUAL` и `PRICE_LIFETIME`. Сайт и API работают в рублях.

## Развёртывание

1. Создайте отдельный проект Supabase и выполните `supabase/schema.sql`.
2. Импортируйте каталог `vercel-site` в Vercel и привяжите домен `veer.lednique.ru`.
3. Добавьте переменные окружения:

```text
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_KEY=...
ROBO_MERCHANT_LOGIN=...
ROBO_PASS1=...
ROBO_PASS2=...
ROBO_ISTEST=1               # удалить или поставить 0 в production
ADMIN_PASS=...
PRICE_ANNUAL=290            # необязательно, это значения по умолчанию
PRICE_LIFETIME=790
```

4. В Robokassa настройте:
   - Result URL: `https://veer.lednique.ru/api/robokassa-result`, метод POST;
   - Success URL: `https://veer.lednique.ru/success.html`;
   - Fail URL: `https://veer.lednique.ru/error.html`.
5. Проверьте `GET /api/health` и тестовый платёж.
6. После проверки отключите `ROBO_ISTEST`.

## API

- `GET /api/prices`
- `POST /api/create-payment` — `{ plan, email, coupon? }`
- `POST /api/check-coupon`
- `POST /api/activate-key` — `{ key, figma_user_id }`
- `GET /api/get-key?inv_id=...`
- `POST /api/robokassa-result`
- `/api/admin-keys` и `/api/coupons` с заголовком `X-Admin-Pass`

Личный кабинет управления лицензиями находится по адресу `/manage.html`.

## Плагин

Плагин Veer обращается к этому сайту: `SITE_URL` в `veer-plugin/src/ui-template.html` и домен в `veer-plugin/manifest.json` (networkAccess) должны указывать на `https://veer.lednique.ru`.

## Тесты

```bash
cd veer-backend
node test/backend.test.js
node test/site.test.js
```

Содержимое выбранных слоёв Figma не отправляется на сервер: API получает только ключ и ID аккаунта для активации.
