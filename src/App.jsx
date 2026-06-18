import { useEffect, useMemo, useState } from 'react';
import styles from './App.module.css';

const VAT_RATE = 0.21;
const TAX_RATE = 0.03;
const HANDLING_FEE_CZK = 350;
const PAYPAL_CONVERSION_MARKUP = 0.04;
const LOW_VALUE_THRESHOLD_EUR = 150;
const LOW_VALUE_DUTY_PER_ITEM_EUR = 3;
const CUSTOMS_PORTAL_URL =
  'https://cportal.celnisprava.gov.cz/web/portal/celni-prohlaseni';

const CURRENCIES = ['USD', 'TWD', 'HKD'];

const FALLBACK_RATES = {
  USD: 23.5,
  TWD: 0.72,
  HKD: 3.0,
  EUR: 25.2,
};

function formatCzk(value) {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatEur(value) {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
  const [itemCount, setItemCount] = useState('1');
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

        const eurPerUsd = data.rates.EUR;
        if (!eurPerUsd || eurPerUsd <= 0) {
          throw new Error('Chybí kurz EUR');
        }
        nextRates.EUR = czkPerUsd / eurPerUsd;

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
  const numericItemCount = Math.max(1, parseInt(itemCount, 10) || 1);
  const rate = rates[currency] ?? 0;

  const {
    priceCzk,
    priceEur,
    isLowValueShipment,
    vatAmount,
    taxAmount,
    feesTotal,
    paypalSurcharge,
    customsTotal,
    grandTotal,
  } = useMemo(() => {
    const converted = numericPrice * rate;
    const eurRate = rates.EUR ?? FALLBACK_RATES.EUR;
    const inEur = eurRate > 0 ? converted / eurRate : 0;
    const lowValue = inEur > 0 && inEur < LOW_VALUE_THRESHOLD_EUR;
    const vat = converted * VAT_RATE;
    const afterVat = converted * (1 + VAT_RATE);
    const perItemDutyCzk = numericItemCount * LOW_VALUE_DUTY_PER_ITEM_EUR * eurRate;
    const tax = lowValue ? perItemDutyCzk : afterVat * TAX_RATE;
    const handling = lowValue ? 0 : HANDLING_FEE_CZK;
    const customs = lowValue
      ? afterVat + perItemDutyCzk
      : afterVat * (1 + TAX_RATE) + HANDLING_FEE_CZK;
    const paypalExtra = converted * PAYPAL_CONVERSION_MARKUP;

    return {
      priceCzk: converted,
      priceEur: inEur,
      isLowValueShipment: lowValue,
      vatAmount: vat,
      taxAmount: tax,
      feesTotal: vat + tax + handling,
      paypalSurcharge: paypalExtra,
      customsTotal: customs,
      grandTotal: customs + paypalExtra,
    };
  }, [numericPrice, numericItemCount, rate, rates.EUR]);

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

        <div className={styles.field}>
          <label htmlFor="itemCount">Počet položek v zásilce</label>
          <input
            id="itemCount"
            type="number"
            min="1"
            step="1"
            placeholder="1"
            value={itemCount}
            onChange={(e) => setItemCount(e.target.value)}
          />
          <span className={styles.fieldHint}>
            U zásilek pod {LOW_VALUE_THRESHOLD_EUR} EUR: clo {LOW_VALUE_DUTY_PER_ITEM_EUR}{' '}
            EUR za každou položku
          </span>
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

      <aside className={styles.paypalInfo}>
        <h2 className={styles.paypalTitle}>Platba přes PayPal</h2>
        <p>
          <strong>Nepoužívejte PayPal konverzi měny.</strong> Při platbě zvolte měnu
          prodejce ({currency}) a nechte převod na své bance nebo kartě — PayPal kurz
          bývá o cca {PAYPAL_CONVERSION_MARKUP * 100} % horší a účtuje další poplatky za
          mezinárodní transakce.
        </p>
      </aside>

      {hasInput && isLowValueShipment && (
        <aside className={styles.lowValueInfo}>
          <h2 className={styles.lowValueTitle}>
            Zásilka pod {LOW_VALUE_THRESHOLD_EUR} EUR
          </h2>
          <p>
            Hodnota zásilky: <strong>{formatEur(priceEur)}</strong> — platí se DPH a clo{' '}
            {LOW_VALUE_DUTY_PER_ITEM_EUR} EUR za položku.
          </p>
          <p>
            Nemusíte podávat prohlášení přes Českou poštu. Volitelně můžete podat
            elektronické celní prohlášení přes{' '}
            <a href={CUSTOMS_PORTAL_URL} target="_blank" rel="noopener noreferrer">
              cPortál Celní správy
            </a>
            , která informace a balík následně předá poště. DPH ({VAT_RATE * 100} %) se hradí i u zásilek pod {LOW_VALUE_THRESHOLD_EUR}{' '}
            EUR.
          </p>
        </aside>
      )}

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
            <span className={styles.resultLabel}>
              {isLowValueShipment
                ? `Clo (${LOW_VALUE_DUTY_PER_ITEM_EUR} EUR × ${numericItemCount} ks)`
                : `Clo (${TAX_RATE * 100} %)`}
            </span>
            <span className={styles.resultValueMuted}>
              {hasInput ? formatCzk(taxAmount) : '—'}
            </span>
          </div>
          <div className={styles.resultRow}>
            <span className={styles.resultLabel}>Poplatek za zastoupení Českou poštou</span>
            <span className={styles.resultValueMuted}>
              {hasInput
                ? isLowValueShipment
                  ? 'Není třeba'
                  : formatCzk(HANDLING_FEE_CZK)
                : '—'}
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
            {hasInput ? formatCzk(customsTotal) : '—'}
          </span>
        </div>

        <div className={styles.resultRow}>
          <span className={styles.resultLabel}>
            Příplatek PayPal (~{PAYPAL_CONVERSION_MARKUP * 100} %)
          </span>
          <span className={styles.resultValueMuted}>
            {hasInput ? formatCzk(paypalSurcharge) : '—'}
          </span>
        </div>

        <div className={`${styles.resultRow} ${styles.resultSecondary}`}>
          <span className={styles.resultLabel}>Celkem včetně PayPal</span>
          <span className={styles.resultValueSecondary}>
            {hasInput ? formatCzk(grandTotal) : '—'}
          </span>
        </div>
      </section>

      <footer className={styles.footer}>
        <p>
          Výpočet: cena × 1,21 (DPH {VAT_RATE * 100} %) × 1,03 (clo {TAX_RATE * 100} %) +{' '}
          {HANDLING_FEE_CZK} Kč poplatek za zastoupení Českou poštou. U zásilek pod{' '}
          {LOW_VALUE_THRESHOLD_EUR} EUR: cena × 1,21 (DPH) + {LOW_VALUE_DUTY_PER_ITEM_EUR} EUR
          × počet položek (clo), bez poplatku České pošty).
        </p>
        <p>
          Celkem včetně PayPal: odhadovaná částka k úhradě + cca{' '}
          {PAYPAL_CONVERSION_MARKUP * 100} % příplatek PayPal
        </p>
        <p className={styles.disclaimer}>
          Pouze orientační odhad. Skutečná výše poplatků se může lišit.
        </p>
      </footer>
    </main>
  );
}
