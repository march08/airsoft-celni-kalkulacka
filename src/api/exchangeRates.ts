export const CURRENCY_CODES = ['USD', 'EUR', 'TWD', 'HKD'] as const;

export type SupportedCurrencyCode = (typeof CURRENCY_CODES)[number];

export type ExchangeRates = Record<SupportedCurrencyCode, number>;

export const FALLBACK_RATES: ExchangeRates = {
  USD: 23.5,
  EUR: 25.2,
  TWD: 0.72,
  HKD: 3.0,
};

interface ExchangeRateApiResponse {
  result: string;
  rates: Record<string, number>;
}

export async function fetchExchangeRates(): Promise<ExchangeRates> {
  const response = await fetch('https://open.er-api.com/v6/latest/CZK');

  if (!response.ok) {
    throw new Error('Nepodařilo se načíst kurzy');
  }

  const data = (await response.json()) as ExchangeRateApiResponse;
  if (data.result !== 'success') {
    throw new Error('Nepodařilo se načíst kurzy');
  }

  const rates = {} as ExchangeRates;

  for (const code of CURRENCY_CODES) {
    const unitsPerCzk = data.rates[code];
    if (!unitsPerCzk || unitsPerCzk <= 0) {
      throw new Error(`Chybí kurz pro ${code}`);
    }
    rates[code] = 1 / unitsPerCzk;
  }

  return rates;
}
