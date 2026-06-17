import { useEffect, useMemo, useState } from 'react';
import styles from './App.module.css';

const VAT_RATE = 0.21;
const TAX_RATE = 0.03;
const HANDLING_FEE_CZK = 350;

const CURRENCIES = ['USD', 'TWD', 'HKD'];

const FALLBACK_RATES = {
  USD: 23.5,
  TWD: 0.72,
  HKD: 3.0,
};

function formatCzk(value) {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRate(value) {
  return new Intl.NumberFormat('cs-CZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

export default function App() {
  const [currency, setCurrency] = useState('TWD');
  const [price, setPrice] = useState('');
  const [rates, setRates] = useState(FALLBACK_RATES);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [ratesError, setRatesError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchRates() {
      setRatesLoading(true);
      setRatesError(null);

      try {
        const response = await fetch('https://open.er-api.com/v6/latest/USD');

        if (!response.ok) {
          throw new Error('Nepodařilo se načíst kurzy');
        }

        const data = await response.json();
        if (data.result !== 'success') {
          throw new Error('Nepodařilo se načíst kurzy');
        }

        const czkPerUsd = data.rates.CZK;
        if (!czkPerUsd || czkPerUsd <= 0) {
          throw new Error('Chybí kurz CZK');
        }

        const nextRates = { USD: czkPerUsd };

        for (const code of ['TWD', 'HKD']) {
          const unitsPerUsd = data.rates[code];
          if (!unitsPerUsd || unitsPerUsd <= 0) {
            throw new Error(`Chybí kurz pro ${code}`);
          }
          nextRates[code] = czkPerUsd / unitsPerUsd;
        }

        if (!cancelled) {
          setRates(nextRates);
        }
      } catch (error) {
        if (!cancelled) {
          setRates(FALLBACK_RATES);
          setRatesError(
            error instanceof Error ? error.message : 'Nepodařilo se načíst kurzy'
          );
        }
      } finally {
        if (!cancelled) {
          setRatesLoading(false);
        }
      }
    }

    fetchRates();

    return () => {
      cancelled = true;
    };
  }, []);

  const numericPrice = parseFloat(price.replace(',', '.')) || 0;
  const rate = rates[currency] ?? 0;

  const { priceCzk, vatAmount, taxAmount, feesTotal, estimatedTotal } = useMemo(() => {
    const converted = numericPrice * rate;
    const vat = converted * VAT_RATE;
    const afterVat = converted * (1 + VAT_RATE);
    const tax = afterVat * TAX_RATE;
    const total = afterVat * (1 + TAX_RATE) + HANDLING_FEE_CZK;

    return {
      priceCzk: converted,
      vatAmount: vat,
      taxAmount: tax,
      feesTotal: vat + tax + HANDLING_FEE_CZK,
      estimatedTotal: total,
    };
  }, [numericPrice, rate]);

  const hasInput = numericPrice > 0;

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Airsoft celní kalkulačka</h1>
        <p className={styles.subtitle}>
          Odhad nákladů na dovoz airsoft zboží do České republiky
        </p>
      </header>

      <section className={styles.card}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Měna ceny</span>
          <div className={styles.currencyToggle} role="group" aria-label="Měna ceny">
            {CURRENCIES.map((code) => (
              <button
                key={code}
                type="button"
                className={`${styles.currencyButton} ${
                  currency === code ? styles.currencyButtonActive : ''
                }`}
                aria-pressed={currency === code}
                onClick={() => setCurrency(code)}
              >
                {code}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="price">Celková cena zboží včetně dopravy</label>
          <div className={styles.priceInput}>
            <input
              id="price"
              type="number"
              min="0"
              step="any"
              placeholder="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <span className={styles.currencyBadge}>{currency}</span>
          </div>
        </div>

        <div className={styles.rateInfo}>
          {ratesLoading ? (
            <span>Načítám kurz…</span>
          ) : (
            <span>
              1 {currency} = {formatRate(rate)} Kč
            </span>
          )}
          {ratesError && (
            <span className={styles.rateWarning}>
              Použity odhadované kurzy ({ratesError})
            </span>
          )}
        </div>
      </section>

      <section className={styles.results}>
        <div className={styles.resultRow}>
          <span className={styles.resultLabel}>Cena zboží v Kč</span>
          <span className={styles.resultValue}>
            {hasInput ? formatCzk(priceCzk) : '—'}
          </span>
        </div>

        <div className={styles.breakdown}>
          <div className={styles.resultRow}>
            <span className={styles.resultLabel}>DPH ({VAT_RATE * 100} %)</span>
            <span className={styles.resultValueMuted}>
              {hasInput ? formatCzk(vatAmount) : '—'}
            </span>
          </div>
          <div className={styles.resultRow}>
            <span className={styles.resultLabel}>Clo ({TAX_RATE * 100} %)</span>
            <span className={styles.resultValueMuted}>
              {hasInput ? formatCzk(taxAmount) : '—'}
            </span>
          </div>
          <div className={styles.resultRow}>
            <span className={styles.resultLabel}>Poplatek za zastoupení Českou poštou</span>
            <span className={styles.resultValueMuted}>
              {hasInput ? formatCzk(HANDLING_FEE_CZK) : '—'}
            </span>
          </div>
        </div>

        <div className={styles.resultRow}>
          <span className={styles.resultLabel}>DPH, clo a poplatky celkem</span>
          <span className={styles.resultValue}>
            {hasInput ? formatCzk(feesTotal) : '—'}
          </span>
        </div>

        <div className={`${styles.resultRow} ${styles.resultHighlight}`}>
          <span className={styles.resultLabel}>Odhadovaná částka k úhradě</span>
          <span className={styles.resultValueLarge}>
            {hasInput ? formatCzk(estimatedTotal) : '—'}
          </span>
        </div>
      </section>

      <footer className={styles.footer}>
        <p>
          Výpočet: cena × 1,21 (DPH {VAT_RATE * 100} %) × 1,03 (clo {TAX_RATE * 100} %) +{' '}
          {HANDLING_FEE_CZK} Kč poplatek za zastoupení Českou poštou
        </p>
        <p className={styles.disclaimer}>
          Pouze orientační odhad. Skutečná výše poplatků se může lišit.
        </p>
      </footer>
    </main>
  );
}
