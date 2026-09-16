// Convert between MYR and IDR using kurs as 1 MYR = X IDR.

export function convertExpenseAmounts(price, currency, kurs) {
  return currency === 'MYR'
    ? { priceMyr: price, priceIdr: price * kurs, exchangeRateUsed: kurs }
    : { priceMyr: price / kurs, priceIdr: price, exchangeRateUsed: kurs };
}

export function convertAmountForSwap(amount, fromCurrency, toCurrency, kurs) {
  if (fromCurrency === toCurrency) return amount;
  const converted = convertExpenseAmounts(amount, fromCurrency, kurs);
  return toCurrency === 'IDR' ? converted.priceIdr : converted.priceMyr;
}

export function invertKursQuote(value) {
  return 1 / value;
}

export function toMyrToIdrKurs(value, quote) {
  return quote === 'IDR_MYR' ? invertKursQuote(value) : value;
}
