"""FAMSE web — write-only receiver for anonymous/pseudonymous run data.

Design: accept a JSON POST from the FAMSE web page, validate size + JSON, and
append it to a write-only file store. There is deliberately NO read/list route.
Runs on an EU-owned VPS (option 5) behind Caddy (HTTPS). Config via env:

  FAMSE_DATA_DIR        where to write JSON files          (default ./data)
  FAMSE_ALLOWED_ORIGIN  CORS origin for the web page       (default https://famse.cyclome.dk)
  FAMSE_TOKEN           if set, require Authorization: Bearer <token> (light spam deterrent —
                        NOT strong auth, since a public web page's token is visible to anyone)
  FAMSE_MAX_BYTES       max request body                   (default 262144 = 256 KB)
  FAMSE_BANK_FILE       path to bank.json served at GET /bank (blank = disabled)

Security model for a public endpoint: CORS limits browsers to the one origin,
Caddy does rate-limiting/TLS, bodies are size-capped and never executed, and the
store is write-only. For a per-participant allowlist (personal-link studies),
extend the token check to validate against an issued-token list.
"""
from __future__ import annotations

import json
import os
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

DATA_DIR = Path(os.environ.get("FAMSE_DATA_DIR", "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_ORIGIN = os.environ.get("FAMSE_ALLOWED_ORIGIN", "https://famse.cyclome.dk")
TOKEN = os.environ.get("FAMSE_TOKEN", "")
MAX_BYTES = int(os.environ.get("FAMSE_MAX_BYTES", "262144"))
BANK_FILE = os.environ.get("FAMSE_BANK_FILE", "")

app = FastAPI(title="FAMSE receiver", docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[ALLOWED_ORIGIN],
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    allow_credentials=False,
    max_age=86400,
)


def _safe(s: str, n: int) -> str:
    return "".join(c for c in str(s)[:n] if c.isalnum() or c in "-_")


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/bank")
def bank():
    """Serve the current stimulus bank so apps can update sequences without a
    rebuild. Read from disk each request → replace the file to publish an update.
    Not participant data (it is the test design)."""
    if not BANK_FILE:
        raise HTTPException(status_code=404, detail="no bank configured")
    p = Path(BANK_FILE)
    if not p.exists():
        raise HTTPException(status_code=404, detail="bank not found")
    return JSONResponse(json.loads(p.read_text(encoding="utf-8")))


@app.post("/famse")
async def famse(request: Request, authorization: str | None = Header(default=None)):
    if TOKEN and authorization != f"Bearer {TOKEN}":
        raise HTTPException(status_code=401, detail="unauthorized")

    body = await request.body()
    if len(body) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="payload too large")
    try:
        data = json.loads(body)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid JSON")
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="expected a JSON object")

    # Server-generated filename (never trust the client for paths).
    ts = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    fid = uuid.uuid4().hex[:12]
    token = _safe(data.get("anon_token", ""), 40)
    name = f"{ts}_{fid}{('_' + token) if token else ''}.json"
    (DATA_DIR / name).write_bytes(body)
    return JSONResponse({"stored": True})
