import re
from typing import Any


EMAIL_RE = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
PHONE_RE = re.compile(r"\b(?:\+?\d{1,3}[\s-]?)?(?:\(\d{1,4}\)[\s-]?)?\d{1,4}[\s-]?\d{1,4}[\s-]?\d{1,9}\b")
ID_RE = re.compile(r"\b\d{6,20}\b")


def redact_pii(value: Any) -> Any:
    """Redact obvious PII from strings. Non-strings are returned unchanged.

    This is intentionally conservative: it removes emails, phone-like numbers,
    and long numeric identifiers. It's not perfect but reduces obvious leaks.
    """
    if not isinstance(value, str):
        return value

    s = value
    s = EMAIL_RE.sub("[REDACTED_EMAIL]", s)
    s = PHONE_RE.sub("[REDACTED_PHONE]", s)
    s = ID_RE.sub("[REDACTED_ID]", s)
    return s
