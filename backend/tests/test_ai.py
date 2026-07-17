import os
from fastapi.testclient import TestClient
import backend.main as main_mod
import backend.ai_client as ai_client


client = TestClient(main_mod.app)


def test_ai_analysis_local_when_graq_not_configured(monkeypatch):
    # Ensure GRAQ env disabled
    os.environ.pop("GRAQ_API_URL", None)
    os.environ.pop("GRAQ_API_KEY", None)

    # Mock auth to bypass JWT requirement by overriding FastAPI dependency
    import backend.auth as auth_mod
    from types import SimpleNamespace
    def fake_current_user():
        return SimpleNamespace(id=1, username="testuser", level="Head Office", office_type="Head Office", region_id=None, district_id=None, branch_id=None)
    main_mod.app.dependency_overrides[auth_mod.get_current_user] = lambda: fake_current_user()

    resp = client.post("/api/ai/analysis", json={"scope": "dashboard", "intent": "insights"})
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("source") == "local"
    assert "result" in data


def test_ai_analysis_calls_graq_and_redacts(monkeypatch):
    os.environ["GRAQ_API_URL"] = "https://example.test/graq"
    os.environ["GRAQ_API_KEY"] = "testkey"

    captured = {}

    def fake_call_graq(prompt, extra=None, timeout=30):
        captured['prompt'] = prompt
        captured['extra'] = extra
        return {"mocked": True, "prompt_len": len(prompt)}

    monkeypatch.setattr(ai_client, "call_graq", fake_call_graq)

    # Mock auth to bypass JWT requirement by overriding FastAPI dependency
    import backend.auth as auth_mod
    from types import SimpleNamespace
    def fake_current_user():
        return SimpleNamespace(id=1, username="testuser", level="Head Office", office_type="Head Office", region_id=None, district_id=None, branch_id=None)
    main_mod.app.dependency_overrides[auth_mod.get_current_user] = lambda: fake_current_user()

    # include a filter that contains PII-like text
    resp = client.post("/api/ai/analysis", json={"scope": "rankings", "intent": "insights", "filters": {"notes": "Contact john.doe@example.com or +1 555 1234"}})
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("source") == "graq"
    assert data.get("result", {}).get("mocked") is True
    # prompt should not contain raw email; filters passed in extra should be redacted
    assert "@example.com" not in captured['prompt']
    assert captured['extra'] and captured['extra'].get('filters')
    note_val = captured['extra']['filters'].get('notes', '')
    assert "@example.com" not in note_val
    assert "REDACTED_EMAIL" in note_val or "[REDACTED_EMAIL]" in note_val
