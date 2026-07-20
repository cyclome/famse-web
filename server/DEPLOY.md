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

> **Note on the token:** because the page is public, the token is visible to anyone
> who views source — it only deters casual spam. Real protection = CORS (one origin),
> Caddy rate-limiting, the 256 KB cap, and the write-only store. For a
> per-participant allowlist (personal-link studies), validate the invitation token
> in `main.py` against an issued-token list instead of one shared token.

## 6. Retrieve / retain data
- Files land in `/opt/famse-receiver/data/*.json` (write-only from the web).
- Pull them over SSH: `scp famse@<host>:/opt/famse-receiver/data/*.json ./`
- Enable **Hetzner backups** (EU) and set a **retention/cleanup** policy per your ROPA.
