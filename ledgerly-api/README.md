# Ledgerly API

The backend for Ledgerly, a personal expense tracker: one person, one ledger. You set a balance, top it up,
and every paid expense is taken off it.

**Stack:** Python 3.11+, Flask 3, PostgreSQL 16, SQLAlchemy 2 with Alembic migrations, bcrypt passwords,
JWT login tokens, sign-in with Google and Microsoft (OpenID Connect + PKCE), Pydantic validation, Resend email,
Flask-Limiter rate limits, structured logging, pytest.

---

## 1. First-time setup (WSL / Ubuntu)

### PostgreSQL

```bash
sudo apt update && sudo apt install postgresql postgresql-contrib
sudo service postgresql start          # run again after restarting your computer
sudo -u postgres psql
```

In the `psql` prompt (choose your own password):

```sql
CREATE ROLE ledgerly WITH LOGIN PASSWORD 'choose-a-password' CREATEDB;
CREATE DATABASE ledgerly OWNER ledgerly;
CREATE DATABASE ledgerly_test OWNER ledgerly;
\q
```

### Python packages (pipenv)

```bash
sudo apt install pipx && pipx ensurepath && pipx install pipenv   # once; then reopen the terminal
echo 'export PIPENV_VENV_IN_PROJECT=1' >> ~/.bashrc && source ~/.bashrc

cd ledgerly-api
pipenv install --dev        # app packages + pytest, exact versions from Pipfile.lock
cp .env.example .env
```

### Settings (`.env`)

Generate two secrets and paste them into `.env`:

```bash
pipenv run python -c "import secrets; print(secrets.token_hex(32))"   # SECRET_KEY
pipenv run python -c "import secrets; print(secrets.token_hex(32))"   # JWT_SECRET_KEY
```

Then set the database password in `DATABASE_URL` and `TEST_DATABASE_URL`.

| Setting | What it's for |
|---|---|
| `SECRET_KEY` | General signing secret |
| `JWT_SECRET_KEY` | Signs login tokens (keep it secret; changing it logs everyone out) |
| `DATABASE_URL` | `postgresql+psycopg://ledgerly:PASSWORD@localhost:5432/ledgerly` |
| `TEST_DATABASE_URL` | Same, ending in `/ledgerly_test`. Used only by the tests |
| `FRONTEND_ORIGIN` | The React app's address (`http://localhost:5173`). Email links point here |
| `RESEND_API_KEY` | Leave empty in development: emails are printed in the terminal instead |
| `EMAIL_FROM` | Sender. `onboarding@resend.dev` only reaches your own Resend account email |
| `SUPPORT_EMAIL` | Optional: support messages are also emailed here |
| `RATELIMIT_STORAGE_URI` | `memory://` in development, `redis://...` in production |
| `UPLOAD_FOLDER` | Optional: where receipt files are saved (default `instance/uploads`) |
| `TRUST_PROXY` | `1` in production behind a proxy or load balancer |
| `LOG_LEVEL` / `LOG_FORMAT` / `LOG_FILE` | `INFO`, `text` and `logs/ledgerly.log` by default (see Logging) |
| `API_BASE_URL` | The API's own address, used for Google/Microsoft redirect URLs |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional: turns on "Continue with Google" |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_TENANT` | Optional: turns on "Continue with Microsoft" |

### Create the tables and a demo account

```bash
pipenv run flask db upgrade      # builds every table from the migrations
pipenv run flask seed-demo       # demo@ledgerly.app / Ledgerly2026, with two months of data
```

## 2. Everyday commands

| Command | What it does |
|---|---|
| `pipenv run flask run --debug` | Start the API at http://localhost:8000 (restarts on save) |
| `pipenv run pytest` | Run all automated tests (uses `ledgerly_test`, never your data) |
| `pipenv run flask db migrate -m "what changed"` | After changing a model: write a new migration |
| `pipenv run flask db upgrade` | Apply new migrations |
| `pipenv run flask seed-demo` | Rebuild the demo account |
| `pipenv install <package>` | Add a package (updates Pipfile and Pipfile.lock) |

Check it's running: http://localhost:8000/api/health → `{"status": "ok", ..., "database": "ok"}`

## 3. How the API works

- **Login token:** `POST /api/auth/login` returns `access_token`. Send it on every other request:
  `Authorization: Bearer <token>`. It lasts 1 day, or 30 days with `"remember_me": true`.
- **Money:** amounts are sent and returned as strings with 2 decimals (`"450.50"`), stored as whole cents.
- **Balance rule:** balance = all top-ups − all **paid** expenses. Drafts don't count until paid.
  A paid expense larger than the balance is refused with `409` and `reason: "insufficient_balance"`.
  The check locks the account row, so two simultaneous payments can't overspend.
- **Errors** always have the same shape:

  ```json
  {"error": {"code": 422, "name": "Validation Error", "message": "Some fields need attention.",
             "fields": {"amount": "Use at most 2 decimal places."}, "reason": "optional_fixed_word"}}
  ```

  | Code | Meaning |
  |---|---|
  | 400 | Bad request (e.g. invalid or expired email link) |
  | 401 | Not logged in, or the login has ended |
  | 403 | Email not confirmed yet, or wrong password on a sensitive action |
  | 404 | Not found (also used for other people's data) |
  | 409 | Breaks a rule: duplicate, not enough balance, can't delete "Other" |
  | 413 / 415 | Receipt too large / not a PDF, PNG or JPG |
  | 422 | Validation failed: see `fields` |
  | 429 | Too many attempts: wait and try again |

## 4. Sign in with Google and Microsoft

A button appears in the app only when its client id and secret are set. Without them, everything else works.

**Google** (https://console.cloud.google.com)
1. Create a project, then **APIs & Services → OAuth consent screen**: choose *External*, fill in the app name
   (Ledgerly) and your email, add the scopes `openid`, `email`, `profile`, and add yourself as a test user.
2. **Credentials → Create credentials → OAuth client ID → Web application.**
   Authorized redirect URI: `http://localhost:8000/api/auth/oauth/google/callback`
3. Copy the client id and secret into `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then restart Flask.

**Microsoft** (https://entra.microsoft.com)
1. **App registrations → New registration.** Supported account types: *Accounts in any organizational directory
   and personal Microsoft accounts*. Redirect URI (platform *Web*):
   `http://localhost:8000/api/auth/oauth/microsoft/callback`
2. Copy the **Application (client) ID** into `MICROSOFT_CLIENT_ID`.
3. **Certificates & secrets → New client secret**; copy its *Value* (not the id) into `MICROSOFT_CLIENT_SECRET`.
4. **Token configuration → Add optional claim → ID → `email`.** Restart Flask.

**How it's kept safe**
- Authorization Code flow with **PKCE**, plus **state** (stops other sites starting a sign-in for you) and
  **nonce** (stops replayed tokens). The ID token's signature, audience, issuer and expiry are verified
  against the provider's published keys.
- Only emails the provider has **confirmed** are trusted. For Microsoft that means personal accounts or
  verified domains; other work accounts are refused, because their email field can be set to anything.
- The same Google/Microsoft account always signs into the same user. A new one with a confirmed email that
  already has a Ledgerly account is linked to it; otherwise a new account is created.
- The login is handed to the React app with a **one-time code** (2 minutes, stored hashed) after `#`
  in the URL, swapped for the login token by a POST. No login token ever appears in a URL.
- Accounts created this way have no password until they set one in Settings.

## 5. Links, tokens and URLs

- Email links look like `/verify-email#token=...` and `/reset-password#token=...`. The part after `#` is
  never sent to any server or in Referer headers, and the React page removes it from the address bar as soon
  as it has read it. Old `?token=` links still work.
- The database stores only a SHA-256 hash of every link token and sign-in code; each works once and expires.
- Every API response sends `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, `X-Frame-Options: DENY`
  and `X-Content-Type-Options: nosniff`.

## 6. Logging

Every request gets an id. It's sent back in the `X-Request-ID` header and included in every error body as
`request_id`, so a problem someone reports can be found in the log straight away:

```
2026-10-29 07:04:28 WARNING [req e20562a59d91 · user -] ledgerly.auth: Login failed for d***@ledgerly.app: wrong password
2026-10-29 07:04:28 INFO    [req 1f29902107f9 · user 04c635ba-…] ledgerly.ledger: Payment refused: needs 500000000 cents, 11310100 cents available
2026-10-29 07:04:28 INFO    [req 1f29902107f9 · user 04c635ba-…] ledgerly.request: POST /api/expenses -> 409 (12.3 ms)
```

| Logger | What it records |
|---|---|
| `ledgerly.request` | One line per request: method, path, status, time |
| `ledgerly.auth` | Sign-ups, confirmations, logins (failed ones with the reason), resets, Google/Microsoft sign-ins |
| `ledgerly.ledger` | Expenses, payments, refused payments, top-ups, receipts |
| `ledgerly.email` | Emails sent or not sent through Resend |
| `ledgerly.errors` | Rate limits and unexpected errors (with the full traceback) |

- Logs go to the console and to `logs/ledgerly.log` (rotated at 5 MB, 5 files kept).
- `LOG_LEVEL=DEBUG` for more detail; `LOG_FORMAT=json` for log services in production.
- **No secrets are logged:** tokens, passwords, sign-in codes and JWTs are removed, and emails appear
  masked (`j***@example.com`).
- In development without a Resend key, emails are printed to the terminal as an **EMAIL PREVIEW**
  (so you can copy the link) but never written to the log file.

Find everything about one request: `grep 1f29902107f9 logs/ledgerly.log`

## 7. Endpoints

All paths start with `/api`. 🔒 = needs the login token.

### Accounts

| Method | Path | Body / notes |
|---|---|---|
| POST | `/auth/register` | `full_name`, `email`, `password` → sends a confirmation email (no token yet) |
| POST | `/auth/verify-email` | `token` from the email link → **logs the user in** (returns `access_token`) |
| POST | `/auth/resend-verification` | `email` · limit 3 per 15 min |
| POST | `/auth/login` | `email`, `password`, `remember_me` · **limit 5 per minute** · 403 if email not confirmed |
| GET | `/auth/me` 🔒 | The logged-in user |
| PATCH | `/auth/me` 🔒 | Any of `full_name`, `ledger_name`, `currency`, `timezone`, `notify_low_balance`, `notify_budget`, `weekly_digest` |
| POST | `/auth/change-password` 🔒 | `current_password` (not needed if the account has no password yet), `new_password` → new token |
| DELETE | `/auth/me` 🔒 | `password`, or `confirm_email` for accounts without a password → deletes everything |
| POST | `/auth/forgot-password` | `email` → emails a 30-minute reset link · limit 3 per 15 min |
| POST | `/auth/reset-password` | `token`, `password` → all devices logged out |
| GET | `/auth/oauth/providers` | Which sign-in buttons to show |
| GET | `/auth/oauth/<google\|microsoft>/start` | Opened by the browser (`?remember=1` for 30 days) |
| GET | `/auth/oauth/<google\|microsoft>/callback` | Google/Microsoft return here; redirects to the app |
| POST | `/auth/oauth/exchange` | `code` → login token (`is_new_user` tells the app to ask for a balance) |

### Ledger 🔒

| Method | Path | Body / notes |
|---|---|---|
| GET | `/balance` | `topped_up`, `spent`, `drafts`, `balance` |
| GET | `/summary?month=YYYY-MM` | Dashboard: spent vs last month, daily totals, categories with budgets, to-do counts, runway |
| GET | `/reports/monthly?months=6` | Money in vs out per month |
| GET | `/categories?month=YYYY-MM` | Categories with that month's spending and budget status |
| POST | `/categories` | `label`, `icon`, `budget` |
| PATCH / DELETE | `/categories/<id>` | Deleting moves its expenses to "Other" ("Other" can't be deleted) |
| GET | `/top-ups?source=&month=&page=&per_page=` | Income, newest first, with `total` |
| POST | `/top-ups` | `amount`, `source` (salary, mpesa, bank, business, cash, other), `received_on`, `note` |
| PATCH / DELETE | `/top-ups/<id>` | Refused if the balance would go below zero |
| GET | `/expenses?status=&category_id=&method=&receipt=&month=&q=&sort=&page=&per_page=` | With `total` and `pagination` |
| POST | `/expenses` | `subject`, `merchant`, `amount`, `category_id`, `method`, `status` (paid/draft), `spent_on`, `note` |
| GET / PATCH / DELETE | `/expenses/<id>` | Editing re-checks the balance; deleting a paid one refunds it |
| POST | `/expenses/<id>/pay` | Pay a draft from the balance |
| POST | `/expenses/pay` | `ids` → pay several drafts (all or nothing) |
| POST | `/expenses/delete` | `ids` → delete several |
| POST | `/expenses/<id>/receipt` | Multipart form field `file` (PDF, PNG, JPG, ≤ 15 MB). Replaces any existing receipt |
| GET / DELETE | `/expenses/<id>/receipt` | Download / remove |
| POST | `/support-requests` | `topic`, `subject`, `message` · limit 5 per hour |
| GET | `/health` | API and database status (no login needed) |

## 8. Project layout

```
app/
  __init__.py        create_app(): settings, database, JWT, CORS, rate limits, routes
  config.py          development / production / testing settings
  extensions.py      db, migrate, jwt, limiter, cors
  database.py        model base class and constraint naming rules
  models/            tables: users, categories, top_ups, expenses, receipts, support_requests, email tokens
  schemas/           request rules (Pydantic)
  api/               endpoints, one file per area
  services/          ledger (balance rule), email (Resend), storage (receipt files), oauth (Google/Microsoft)
  security.py        bcrypt hashing
  logging_setup.py   request ids, per-request lines, secret removal, log file
  validation.py      turns validation errors into clear per-field messages
  money.py           shillings <-> cents
  cli.py             flask seed-demo
migrations/          database history (commit it)
tests/               pytest suite
wsgi.py              entry point for flask and gunicorn
```

## 9. Production notes

- Set `APP_ENV=production`. The app refuses to start without real `SECRET_KEY` / `JWT_SECRET_KEY`,
  `DATABASE_URL`, `RESEND_API_KEY` and a Redis `RATELIMIT_STORAGE_URI`.
- Run with gunicorn: `pipenv run gunicorn -w 3 -b 0.0.0.0:8000 wsgi:app`
- Set `TRUST_PROXY=1` behind a proxy, `FRONTEND_ORIGIN` to the live site, and verify your sending domain in Resend.
- Set `API_BASE_URL` to the live API address and add the live callback URLs in Google and Microsoft.
  The sign-in cookie is marked Secure automatically in production, so the API must use HTTPS.
- Consider `LOG_FORMAT=json` and shipping `logs/` to a log service.
- Store receipts on a persistent disk (`UPLOAD_FOLDER`) and back up the database.
