# FAMSE receiver — deploy on an EU-owned VPS (option 5)

A tiny **write-only** HTTPS endpoint that stores the web app's anonymous JSON.
EU-owned host (e.g. **Hetzner**, DE/FI) → ISO 27001 + a signed data-processor
agreement, and **no Schrems II** issue (not US-owned).

## 0. Compliance first
- In the Hetzner console, sign the **Auftragsverarbeitungsvertrag / Data Processing
  Agreement (AVV/DPA)** (Legal → Data processing). Hetzner is **ISO/IEC 27001** certified.
- Pick an **EU location** (Nuremberg/Falkenstein DE, or Helsinki FI).
- Note in your ROPA: processor = Hetzner (EU), data = anonymous/pseudonymous FAMSE runs,
  retention = <your policy>, no PII by design.
- **IP-free logs:** the `Caddyfile` strips client IPs from access logs, and uvicorn only
  ever sees `127.0.0.1` (the proxy) — so no visitor IPs are stored anywhere.
- In the Hetzner DPA form: check **Log data**, add a custom data type
  *"pseudonymous/anonymous research data (cognitive test + short screening)"*, and add
  affected people *"research study participants"*; download both PDFs for your file.

## 1. Server
- Create an **Ubuntu 24.04** server (CX22 is plenty). Add your SSH key. IPv4 (+IPv6).
- **DNS** (on `cyclome.dk`): `A  api.famse.cyclome.dk → <server IPv4>` (and `AAAA → <IPv6>`).
- **Firewall** (Hetzner Cloud Firewall or ufw): allow **22** (ideally from your IP only),
  **80**, **443**; deny the rest.

## 2. Install
```bash
sudo apt update && sudo apt install -y python3-venv git
# Caddy (official repo) — automatic HTTPS
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

sudo useradd -r -m -d /opt/famse-receiver famse
sudo -u famse mkdir -p /opt/famse-receiver/app /opt/famse-receiver/data
# copy this server/ folder to /opt/famse-receiver/app
sudo -u famse python3 -m venv /opt/famse-receiver/.venv
sudo -u famse /opt/famse-receiver/.venv/bin/pip install -r /opt/famse-receiver/app/requirements.txt
```

## 3. Config (secrets stay off git)
```bash
sudo tee /etc/famse-receiver.env >/dev/null <<'EOF'
FAMSE_DATA_DIR=/opt/famse-receiver/data
FAMSE_ALLOWED_ORIGIN=https://famse.cyclome.dk
FAMSE_TOKEN=<generate a long random string>
FAMSE_MAX_BYTES=262144
EOF
sudo chmod 600 /etc/famse-receiver.env
```

## 4. Service + proxy
```bash
sudo cp /opt/famse-receiver/app/famse-receiver.service /etc/systemd/system/
sudo systemctl enable --now famse-receiver

sudo cp /opt/famse-receiver/app/Caddyfile /etc/caddy/Caddyfile   # edit domain if needed
sudo systemctl reload caddy    # provisions the TLS cert automatically
```
Check: `curl https://api.famse.cyclome.dk/health` → `{"ok":true}`.

## 5. Point the web app at it
In `config.js`:
```js
endpoint: "https://api.famse.cyclome.dk/famse",
endpointToken: "<same FAMSE_TOKEN>",   // light deterrent (public page → not strong auth)
```
Commit + push; GitHub Pages redeploys. A finished run now POSTs its JSON here.

> **Note on the token:** the page is public, so the token is visible via view-source — it
> only deters casual spam. Real protection = CORS (one origin), Caddy rate-limiting, the
> 256 KB cap, and the write-only store. For a per-participant allowlist, validate the
> invitation token in `main.py` against an issued-token list instead of one shared token.

## 5b. Serve the app's stimulus bank (updatable sequences)

The native app fetches its bank from `GET /bank` and caches it, so you can update
sequences **without an app rebuild** — just replace one file.

```bash
# add to /etc/famse-receiver.env:
#   FAMSE_BANK_FILE=/opt/famse-receiver/bank.json
sudo sed -i '/^FAMSE_MAX_BYTES/a FAMSE_BANK_FILE=/opt/famse-receiver/bank.json' /etc/famse-receiver.env

# publish the bank (from your PC, the generator output):
#   scp dawoe/tools/generator/dist/sequences.json tfh@<host>:/tmp/bank.json
sudo mv /tmp/bank.json /opt/famse-receiver/bank.json
sudo chown famse:famse /opt/famse-receiver/bank.json

sudo systemctl restart famse-receiver
curl -s https://api.famse.cyclome.dk/bank | head -c 120; echo    # should be the bank JSON
```

**To update sequences later:** regenerate, `scp` the new `sequences.json` over
`/opt/famse-receiver/bank.json` (bump `bank_version` in the generator), done —
apps pick it up next launch. No restart needed (read per request).

## 6. Retrieve / retain data
- Files land in `/opt/famse-receiver/data/*.json` (write-only from the web).
- Pull them over SSH: `scp famse@<host>:/opt/famse-receiver/data/*.json ./`
- Enable **Hetzner backups** (EU) and set a **retention/cleanup** policy per your ROPA.

## 7. Reminder emails (optional screening question)

The screening's `email` field (optional, `config.js`) is used for exactly one
thing: a reminder to take the test again, sent `FAMSE_REMINDER_DELAY_MIN`
minutes (default 120 = 2h) after `run.session_start_wallclock`. A systemd
timer runs `send_reminders.py` every 5 minutes; once an email is sent it's
**scrubbed from the stored JSON** (set to `null`) — see the script's
docstring. No new Python dependency (stdlib `smtplib` only).

**Create a dedicated study Gmail account** (don't reuse a personal one) and
an **App Password** for it: Google Account → Security → 2-Step Verification
(must be on) → App passwords → generate one for "Mail". Copy the 16-character
password — that's `FAMSE_SMTP_PASSWORD` below, not the account's login password.

```bash
# add to /etc/famse-receiver.env:
sudo tee -a /etc/famse-receiver.env >/dev/null <<'EOF'
FAMSE_REMINDER_DELAY_MIN=120
FAMSE_SMTP_HOST=smtp.gmail.com
FAMSE_SMTP_PORT=587
FAMSE_SMTP_USER=<the study Gmail address>
FAMSE_SMTP_PASSWORD=<the 16-character App Password, no spaces>
FAMSE_SMTP_FROM=FAMSE Study <the study Gmail address>
EOF

sudo cp /opt/famse-receiver/app/famse-reminder.service /etc/systemd/system/
sudo cp /opt/famse-receiver/app/famse-reminder.timer /etc/systemd/system/
sudo systemctl enable --now famse-reminder.timer

# verify: run one pass by hand and read the log
sudo systemctl start famse-reminder.service
sudo journalctl -u famse-reminder.service -n 20 --no-pager
```

**To disable:** `sudo systemctl disable --now famse-reminder.timer` — existing
stored emails are untouched either way; only a successful send scrubs one.
