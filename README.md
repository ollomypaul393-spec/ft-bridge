# Fast Technology Dry Cleaner

The whole shop system on your own address, **https://ft-bridge.onrender.com** — no Claude needed.

| Part | Where it runs | Cost |
|---|---|---|
| The app (orders, customers, finance, staff, reports…) | Render (free web service) | Free |
| Shop data | Neon Postgres | Free (0.5 GB) |
| Sign-in | Google, once per device, then PIN | Free |
| Payment & spot-check notifications | FT Alerts (web push) | Free |
| Daily report at 21:20 | Brevo email, started by GitHub Actions | Free |
| Customer receipts on WhatsApp | Meta WhatsApp Cloud API | Per message (Meta) |

Secrets live **only in Render → Environment** — never in GitHub.

---

## 1. Neon (database)
1. neon.tech → sign up → **Create project** (region: Europe / Frankfurt is closest to Render Frankfurt).
2. **Connect** → copy the connection string (`postgresql://…neon.tech/neondb?sslmode=require`). This is `DATABASE_URL`.
The app creates its table by itself.

## 2. Google sign-in
1. console.cloud.google.com → create a project “Fast Technology”.
2. **APIs & Services → OAuth consent screen** → External → app name *Fast Technology*, your email → Save. Then **Publish app**.
3. **Credentials → Create credentials → OAuth client ID** → *Web application*.
   **Authorized JavaScript origins:** `https://ft-bridge.onrender.com` (your real Render address).
4. Copy the **Client ID** (`…apps.googleusercontent.com`). This is `GOOGLE_CLIENT_ID`.

## 3. Render
1. render.com → **New → Blueprint** → repo **ft-bridge** → Blueprint name `fast-technology` → Apply.
2. Fill in: `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `ADMIN_EMAILS` (every admin's Gmail, separated by commas), `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, and later `BREVO_API_KEY`, `MAIL_FROM`, `WA_TOKEN`, `WA_PHONE_ID`. `SESSION_SECRET` and `ALERTS_KEY` are made by Render.
3. When it shows **Live**, open your address and sign in with the Gmail in `ADMIN_EMAILS` — you are the Admin.

If Render gives a different address (e.g. `fast-technology-ab12.onrender.com`), use that in Google step 3 and set it in GitHub → Settings → Secrets and variables → Actions → **Variables** → `SITE_URL`.

## 4. Workers
Admin → **Staff** → each worker → **Google email** (their Gmail) + **PIN** → Save.
On the worker's phone: open the address → Sign in with Google (once) → type their PIN. From then on the phone opens straight to their PIN screen. Removing the email or unticking “Currently working here” removes their access immediately.

Tip: on phones use **Add to Home Screen** so it opens like an app.

## 5. Payment notifications (FT Alerts)
App → **WhatsApp & alerts** → *Owner alerts* shows your FT Alerts link. Open it on each phone/computer → **Enable notifications** (iPhone: Share → Add to Home Screen first, then open FT Alerts from the home screen).

## 6. Daily report email (Brevo)
brevo.com → verify your sender email (`MAIL_FROM`) → **SMTP & API → API keys** → `BREVO_API_KEY`.
In the app tick **Email me the full daily report**, enter one or more addresses separated by commas (or leave it empty to send to every admin Gmail), Save, then **Send today's report now** to test. Each person gets their own copy.
GitHub Actions wakes the server at 21:20 every day (`.github/workflows/daily-report.yml`); the server sends at most one report a day.

## 7. WhatsApp receipts (Meta)
Permanent System User token → `WA_TOKEN`; Phone number ID → `WA_PHONE_ID`; create the templates shown on the app's WhatsApp page.

## Free plan notes
- The server sleeps after 15 minutes with nobody using it; the next visit takes up to a minute (the app shows “Starting the shop server…”). While the app is open it stays awake.
- Render gives 750 free hours a month per account, shared by all free services.

## Updates
Every push to `main` is tested and deployed automatically. Raising `version` in `package.json` publishes a GitHub release.

## Local run
`npm test` · `cp .env.example .env` and fill it · `node --env-file=.env src/server.js`
