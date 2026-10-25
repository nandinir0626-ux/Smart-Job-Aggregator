/**
 * Utility to normalize and format salary across currencies (USD, EUR, GBP, INR)
 * into standardized Annual USD benchmarks.
 */

const RATES_TO_USD = {
  USD: 1.0,
  EUR: 1.09,
  GBP: 1.30,
  INR: 0.012,
  CAD: 0.74,
  AUD: 0.66,
};

const normalizeSalary = (rawStr, minVal, maxVal) => {
  if (!rawStr && !minVal && !maxVal) {
    return null;
  }

  const text = (rawStr || '').toLowerCase();
  let currency = 'USD';

  if (text.includes('€') || text.includes('eur')) currency = 'EUR';
  else if (text.includes('£') || text.includes('gbp')) currency = 'GBP';
  else if (text.includes('₹') || text.includes('inr') || text.includes('rs') || text.includes('lpa')) currency = 'INR';

  let min = minVal;
  let max = maxVal;

  if (text.includes('lpa') || text.includes('lakh')) {
    currency = 'INR';
    if (min && min < 100) min *= 100000;
    if (max && max < 100) max *= 100000;
  }

  if (text.includes('/hr') || text.includes('hour')) {
    if (min && min < 1000) min *= 2080;
    if (max && max < 1000) max *= 2080;
  } else if (text.includes('/mo') || text.includes('month')) {
    if (min && min < 50000) min *= 12;
    if (max && max < 50000) max *= 12;
  }

  const rate = RATES_TO_USD[currency] || 1.0;
  const minUSD = min ? Math.round(min * rate) : null;
  const maxUSD = max ? Math.round(max * rate) : null;

  let display = null;
  if (minUSD && maxUSD) {
    display = `$${Math.round(minUSD / 1000)}k - $${Math.round(maxUSD / 1000)}k / yr`;
  } else if (minUSD) {
    display = `$${Math.round(minUSD / 1000)}k+ / yr`;
  } else if (maxUSD) {
    display = `Up to $${Math.round(maxUSD / 1000)}k / yr`;
  }

  return {
    currency,
    minUSD,
    maxUSD,
    display,
  };
};

module.exports = { normalizeSalary, RATES_TO_USD };
