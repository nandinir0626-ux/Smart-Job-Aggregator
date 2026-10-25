import re
from typing import Tuple, Dict

class PIIRedactor:
    """
    Strips Personally Identifiable Information (PII) such as phone numbers,
    physical addresses, and sensitive markers from resume text before sending
    to LLMs or external processing APIs.
    """

    # Comprehensive phone regex (international, US, with dashes, parens, plus)
    PHONE_REGEX = re.compile(
        r'(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}',
        re.VERBOSE
    )

    # Street address patterns (e.g. 123 Main St, Apt 4B, New York, NY 10001)
    ADDRESS_REGEX = re.compile(
        r'\b\d{1,5}\s+[A-Za-z0-9\s.,]{3,35}\b(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Apt|Suite|Unit|Floor|Fl)\b[A-Za-z0-9\s,.-]*',
        re.IGNORECASE
    )

    # Zip codes / Postal codes (US 5-digit/ZIP+4, UK postcodes, Indian 6-digit PIN)
    POSTAL_REGEX = re.compile(
        r'\b(?:\d{5}(?:-\d{4})?|[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}|\d{6})\b',
        re.IGNORECASE
    )

    # SSN / National IDs
    SSN_REGEX = re.compile(
        r'\b\d{3}[-\s]\d{2}[-\s]\d{4}\b'
    )

    # Personal URLs (LinkedIn, GitHub handles can be kept for tech credibility, but personal blogs/FB/Insta removed)
    SOCIAL_REGEX = re.compile(
        r'https?://(?:www\.)?(?:facebook|instagram|twitter|x\.com|tiktok)\.com/[A-Za-z0-9_.-]+',
        re.IGNORECASE
    )

    @classmethod
    def redact(cls, text: str) -> Tuple[str, Dict[str, int]]:
        """
        Redacts sensitive PII from text and returns cleaned text with audit count.
        Preserves candidate skills, experience, projects, and work history.
        """
        if not text:
            return "", {}

        stats = {
            "phones_redacted": 0,
            "addresses_redacted": 0,
            "postals_redacted": 0,
            "ssns_redacted": 0,
            "socials_redacted": 0
        }

        # Redact SSN
        text, stats["ssns_redacted"] = cls.SSN_REGEX.subn("[REDACTED_SSN]", text)

        # Redact Social Links
        text, stats["socials_redacted"] = cls.SOCIAL_REGEX.subn("[REDACTED_SOCIAL]", text)

        # Redact Addresses
        text, stats["addresses_redacted"] = cls.ADDRESS_REGEX.subn("[REDACTED_ADDRESS]", text)

        # Redact Postal codes
        text, stats["postals_redacted"] = cls.POSTAL_REGEX.subn("[REDACTED_POSTAL]", text)

        # Redact Phone numbers
        text, stats["phones_redacted"] = cls.PHONE_REGEX.subn("[REDACTED_PHONE]", text)

        return text, stats

_redactor = None

def get_pii_redactor() -> PIIRedactor:
    global _redactor
    if _redactor is None:
        _redactor = PIIRedactor()
    return _redactor
