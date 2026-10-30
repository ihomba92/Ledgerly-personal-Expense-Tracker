# Ledgerly — Personal Expense Tracker

**Know exactly how much money you have left, and where it went.**

Ledgerly is a personal expense tracker. You tell it how much money you have, record what you spend, and it keeps your balance up to date, warns you before you overspend, and shows you where your money goes each month. Amounts are shown in Kenyan shillings (Ksh) by default.

🔗 **Live app:** [ledgerly-personal-expense-tracker.vercel.app](https://ledgerly-personal-expense-tracker.vercel.app)
💻 **Code:** [github.com/ihomba92/Ledgerly-personal-Expense-Tracker](https://github.com/ihomba92/Ledgerly-personal-Expense-Tracker)

> The live API runs on a free plan that sleeps when nobody uses it. If the app is slow the first time you open it, wait about a minute while it wakes up.

---

## Contents

1. [How Ledgerly works](#how-ledgerly-works)
2. [What you can do](#what-you-can-do)
3. [How to use the app](#how-to-use-the-app)
4. [Tools and frameworks](#tools-and-frameworks)
5. [How the project is organised](#how-the-project-is-organised)
6. [Run it on your own computer](#run-it-on-your-own-computer)
7. [Tests](#tests)
8. [Deployment](#deployment)
9. [Security](#security)
10. [Known limitations and next steps](#known-limitations-and-next-steps)

---

## How Ledgerly works

Ledgerly works like a wallet:

- **Money in:** you add money to your balance, for example your salary, an M-Pesa transfer or cash.
- **Money out:** every expense you mark as **paid** is taken off your balance.
- **Drafts:** an expense saved as a **draft** (a bill you haven't paid yet) does **not** touch your balance until you pay it.

**Your balance = all money added − all paid expenses**

| What happened | Amount | Balance after |
|---|---|---|
| Salary added | + Ksh 85,000 | Ksh 85,000 |
| Rent paid | − Ksh 25,000 | Ksh 60,000 |
| Electricity bill saved as a draft | (Ksh 2,500) | Ksh 60,000, unchanged until paid |
| Groceries paid | − Ksh 4,650 | Ksh 55,350 |

Ledgerly never lets you **pay** an expense that is bigger than your balance. It tells you exactly how much you're short, so you can top up first or save the expense as a draft.

---

## What you can do

### 💰 Wallet and balance
- Set a starting balance, then top up whenever money comes in.
- See your balance, how much you've spent, and how much is waiting in drafts.
- View your full balance history: every top-up and payment, with the balance after each one.

### 🧾 Expenses
- Record an expense with a subject, shop or person paid, amount, category, payment method (M-Pesa, cash, card or bank), date and an optional note.
- Save it as **paid** (taken from your balance) or as a **draft** (to pay later).
- Attach a **receipt** (PDF, PNG or JPG, up to 15 MB), and view or remove it later.
- Search, filter (by status, category, payment method, month, or whether a receipt is attached) and sort your expenses.
- Select several expenses to **pay** or **delete** them at once.
- Delete by mistake? Use **Undo** (available when no receipt was attached).

### 📈 Income
- See all the money you've added, grouped by source: salary, M-Pesa, bank, business, cash or other.
- Compare money in and money out month by month.

### 🗂️ Categories and budgets
- Ten ready-made categories, such as Food & groceries, Transport and Rent & housing.
- Create your own categories with an icon and a **monthly budget**.
- Progress bars show how much of each budget you've used this month.
- Deleting a category is safe: its expenses move to "Other".

### 📊 Dashboard
- A greeting with your balance and a **to-do list**: drafts to pay, expenses missing receipts, budgets close to their limit, and how many days your money will last at your current spending (your "runway").
- Spending trend and category charts for this month, quarter or year.
- Recent expenses and quick shortcuts.

### 🔔 Notifications (the bell)
Ledgerly alerts you when something needs attention:

| Alert | When it appears |
|---|---|
| Budget warning | A category reaches **85%** of its monthly budget |
| Over budget | A category goes **over** its budget |
| Low balance | Your balance falls below **10%** of everything you've added |
| Security notice | Your password is changed or reset, or Google sign-in is added |
| Welcome | When you create your account |

Each alert appears only once, so you're never spammed. Click an alert to go straight to the right page. You can switch budget and low-balance alerts off in **Settings**.

### 👤 Account and settings
- **Sign up** with your email and confirm it from the link we email you. The link takes you straight to your dashboard.
- **Log in** with email and password, or with **Google**.
- **Forgot your password?** Get a reset link by email.
- Add a **profile photo**. It's cropped to a square, and hidden data such as GPS location is removed.
- Change your name, ledger name, currency, time zone and notification choices.
- Change your password, or set one if you signed up with Google.
- **Delete your account** and everything in it.

### 🆘 Support
- Answers to common questions, and a form to contact the team.

---

## How to use the app

1. **Create an account.** Open the [live app](https://ledgerly-personal-expense-tracker.vercel.app), click **Create account**, and enter your name, email and a password (at least 8 characters, with a capital letter and a number). Or click **Continue with Google**.
2. **Confirm your email.** Open the link in the email from Ledgerly. You'll be logged in and taken to your dashboard. (Signed up with Google? There's nothing to confirm.)
3. **Add your starting balance.** Ledgerly asks for it straight away. Enter how much money you have now and where it came from.
4. **Record expenses as you spend.** Click **New expense**, fill in the details, and choose **Save as paid** or **Save draft**.
5. **Set your budgets.** Go to **Categories & budgets** and type a monthly budget next to each category. Press **Enter** to save.
6. **Top up when money comes in.** Go to **Wallet** and click **Top up**.
7. **Check in regularly.** The **Dashboard** shows what needs attention, and the 🔔 bell tells you when you're close to a budget or running low.

---

## Tools and frameworks

### Frontend (what you see)
| Tool | What it does in Ledgerly |
|---|---|
| **React** | Builds the pages and interactive parts |
| **Vite** | Runs the app while developing and builds it for the web |
| **React Router** | Moves between pages (Dashboard, Wallet, Expenses…) |
| **Tailwind CSS** | Styling, following the design from Google Stitch |
| **shadcn/ui** (Radix UI) | Ready-made accessible parts: buttons, dialogs, menus, side panels |
| **React Hook Form + Zod** | Forms and checking what users type |
| **React Context** | Keeps the logged-in user and ledger data available to every page |

### Backend (the API)
| Tool | What it does in Ledgerly |
|---|---|
| **Python + Flask** | The API the app talks to (45 endpoints) |
| **PostgreSQL** | Stores all data |
| **SQLAlchemy + Alembic** | Talks to the database, and changes its structure safely through migrations |
| **Pydantic** | Checks every request and returns clear messages for each field |
| **bcrypt** | Protects passwords (stored only as one-way hashes) |
| **JWT** (Flask-JWT-Extended) | Keeps users logged in securely |
| **OAuth 2.0 / OpenID Connect** | "Continue with Google" (and Microsoft) sign-in |
| **Resend** | Sends confirmation and password-reset emails |
| **Flask-Limiter + Redis** | Blocks repeated attempts (5 logins per minute) |
| **Pillow** | Cleans and resizes profile photos |
| **pytest** | 72 automated tests |
| **Gunicorn** | Runs the API in production |

### Hosting
| Service | Used for |
|---|---|
| **Vercel** | The React app |
| **Render** | The Flask API, and Redis for rate limits |
| **Neon** | The PostgreSQL database |

---

## How the project is organised

```
Ledgerly-personal-Expense-Tracker/
├── ledgerly-frontend/      ← the React app (what users see)
│   ├── src/pages/          ← one file per page: Dashboard, Wallet, Expenses…
│   ├── src/components/     ← reusable parts: buttons, sidebar, bell, expense panel…
│   ├── src/store/          ← logged-in user and ledger data
│   ├── src/lib/            ← talking to the API, formatting money and dates
│   └── README.md           ← frontend details
│
├── ledgerly-api/           ← the Flask API (the "brain" and the database)
│   ├── app/api/            ← endpoints, one file per area (auth, expenses, categories…)
│   ├── app/models/         ← database tables
│   ├── app/services/       ← balance rule, emails, notifications, file storage, Google sign-in
│   ├── migrations/         ← history of database changes
│   ├── tests/              ← 72 automated tests
│   └── README.md           ← full API guide: every setting and endpoint
│
└── README.md               ← this file
```

---

## Run it on your own computer

You need **Python 3.11+**, **Node.js 18+**, **PostgreSQL** and **pipenv**. These steps assume Linux or WSL (Ubuntu).

### 1. Get the code
```bash
git clone https://github.com/ihomba92/Ledgerly-personal-Expense-Tracker.git
cd Ledgerly-personal-Expense-Tracker
```

### 2. Create the database
```bash
sudo service postgresql start
sudo -u postgres psql
```
In the PostgreSQL prompt (choose your own password, ideally letters and numbers only):
```sql
CREATE ROLE ledgerly WITH LOGIN PASSWORD 'choose-a-password' CREATEDB;
CREATE DATABASE ledgerly OWNER ledgerly;
CREATE DATABASE ledgerly_test OWNER ledgerly;
\q
```

### 3. Start the API (terminal 1)
```bash
cd ledgerly-api
pipenv install --dev
cp .env.example .env        # then open .env and fill in the values (see below)
pipenv run flask db upgrade # creates the tables
pipenv run flask seed-demo  # optional: demo account with sample data
pipenv run flask run --debug
```
In `.env`, set at least:
- `SECRET_KEY` and `JWT_SECRET_KEY`: two different random values. Generate each with `python3 -c "import secrets; print(secrets.token_hex(32))"`.
- `DATABASE_URL` and `TEST_DATABASE_URL`: use the password you chose in step 2.

Without a Resend key, emails are **printed in this terminal** instead of being sent, so you can copy confirmation links while testing.

Check it's running: open [http://localhost:8000/api/health](http://localhost:8000/api/health).

### 4. Start the app (terminal 2)
```bash
cd ledgerly-frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173). If you ran `seed-demo`, log in with **demo@ledgerly.app** / **Ledgerly2026**.

Every setting and endpoint is explained in [`ledgerly-api/README.md`](ledgerly-api/README.md).

---

## Tests

```bash
cd ledgerly-api
pipenv run pytest
```

The 72 tests run against a separate test database, so they never touch your data. They check, among other things:
- the balance rule, including two payments sent at the same moment;
- sign-up, email confirmation, login limits and password reset;
- Google and Microsoft sign-in, including fake and expired tokens;
- receipts and profile photos, including fake files;
- notifications;
- that one user can never see another user's data;
- that no password or token is ever written to the logs.

---

## Deployment

| Part | Where | Key settings |
|---|---|---|
| React app | **Vercel** | Root directory `ledgerly-frontend` · `VITE_API_URL` = the API's address · `vercel.json` sends every page to the React app |
| API | **Render** (Web Service) | Root directory `ledgerly-api` · Build: `pip install -r requirements.txt && flask --app wsgi db upgrade` · Start: `gunicorn -w 2 --timeout 60 -b 0.0.0.0:$PORT wsgi:app` |
| Database | **Neon** | `DATABASE_URL` starting with `postgresql+psycopg://` |
| Rate-limit store | **Render Key Value** | `RATELIMIT_STORAGE_URI` = its internal `redis://` address |

On Render, also set `APP_ENV=production`, `FRONTEND_ORIGIN` (the Vercel address), `API_BASE_URL`, `RESEND_API_KEY`, `TRUST_PROXY=1`, and the two secret keys. In production, the API refuses to start if an important setting is missing, and its message names the setting.

---

## Security

- **Passwords** are stored only as bcrypt hashes, never as plain text.
- **Logins** use signed tokens. Changing or resetting a password logs out every other device.
- **Email links** work once, expire, and are stored only as hashes. Their codes sit after a `#` in the link, so they are never sent to a server, and the app removes them from the address bar as soon as it reads them.
- **Google sign-in** uses PKCE, state and nonce checks, and verifies Google's signature on every sign-in.
- **Rate limits** allow 5 login attempts a minute, and limit password-reset and confirmation emails.
- **Privacy:** every request only reaches its own user's data. Other people's data looks as if it doesn't exist.
- **Uploads** are checked by their real content, not just their file name, and photos have their location data removed.
- **Logs** give every request an ID for easy debugging, and never contain passwords or tokens.

---

## Known limitations and next steps

- **Uploaded files on the free plan:** Render's free plan doesn't keep files between restarts, so receipts and profile photos can disappear. Next step: store files in cloud storage (Cloudflare R2 or AWS S3).
- **Emails:** until a domain is verified in Resend, confirmation emails only reach the Resend account owner's address.
- **Weekly spending summary:** shown in Settings as "coming soon".
- **Search in the top bar** isn't connected yet; search on the Expenses page works.
- **Planned:** push notifications to phones (Firebase).

---

## Author

**David Ihomba Kibandi**, Software Engineer, Nairobi, Kenya
[GitHub](https://github.com/ihomba92) · [LinkedIn](https://www.linkedin.com/in/david-kibandi/) · [davidihomba@gmail.com](mailto:davidihomba@gmail.com)
