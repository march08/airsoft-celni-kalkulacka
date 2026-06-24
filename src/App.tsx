import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CURRENCY_CODES,
  FALLBACK_RATES,
  fetchExchangeRates,
  type SupportedCurrencyCode,
} from './api/exchangeRates';
import {
  LOW_VALUE_DUTY_PER_ITEM_EUR,
  LOW_VALUE_DUTY_START_DATE,
  LOW_VALUE_THRESHOLD_EUR,
  TAX_RATE,
  VAT_RATE,
  calculateCustomsFees,
} from './lib/customsCalculation';
import { RATES_STALE_TIME_MS } from './queryClient';
import styles from './App.module.css';

const HANDLING_FEE_CZK = 350;
const PAYPAL_CONVERSION_MARKUP = 0.04;
const CUSTOMS_PORTAL_URL =
  'https://cportal.celnisprava.gov.cz/web/portal/celni-prohlaseni';

const CURRENCIES = CURRENCY_CODES;

function formatCzk(value: number) {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatEur(value: number) {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatRate(value: number) {
  return new Intl.NumberFormat('cs-CZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatDutyStartDate() {
  return new Intl.DateTimeFormat('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).format(LOW_VALUE_DUTY_START_DATE);
}

export default function App() {
  const [currency, setCurrency] = useState<SupportedCurrencyCode>('TWD');
  const [price, setPrice] = useState('');
  const [tariffLineCount, setTariffLineCount] = useState('1');

  const {
    data: rates = FALLBACK_RATES,
    isLoading: ratesLoading,
    isError: ratesIsError,
    error: ratesQueryError,
  } = useQuery({
    queryKey: ['exchangeRates'],
    queryFn: fetchExchangeRates,
    staleTime: RATES_STALE_TIME_MS,
    gcTime: RATES_STALE_TIME_MS,
    retry: 1,
  });

  const ratesError = ratesIsError
    ? ratesQueryError instanceof Error
      ? ratesQueryError.message
      : 'Nepodařilo se načíst kurzy'
    : null;

  const numericPrice = parseFloat(price.replace(',', '.')) || 0;
  const numericTariffLines = Math.max(1, parseInt(tariffLineCount, 10) || 1);
  const rate = rates[currency] ?? 0;

  const {
    priceCzk,
    priceEur,
    isLowValueShipment,
    lowValueDutyApplies,
    vatAmount,
    handlingFeeVatAmount,
    taxAmount,
    handlingFee,
    feesTotal,
    paypalSurcharge,
    customsTotal,
    grandTotal,
  } = useMemo(() => {
    const converted = numericPrice * rate;
    const eurRate = rates.EUR ?? FALLBACK_RATES.EUR;
    const inEur = eurRate > 0 ? converted / eurRate : 0;
    const customs = calculateCustomsFees({
      priceCzk: converted,
      priceEur: inEur,
      tariffLineCount: numericTariffLines,
      eurRateCzk: eurRate,
    });
    const paypalExtra = converted * PAYPAL_CONVERSION_MARKUP;

    return {
      priceCzk: converted,
      priceEur: inEur,
      isLowValueShipment: customs.isLowValueShipment,
      lowValueDutyApplies: customs.lowValueDutyApplies,
      vatAmount: customs.vatAmount,
      handlingFeeVatAmount: customs.handlingFeeVatAmount,
      taxAmount: customs.taxAmount,
      handlingFee: customs.handlingFee,
      feesTotal: customs.feesTotal,
      paypalSurcharge: paypalExtra,
      customsTotal: customs.customsTotal,
      grandTotal: customs.customsTotal + paypalExtra,
    };
  }, [numericPrice, numericTariffLines, rate, rates.EUR]);

  const hasInput = numericPrice > 0;

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Airsoft celní kalkulačka</h1>
        <p className={styles.subtitle}>
          Odhad nákladů na dovoz airsoft zboží do České republiky
        </p>
      </header>

      <div className={styles.layout}>
        <div className={styles.column}>
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
              <label htmlFor="tariffLineCount">Počet druhů zboží (celní položky)</label>
              <input
                id="tariffLineCount"
                type="number"
                min="1"
                step="1"
                placeholder="1"
                value={tariffLineCount}
                onChange={(e) => setTariffLineCount(e.target.value)}
              />
              <span className={styles.fieldHint}>
                U zásilek do {LOW_VALUE_THRESHOLD_EUR} EUR od 1. 7. 2026: clo{' '}
                {LOW_VALUE_DUTY_PER_ITEM_EUR} EUR za každý druh zboží (ne za kus). Více kusů
                stejného produktu = 1 položka.
              </span>
            </div>

            <div className={styles.rateInfo}>
              {ratesLoading ? (
                <span>Načítám kurz…</span>
              ) : (
                <span>
                  {currency === 'EUR'
                    ? `1 EUR = ${formatRate(rate)} Kč`
                    : `1 ${currency} = ${formatRate(rate)} Kč · 1 EUR = ${formatRate(rates.EUR ?? FALLBACK_RATES.EUR)} Kč`}
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
        </div>

        <div className={styles.column}>
          {hasInput && isLowValueShipment && (
            <aside className={styles.lowValueInfo}>
              <h2 className={styles.lowValueTitle}>
                Zásilka pod {LOW_VALUE_THRESHOLD_EUR} EUR
              </h2>
              <p>
                Hodnota zásilky: <strong>{formatEur(priceEur)}</strong> — platí se DPH
                {lowValueDutyApplies
                  ? ` a clo ${LOW_VALUE_DUTY_PER_ITEM_EUR} EUR za druh zboží`
                  : `, clo se do ${formatDutyStartDate()} neplatí`}
                .
              </p>
              <p>
                Nemusíte podávat prohlášení přes Českou poštu. Volitelně můžete podat
                elektronické celní prohlášení přes{' '}
                <a href={CUSTOMS_PORTAL_URL} target="_blank" rel="noopener noreferrer">
                  cPortál Celní správy
                </a>
                . Pokud jste DPH uhradili na e-shopu (IOSS), uveďte IOSS číslo — jinak hrozí
                dvojí vyměření DPH.
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
                <span className={styles.resultLabel}>
                  {isLowValueShipment
                    ? lowValueDutyApplies
                      ? `Clo (${LOW_VALUE_DUTY_PER_ITEM_EUR} EUR × ${numericTariffLines} druhů)`
                      : 'Clo'
                    : `Clo (${TAX_RATE * 100} %)`}
                </span>
                <span className={styles.resultValueMuted}>
                  {hasInput
                    ? isLowValueShipment && !lowValueDutyApplies
                      ? 'Není třeba'
                      : formatCzk(taxAmount)
                    : '—'}
                </span>
              </div>
              <div className={styles.resultRow}>
                <span className={styles.resultLabel}>DPH ({VAT_RATE * 100} %)</span>
                <span className={styles.resultValueMuted}>
                  {hasInput ? formatCzk(vatAmount) : '—'}
                </span>
              </div>
              <div className={styles.resultRow}>
                <span className={styles.resultLabel}>Poplatek za zastoupení Českou poštou</span>
                <span className={styles.resultValueMuted}>
                  {hasInput
                    ? isLowValueShipment
                      ? 'Není třeba'
                      : formatCzk(handlingFee)
                    : '—'}
                </span>
              </div>
              {!isLowValueShipment && (
                <div className={styles.resultRow}>
                  <span className={styles.resultLabel}>
                    DPH z poplatku ({VAT_RATE * 100} %)
                  </span>
                  <span className={styles.resultValueMuted}>
                    {hasInput ? formatCzk(handlingFeeVatAmount) : '—'}
                  </span>
                </div>
              )}
            </div>

            <div className={styles.resultRow}>
              <span className={styles.resultLabel}>Clo, DPH a poplatky celkem</span>
              <span className={styles.resultValue}>
                {hasInput ? formatCzk(feesTotal) : '—'}
              </span>
            </div>

            <div className={`${styles.resultRow} ${styles.resultHighlight}`}>
              <span className={styles.resultLabel}>Celkem včetně zboží a poplatků (odhad)</span>
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
        </div>
      </div>

      <footer className={styles.footer}>
        <p>
          Nad {LOW_VALUE_THRESHOLD_EUR} EUR: clo {TAX_RATE * 100} %, DPH {VAT_RATE * 100} % z
          (zboží + clo), poplatek České pošty {HANDLING_FEE_CZK} Kč + DPH z poplatku. Do{' '}
          {LOW_VALUE_THRESHOLD_EUR} EUR: DPH z hodnoty zboží; od 1. 7. 2026 navíc clo{' '}
          {LOW_VALUE_DUTY_PER_ITEM_EUR} EUR za druh zboží (DPH pak z hodnoty včetně cla).
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
