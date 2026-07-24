"""Tests for the FAMSE receiver. Run: cd server && python -m pytest -q"""
import importlib
import os
import pathlib
import tempfile

os.environ["FAMSE_DATA_DIR"] = tempfile.mkdtemp(prefix="famse_test_")
os.environ["FAMSE_TOKEN"] = "secret123"

import main  # noqa: E402
importlib.reload(main)
from fastapi.testclient import TestClient  # noqa: E402

c = TestClient(main.app)
AUTH = {"Authorization": "Bearer secret123"}


def _files():
    return list(pathlib.Path(os.environ["FAMSE_DATA_DIR"]).glob("*.json"))


def test_health():
    assert c.get("/health").json()["ok"] is True


def test_rejects_missing_token():
    assert c.post("/famse", json={"anon_token": "a"}).status_code == 401


def test_stores_valid_run():
    before = len(_files())
    r = c.post("/famse", json={"anon_token": "abc123", "screening": {"age": 30}}, headers=AUTH)
    assert r.status_code == 200 and r.json()["stored"] is True
    assert len(_files()) == before + 1


def test_rejects_bad_json():
    r = c.post("/famse", content="not json",
               headers={**AUTH, "Content-Type": "application/json"})
    assert r.status_code == 400


def test_rejects_oversize():
    big = {"anon_token": "x", "blob": "y" * 300000}
    assert c.post("/famse", json=big, headers=AUTH).status_code == 413


def test_no_list_route():
    # Write-only: there is no way to read back data.
    assert c.get("/famse").status_code in (404, 405)


def test_bank_404_when_unconfigured():
    # FAMSE_BANK_FILE is not set in tests → /bank is disabled.
    assert c.get("/bank").status_code == 404
