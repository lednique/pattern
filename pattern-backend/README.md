# Patternique licensing site

Статический сайт покупки в теме `#DEDD74` с локализацией на 7 языков + serverless API для Vercel, Robokassa и Supabase.

## Тарифы

- **1 год — 690 ₽** (`annual`): 365 дней с момента первой активации ключа;
- **Бессрочно — 1 790 ₽** (`lifetime`): без даты окончания.

Цены заданы в `vercel-site/api/_shared.js` и могут быть переопределены переменными `PRICE_ANNUAL` и `PRICE_LIFETIME`. Сайт и API работают в рублях.

## Развёртывание

1. Создайте проект Supabase и выполните `supabase/schema.sql`.
2. Импортируйте каталог `vercel-site` в Vercel.
3. Добавьте переменные окружения:

```text
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_KEY=...
ROBO_MERCHANT_LOGIN=...
ROBO_PASS1=...
ROBO_PASS2=...
ROBO_ISTEST=1               # удалить или поставить 0 в production
ADMIN_PASS=...
PRICE_ANNUAL=690            # необязательно, это значения по умолчанию
PRICE_LIFETIME=1790
```

4. В Robokassa настройте:
   - Result URL: `https://pattern.lednique.ru/api/robokassa-result`, метод POST;
   - Success URL: `https://pattern.lednique.ru/success.html`;
   - Fail URL: `https://pattern.lednique.ru/error.html`.
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

Админ-интерфейс находится по адресу `/manage.html`.

## Тесты

```bash
cd pattern-backend
node test/backend.test.js
node test/site.test.js
```

Содержимое выбранных слоёв Figma не отправляется на сервер: API получает только ключ и ID аккаунта для активации.
