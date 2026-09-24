"""FAMSE web -- send the "take the test again" reminder email.

Run periodically (systemd timer, every few minutes -- see famse-reminder.timer).
Scans FAMSE_DATA_DIR for stored runs, and for each one with a screening email
that's now past its due time (session_start_wallclock + FAMSE_REMINDER_DELAY_MIN
minutes), sends one reminder email and marks it done.

Idempotent and safe to run repeatedly:
  - A `<file>.reminder_sent` sidecar marks a run as already handled.
  - A `<file>.reminder_attempts` counts SMTP failures; after
    FAMSE_REMINDER_MAX_ATTEMPTS we give up (so one bad address can't retry
    forever) and mark it sent anyway.
  - After a successful send, the plaintext email is scrubbed from the stored
    JSON (set to null) -- it has served its one purpose and there's no reason
    to keep it around (see README "Anonymous by design").

Config via env (same file as main.py, /etc/famse-receiver.env):
  FAMSE_DATA_DIR              where runs are stored             (default ./data)
  FAMSE_REMINDER_DELAY_MIN    minutes after session_start_wallclock (default 120 = 2h)
  FAMSE_REMINDER_MAX_ATTEMPTS give up after this many SMTP failures (default 5)
  FAMSE_SMTP_HOST             (default smtp.gmail.com)
  FAMSE_SMTP_PORT             (default 587)
  FAMSE_SMTP_USER             the sending account's address      (required)
  FAMSE_SMTP_PASSWORD         Gmail App Password (NOT the account password) (required)
  FAMSE_SMTP_FROM             display From: header (default = FAMSE_SMTP_USER)
"""
from __future__ import annotations

import json
import os
import smtplib
import sys
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from pathlib import Path

DATA_DIR = Path(os.environ.get("FAMSE_DATA_DIR", "data"))
DELAY_MIN = int(os.environ.get("FAMSE_REMINDER_DELAY_MIN", "120"))
MAX_ATTEMPTS = int(os.environ.get("FAMSE_REMINDER_MAX_ATTEMPTS", "5"))
SMTP_HOST = os.environ.get("FAMSE_SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("FAMSE_SMTP_PORT", "587"))
SMTP_USER = os.environ.get("FAMSE_SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("FAMSE_SMTP_PASSWORD", "")
SMTP_FROM = os.environ.get("FAMSE_SMTP_FROM", SMTP_USER)

SUBJECT = {"da": "Påmindelse: tag FAMSE-testen igen", "en": "Reminder: take the FAMSE test again"}
BODY = {
    "da": "Hej,\n\nDet er nu tid til at tage FAMSE-testen igen. Tag venligst testen her:\n"
    "https://famse.cyclome.dk\n\n(Brug samme deltager-kode som sidst, hvis du fik en.)\n\n"
    "Tak for din deltagelse!",
    "en": "Hi,\n\nIt's time to take the FAMSE test again. Please take it here:\n"
    "https://famse.cyclome.dk\n\n(Use the same participant code as last time, if you had one.)\n\n"
    "Thank you for participating!",
}


def send_email(to_addr: str, lang: str) -> None:
    lang = lang if lang in SUBJECT else "en"
    msg = EmailMessage()
    msg["Subject"] = SUBJECT[lang]
    msg["From"] = SMTP_FROM
    msg["To"] = to_addr
    msg.set_content(BODY[lang])
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as smtp:
        smtp.starttls()
        smtp.login(SMTP_USER, SMTP_PASSWORD)
        smtp.send_message(msg)


def due(session_start: str) -> bool:
    try:
        started = datetime.fromisoformat(session_start.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return False
    return datetime.now(timezone.utc) >= started + timedelta(minutes=DELAY_MIN)


def attempts_path(p: Path) -> Path:
    return p.with_suffix(p.suffix + ".reminder_attempts")


def sent_path(p: Path) -> Path:
    return p.with_suffix(p.suffix + ".reminder_sent")


def process(path: Path) -> None:
    if sent_path(path).exists():
        return
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return

    email = (data.get("screening") or {}).get("email")
    started = (data.get("run") or {}).get("session_start_wallclock")
    if not email or not started or not due(started):
        return

    n_attempts = 0
    ap = attempts_path(path)
    if ap.exists():
        try:
            n_attempts = int(ap.read_text().strip())
        except ValueError:
            n_attempts = 0

    try:
        send_email(email, data.get("lang", "en"))
    except Exception as exc:  # noqa: BLE001 -- log and retry (up to the cap) next run
        n_attempts += 1
        ap.write_text(str(n_attempts))
        print(f"  ! {path.name}: send failed (attempt {n_attempts}): {exc}", file=sys.stderr)
        if n_attempts >= MAX_ATTEMPTS:
            print(f"  ! {path.name}: giving up after {n_attempts} attempts", file=sys.stderr)
            sent_path(path).touch()
        return

    # Success: mark done, and scrub the plaintext email -- it has served its
    # one purpose (see module docstring / README "Anonymous by design").
    data["screening"]["email"] = None
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    sent_path(path).touch()
    if ap.exists():
        ap.unlink()
    print(f"  sent reminder for {path.name}")


def main() -> int:
    if not SMTP_USER or not SMTP_PASSWORD:
        print("FAMSE_SMTP_USER / FAMSE_SMTP_PASSWORD not set -- nothing to do.", file=sys.stderr)
        return 1
    count = 0
    for path in sorted(DATA_DIR.glob("*.json")):
        process(path)
        count += 1
    print(f"Checked {count} run(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
