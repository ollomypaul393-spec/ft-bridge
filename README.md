# FT Bridge — Fast Technology Dry Cleaner

One small server that does three things for the shop app:

| What | How | Cost |
|---|---|---|
| **Payment alerts** on the owner's phones & computers (even when everything is closed) | Push notifications through the **FT Alerts** app | Free |
| **Daily report** at 21:20 | Email through **Brevo** | Free (300 emails/day) |
| **Customer receipts** on WhatsApp | Meta WhatsApp Cloud API | Per message, billed by Meta |

Secrets live **only in Render → Environment**. Nothing secret goes in GitHub or in the app.

---

## 1. Put the code on GitHub
1. github.com → **New repository** → name `ft-bridge` → **Private** → Create.
2. **Add file → Upload files** → drag in everything from this folder (not `.env`) → Commit.
   GitHub checks every change automatically (Actions → CI).

## 2. Make the push keys (once)
On any computer with Node 20: `npm run keys` — or ask Claude to make them.
You get `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`. Keep the private one secret.

## 3. Deploy on Render
1. render.com → **New → Blueprint** → choose the `ft-bridge` repo → Apply.
2. Open the service → **Environment** and fill in:
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (step 2), `VAPID_SUBJECT` = `mailto:you@yourmail`
   - `BREVO_API_KEY`, `MAIL_FROM` (step 4)
   - `WA_TOKEN`, `WA_PHONE_ID` (step 5, only for WhatsApp receipts)
   - `APP_URL` = your shop app link
   - `BRIDGE_KEY` and `ALERTS_KEY` are filled in by Render automatically — just copy them.
3. Your address looks like `https://ft-bridge.onrender.com`. Check `https://ft-bridge.onrender.com/healthz` shows `ok`.

The Blueprint uses Render's **Free** plan — no card, no cost. It sleeps after 15 minutes without use and wakes by itself on the next alert (the first alert after a quiet spell can take about a minute). The shop app keeps a copy of your device list, so devices are not lost when it sleeps or restarts.

## 4. Brevo (daily report email)
brevo.com → sign up → **Senders & IPs → Senders** → add and verify your shop email (this is `MAIL_FROM`)
→ **SMTP & API → API keys → Generate** → put it in `BREVO_API_KEY`.

## 5. Meta WhatsApp (customer receipts)
developers.facebook.com → your app → WhatsApp → API setup. Use a **permanent System User token** (`WA_TOKEN`) and the **Phone number ID** (`WA_PHONE_ID`). Create the templates listed on the app's WhatsApp page and wait for approval.

## 6. Connect it to Claude
claude.ai → **Settings → Connectors → Add custom connector**
- Name: **FT Bridge** (exactly)
- URL: `https://ft-bridge.onrender.com/mcp/<BRIDGE_KEY>`

## 7. Turn on FT Alerts on every phone and computer
Open `https://ft-bridge.onrender.com/alerts/<ALERTS_KEY>` on each device (the app's **Settings → Owner alerts** shows this link and a QR code).
- **Android / Windows / Mac:** tap **Enable notifications** → Allow. Optionally *Install app*.
- **iPhone / iPad (iOS 16.4+):** Safari → **Share → Add to Home Screen**, open **FT Alerts** from the home screen, then tap **Enable notifications**.
- Tap **Send a test notification** to check.

Treat the alerts link like a password: anyone with it can sign a device up for your alerts.

## Releasing updates
Edit on GitHub → commit to `main` → Render redeploys by itself.
Raising the `version` in `package.json` makes GitHub publish a new release (`v<version>`) automatically after the tests pass.

## Tools the app uses (MCP)
`notify_owner`, `list_devices`, `send_email`, `send_template`, `send_text`, `check_setup`
