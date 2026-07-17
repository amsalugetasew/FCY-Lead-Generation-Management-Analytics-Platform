from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend import crud, auth
from typing import Any, Dict
import backend.ai_client as ai_client
from backend.ai_utils import redact_pii
import os

router = APIRouter(prefix="/ai", tags=["AI"])


def _extract_text_from_llm_response(response: Any) -> str:
    if isinstance(response, str):
        return response.strip()
    if isinstance(response, dict):
        if "choices" in response and isinstance(response["choices"], list) and response["choices"]:
            first_choice = response["choices"][0]
            if isinstance(first_choice, dict):
                message = first_choice.get("message") or {}
                if isinstance(message, dict):
                    content = message.get("content")
                    if isinstance(content, str) and content.strip():
                        return content.strip()
        for key in ("content", "text", "message", "result", "answer"):
            value = response.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return str(response)


def _build_scope_context(db: Session, user: Any, scope: str, filters: Dict[str, Any] | None = None) -> str:
    filters = filters or {}
    if scope in {"dashboard", "dashboard_charts", "dashboard_stats"}:
        stats = crud.get_dashboard_stats(db, user=user)
        parts = [
            f"Scope: {scope}",
            f"Total leads: {stats['total_leads_generated']}",
            f"Total FCY volume: {stats['total_fcy_volume']}",
            f"Conversion rate: {stats['conversion_rate']}%",
        ]
        if filters:
            parts.append(f"Active filters: {filters}")
        return " | ".join(parts)
    if scope == "rankings":
        rank_by = filters.get("rank_by", "branch")
        rankings = crud.get_rankings(db, user=user, rank_by=rank_by, limit=5)
        top = rankings[0] if rankings else None
        return f"Scope: rankings | Rank by: {rank_by} | Top performer: {top['name'] if top else 'N/A'}"
    if scope == "leads":
        leads = crud.get_leads(db, user=user, limit=20)
        categories = ", ".join(list({l.category for l in leads})[:5])
        return f"Scope: leads | Lead count: {len(leads)} | Categories: {categories or 'N/A'}"
    return f"Scope: {scope}"


@router.post("/analysis")
def ai_analysis(payload: Dict[str, Any], db: Session = Depends(get_db), current_user=Depends(auth.get_current_user)):
    """Perform AI analysis over a requested scope. Payload expected keys:
    - scope: 'dashboard'|'rankings'|'leads'
    - intent: 'insights'|'recommendations'|'report'
    - filters: optional dict of filters
    """
    scope = payload.get("scope", "dashboard")
    intent = payload.get("intent", "insights")
    filters = payload.get("filters", {})

    # Basic summarizer (safe, no PII)
    if scope in {"dashboard", "dashboard_charts", "dashboard_stats"}:
        stats = crud.get_dashboard_stats(db, user=current_user)
        text = f"Total leads: {stats['total_leads_generated']}, Total FCY volume: {stats['total_fcy_volume']}. Conversion rate: {stats['conversion_rate']}%"
    elif scope == "rankings":
        rank_by = payload.get("rank_by", "branch")
        rankings = crud.get_rankings(db, user=current_user, rank_by=rank_by, limit=10)
        top = rankings[0] if rankings else None
        text = f"Top performer: {top['name'] if top else 'N/A'} with volume {top['volume'] if top else 0}."
    elif scope == "leads":
        leads = crud.get_leads(db, user=current_user, limit=50)
        text = f"Leads fetched: {len(leads)}; top categories: " + ", ".join(list({l.category for l in leads})[:3])
    elif scope in {"overview", "all"}:
        stats = crud.get_dashboard_stats(db, user=current_user)
        text = f"Executive overview: leads {stats['total_leads_generated']}, volume {stats['total_fcy_volume']}, conversion {stats['conversion_rate']}%."
    else:
        text = "No data available for the requested scope."

    # If an LLM provider is configured and user asked for augmented analysis, call it
    llm_provider = os.getenv("LLM_PROVIDER", "groq").lower()
    use_llm = payload.get("use_graq", True) and (
        (llm_provider == "local" and os.getenv("LOCAL_LLM_URL")) or
        (llm_provider == "groq" and os.getenv("GRAQ_API_URL") and os.getenv("GRAQ_API_KEY"))
    )
    if use_llm and intent in ("insights", "recommendations", "report"):
        # redact PII from text and filters before sending externally
        safe_text = redact_pii(text)
        sanitized_filters = {}
        if isinstance(filters, dict):
            for k, v in filters.items():
                sanitized_filters[k] = redact_pii(v)
        else:
            sanitized_filters = filters

        prompt = f"User intent: {intent}. Data summary: {safe_text}. Return concise actionable insights."
        try:
            llm_resp = ai_client.call_llm(prompt, extra={"scope": scope, "filters": sanitized_filters})
            return {"source": llm_provider, "result": _extract_text_from_llm_response(llm_resp)}
        except Exception as e:
            # fall back to local summary
            return {"source": "local", "result": text, "error": str(e)}

    return {"source": "local", "result": text}


@router.post("/chat")
def ai_chat(payload: Dict[str, Any], db: Session = Depends(get_db), current_user=Depends(auth.get_current_user)):
    message = payload.get("message", "")
    scope = payload.get("scope", "dashboard")
    messages = payload.get("messages", [])
    context = payload.get("context", {}) or {}
    llm_provider = os.getenv("LLM_PROVIDER", "groq").lower()

    filters = context.get("filters") if isinstance(context, dict) else None
    scope_context = _build_scope_context(db, current_user, scope, filters)
    safe_scope_context = redact_pii(scope_context)
    safe_message = redact_pii(message)

    history_lines = []
    for item in messages[-8:]:
        if isinstance(item, dict):
            role = item.get("role", "user")
            content = redact_pii(str(item.get("content", "")))
            history_lines.append(f"{role}: {content}")

    prompt = (
        "You are a helpful analytics assistant for an FCY lead generation platform. "
        "Answer the user's latest question using the current analytics context and the recent conversation history. "
        f"Context: {safe_scope_context}. "
        f"Conversation history: {' | '.join(history_lines) if history_lines else 'No previous messages.'}. "
        f"User question: {safe_message}. "
        "Return a concise but readable answer with bullets or short sections when useful."
    )

    if llm_provider == "local" and os.getenv("LOCAL_LLM_URL"):
        resp = ai_client.call_llm(prompt, extra={"chat": True, "scope": scope})
    elif llm_provider == "groq" and os.getenv("GRAQ_API_URL") and os.getenv("GRAQ_API_KEY"):
        resp = ai_client.call_llm(prompt, extra={"chat": True, "scope": scope})
    else:
        raise HTTPException(status_code=400, detail="No LLM provider configured")
    return {"source": llm_provider, "result": _extract_text_from_llm_response(resp)}
