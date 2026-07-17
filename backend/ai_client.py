import os
from pathlib import Path
from typing import Optional, Dict, Any
from dotenv import load_dotenv
import httpx

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env", override=False)

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "groq").lower()
GRAQ_API_URL = os.getenv("GRAQ_API_URL")
GRAQ_API_KEY = os.getenv("GRAQ_API_KEY")
LOCAL_LLM_URL = os.getenv("LOCAL_LLM_URL", "http://127.0.0.1:11434/v1/chat/completions")
LOCAL_LLM_MODEL = os.getenv("LOCAL_LLM_MODEL", "phi3")


def call_llm(prompt: str, extra: Optional[Dict[str, Any]] = None, timeout: int = 30) -> Dict[str, Any]:
    if LLM_PROVIDER == "local":
        if not LOCAL_LLM_URL:
            raise RuntimeError("Local LLM URL not configured. Set LOCAL_LLM_URL.")
        payload = {
            "model": LOCAL_LLM_MODEL,
            "messages": [{"role": "user", "content": prompt}],
        }
        if extra:
            payload["meta"] = extra
        with httpx.Client(timeout=timeout) as client:
            resp = client.post(LOCAL_LLM_URL, json=payload)
            resp.raise_for_status()
            return resp.json()

    if not GRAQ_API_URL or not GRAQ_API_KEY:
        raise RuntimeError("GROQ API not configured. Set GRAQ_API_URL and GRAQ_API_KEY.")

    endpoint = GRAQ_API_URL.rstrip("/")
    if not endpoint.endswith("/chat/completions"):
        endpoint = f"{endpoint}/chat/completions"

    model_name = os.getenv("GRAQ_MODEL", "llama-3.1-8b-instant").strip() or "llama-3.1-8b-instant"
    payload = {
        "model": model_name,
        "messages": [{"role": "user", "content": prompt}],
    }

    headers = {"Authorization": f"Bearer {GRAQ_API_KEY}", "Content-Type": "application/json"}
    with httpx.Client(timeout=timeout) as client:
        resp = client.post(endpoint, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.json()


def call_graq(prompt: str, extra: Optional[Dict[str, Any]] = None, timeout: int = 30) -> Dict[str, Any]:
    """
    Generic adapter to call Graq API. Requires GRAQ_API_URL and GRAQ_API_KEY env vars.
    The function posts a JSON {"prompt": ..., "meta": extra} and returns the JSON response.
    """
    if not GRAQ_API_URL or not GRAQ_API_KEY:
        raise RuntimeError("GRAQ API not configured. Set GRAQ_API_URL and GRAQ_API_KEY.")

    endpoint = GRAQ_API_URL.rstrip("/")
    if not endpoint.endswith("/chat/completions"):
        endpoint = f"{endpoint}/chat/completions"

    model_name = os.getenv("GRAQ_MODEL", "llama-3.1-8b-instant").strip() or "llama-3.1-8b-instant"
    payload = {
        "model": model_name,
        "messages": [{"role": "user", "content": prompt}],
    }

    headers = {"Authorization": f"Bearer {GRAQ_API_KEY}", "Content-Type": "application/json"}

    with httpx.Client(timeout=timeout) as client:
        resp = client.post(endpoint, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.json()
