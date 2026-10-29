# Ledgerly (front end)

Ledgerly is a single-user personal expense tracker. You set a balance, top it up, and every expense you record
is taken off it. Built with React, Vite, Tailwind CSS and shadcn/ui on the Stitch design system.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

Requires Node 18 or newer.

## Routes

| Path | Page |
| --- | --- |
| `/` | Landing page (notebook layout with a live preview) |
| `/login`, `/signup` | Log in, create account (sign-up starts an empty ledger and asks for a starting balance) |
| `/app/dashboard` | Balance, to-do list, recent expenses, spending trend and category breakdown |
| `/app/wallet` | Available balance and full balance history (`?setup=1` opens "Add your balance") |
| `/app/expenses` | All expenses with filters (`?status=draft`, `?receipt=missing`), bulk pay and delete |
| `/app/income` | Money in by source and month, in vs out chart |
| `/app/categories` | Categories with monthly budgets, spend vs budget per month |
| `/app/settings`, `/app/support` | Profile, preferences, data controls; help and contact |

## Connecting to the API

The app needs the Ledgerly API (`ledgerly-api`) running. Start both, each in its own terminal:

```bash
# Terminal 1: the API (http://localhost:8000)
cd ledgerly-api && pipenv run flask run --debug

# Terminal 2: the React app (http://localhost:5173)
cd ledgerly-frontend && npm run dev
```

- The API address comes from `VITE_API_URL` (default `http://localhost:8000`). Copy `.env.example` to `.env` to change it.
- The API only accepts requests from the address in its `FRONTEND_ORIGIN` setting (`http://localhost:5173`).
  Open the app at exactly that address, not `127.0.0.1:5173`.
- Demo login (after `pipenv run flask seed-demo` in the API): `demo@ledgerly.app` / `Ledgerly2026`.

### How the pieces talk

| File | Job |
|---|---|
| `src/lib/api.js` | Every request: adds the login token, turns API errors into `ApiError` (message, `fields`, `reason`) |
| `src/lib/mappers.js` | Translates field names: `spent_on` ↔ `date`, `category_id` ↔ `category`, `"450.50"` ↔ `450.5`, … |
| `src/store/Auth.jsx` | Who is logged in: login, sign-up, sign-out, profile, password, delete account |
| `src/store/AppData.jsx` | The ledger: loads categories, income and expenses from the API; every change is saved to the API first |
| `src/components/layout/RequireAuth.jsx` | Sends guests from `/app/...` to the login page |

### Sign-in, links and debugging

- **Google / Microsoft buttons** appear on the login and sign-up pages only when the API has keys for them
  (see the API README). The API finishes the sign-in and returns to `/auth/callback#code=...`, which swaps the
  one-time code for a login token.
- **Email links** (`/verify-email#token=...`, `/reset-password#token=...`) and the sign-in code are read once and
  removed from the address bar immediately (`src/lib/linkToken.js`). `index.html` sets `referrer` to `no-referrer`.
- **Browser logs** (`src/lib/logger.js`): in development every API call appears in the browser console
  (F12 → Console) with its status, time and request id, e.g. `[ledgerly] POST /expenses → 409 (14 ms, request 1f29902107f9)`.
  Search the API's `logs/ledgerly.log` for that id to see what happened on the server. Secrets are removed.
- **Server errors** show a reference (the request id) in the message, so users can quote it.
- **Page crashes** are caught by `ErrorBoundary`: a calm message with a reference instead of a blank screen.

The balance rule is checked by the server: a paid expense larger than the balance comes back as a 409 with
`reason: "insufficient_balance"`, and the expense panel shows the shortfall.

## Currency

Set once in `src/data/wallet.js`:

```js
export const CURRENCY = "KES";
export const LOCALE = "en-KE"; // shows KES as "Ksh"
```

Use `formatMoney`, `formatWhole`, `formatCompact` and `currencySymbol` from `src/lib/utils.js` for every amount.

## Structure

```
src/
  components/
    ui/          shadcn/ui components restyled to the Stitch tokens
    layout/      AppLayout, Sidebar, Topbar, AuthLayout, MarketingLayout
    expenses/    ExpenseDrawer (new / edit expense side panel)
    wallet/      TopUpDialog (add balance / top up)
    shared/      Icon, Logo, StatusBadge, CategoryTag, SegmentedControl, Pagination, EmptyState, ...
  data/          wallet.js (currency, sources, payment methods), categories.js (icon list)
  lib/           api.js (requests), mappers.js (field names), logger.js, linkToken.js, forms.js, utils.js, ledger.js
  store/         Auth.jsx (who is logged in), AppData.jsx (the ledger, loaded from the API)
  pages/         Landing, Login, Signup, VerifyEmail, ForgotPassword, ResetPassword, OAuthCallback, NotFound
  pages/app/     Dashboard, Wallet, Expenses, Income, Categories, Settings, Support
```

## Landing page

The cover is a placeholder at `public/images/cover.svg`. Change `COVER_IMAGE` in `src/pages/Landing.jsx` to use a photo.

## Connecting the backend

Look for `TODO(backend)` comments. The setters in `src/store/AppData.jsx` are the single place to swap in API calls.
