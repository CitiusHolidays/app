/** Parses a typed amount ("1,250.50"); null unless it is a positive number with up to 2 decimals. */
export function parseAmount(text: string) {
  const normalized = text.replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Number(normalized);
  return value > 0 ? value : null;
}

export function formatMoney(amount: number, currency: string, locale?: string) {
  try {
    return new Intl.NumberFormat(locale, { currency, style: 'currency' }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
