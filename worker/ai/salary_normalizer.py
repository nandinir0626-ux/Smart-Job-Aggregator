import re
from typing import Optional, Tuple, Dict, Any

class SalaryNormalizer:
    """
    Standardizes compensation formats across multiple currencies (USD, EUR, GBP, INR)
    and frequencies (hourly, monthly, annual) into normalized Annual USD figures.
    """

    # Static baseline exchange rates (fallback without network dependency)
    RATES_TO_USD = {
        "USD": 1.0,
        "EUR": 1.09,
        "GBP": 1.30,
        "INR": 0.012,
        "CAD": 0.74,
        "AUD": 0.66
    }

    CURRENCY_SYMBOLS = {
        "$": "USD",
        "€": "EUR",
        "£": "GBP",
        "₹": "INR",
        "rs": "INR",
        "inr": "INR",
        "usd": "USD",
        "eur": "EUR",
        "gbp": "GBP"
    }

    @classmethod
    def normalize_salary(cls, salary_str: str, default_min: Optional[float] = None, default_max: Optional[float] = None) -> Dict[str, Any]:
        """
        Parses raw salary string or defaults and returns normalized annual USD structure.
        """
        if not salary_str and not default_min and not default_max:
            return {
                "currency": "USD",
                "annualMinUSD": None,
                "annualMaxUSD": None,
                "display": None
            }

        text = (salary_str or "").strip().lower()

        # 1. Detect Currency
        currency = "USD"
        for symbol, code in cls.CURRENCY_SYMBOLS.items():
            if symbol in text:
                currency = code
                break

        # 2. Detect LPA (Indian Lakhs Per Annum) e.g., "15 - 25 LPA"
        is_lpa = "lpa" in text or "lakh" in text or "lac" in text
        is_hourly = "/hr" in text or "hour" in text or "per hour" in text
        is_monthly = "/mo" in text or "month" in text or "per month" in text

        # 3. Extract numbers
        numbers = re.findall(r'\d+(?:[.,]\d+)?', text.replace(',', ''))
        min_val = default_min
        max_val = default_max

        if numbers:
            floats = [float(n) for n in numbers if float(n) > 0]
            if len(floats) == 1:
                min_val = floats[0]
            elif len(floats) >= 2:
                min_val = min(floats[0], floats[1])
                max_val = max(floats[0], floats[1])

        # Handle 'k' multiplier (e.g. 120k)
        if "k" in text and min_val and min_val < 1000:
            min_val *= 1000
            if max_val and max_val < 1000:
                max_val *= 1000

        # Adjust for Indian LPA
        if is_lpa:
            currency = "INR"
            if min_val and min_val < 100:
                min_val = min_val * 100000
            if max_val and max_val < 100:
                max_val = max_val * 100000

        # Adjust for hourly / monthly to annual
        if is_hourly:
            if min_val and min_val < 1000:
                min_val *= 2080  # 40 hrs/wk * 52 wks
            if max_val and max_val < 1000:
                max_val *= 2080
        elif is_monthly:
            if min_val and min_val < 50000:
                min_val *= 12
            if max_val and max_val < 50000:
                max_val *= 12

        # Convert to USD
        rate = cls.RATES_TO_USD.get(currency, 1.0)
        annual_min_usd = round(min_val * rate) if min_val else None
        annual_max_usd = round(max_val * rate) if max_val else None

        # Build clean display string
        display = None
        if annual_min_usd and annual_max_usd:
            display = f"${annual_min_usd // 1000}k - ${annual_max_usd // 1000}k / yr"
        elif annual_min_usd:
            display = f"${annual_min_usd // 1000}k+ / yr"
        elif annual_max_usd:
            display = f"Up to ${annual_max_usd // 1000}k / yr"

        return {
            "currency": currency,
            "annualMinUSD": annual_min_usd,
            "annualMaxUSD": annual_max_usd,
            "display": display
        }
