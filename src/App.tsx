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
const ECEP_URL = 'https://cportal.celnisprava.gov.cz/web/portal/ecep';
const EORI_AD_HOC_URL =
  'https://celnisprava.gov.cz/cz/aplikace/Stranky/eoriadhoc.aspx';

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
          Odhad nákladů na dovoz airsoftových věcí do ČR
        </p>
      </header>

      <div className={styles.layout}>
        <div className={styles.column}>
          <section className={styles.card}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Měna objednávky</span>
              <div className={styles.currencyToggle} role="group" aria-label="Měna objednávky">
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
              <label htmlFor="price">Celková hodnota objednávky (včetně dopravy)</label>
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
                U zásilek do {LOW_VALUE_THRESHOLD_EUR} EUR: clo{' '}
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
                Hodnota zásilky: <strong>{formatEur(priceEur)}</strong> — platí se DPH a clo{' '}
                {LOW_VALUE_DUTY_PER_ITEM_EUR} EUR za celní položku.
              </p>
              <p>
                Doporučeno  podat
                elektronické celní prohlášení přes{' '}
                <a href={CUSTOMS_PORTAL_URL} target="_blank" rel="noopener noreferrer">
                  cPortál Celní správy
                </a>. Vyhnete se platbě za zastupování Českou poštou (~350 Kč + DPH). Formuář od ČP není potřeba vůbec vyplňovat.
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
                    ? `Clo (${LOW_VALUE_DUTY_PER_ITEM_EUR} EUR × ${numericTariffLines} položek)`
                    : `Clo (${TAX_RATE * 100} %)`}
                </span>
                <span className={styles.resultValueMuted}>
                  {hasInput ? formatCzk(taxAmount) : '—'}
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

      <section className={styles.tips} aria-labelledby="tips-heading">
        <h2 id="tips-heading" className={styles.tipsTitle}>
          Tipy a odkazy
        </h2>
        <ol className={styles.tipsList}>
          <li>
            Celní kód pro airsoftové zboží je <strong>930400</strong>.
          </li>
          <li>
            <a href={ECEP_URL} target="_blank" rel="noopener noreferrer">
              eCeP — elektronické celní prohlášení
            </a>
            <span className={styles.tipsLinkHint}>
              {' '}
              (zásilky do {LOW_VALUE_THRESHOLD_EUR} EUR, bez poplatku za zastoupení)
            </span>
          </li>
          <li>
            Při nákupu <strong>airsoftových zbraní</strong> často potřebujete pro podání celního prohlášení ad-hoc EORI (Evropské osobní identifikační číslo). Nepodnikající osoby si ho
            jednorázově vygenerují online —{' '}
            <a href={EORI_AD_HOC_URL} target="_blank" rel="noopener noreferrer">
              ad hoc EORI
            </a>.
            Někdy si jej celní řízení vyžádá, můžete jej rovnou dodat jako přílohu k prohlášení přes formulář České pošty. Ušetříte tím cca 2-3 dny.
          </li>
          <li>
            V případě dopravy s <strong>UPS</strong> je poplatek za zastupání během celního řízení <strong>450 Kč</strong>. Doprava a celý průběh bývá rychlejší, většinou jsou celní údaje prodejcem dodané správně a nemusíte řešit vyplňování formuláře.
          </li>
        </ol>
      </section>

      <footer className={styles.footer}>
        <p>
          Nad {LOW_VALUE_THRESHOLD_EUR} EUR: clo {TAX_RATE * 100} %, DPH {VAT_RATE * 100} %
          (hodnota objednávky + clo), poplatek České pošty za proclení {HANDLING_FEE_CZK} Kč + DPH z poplatku. Do{' '}
          {LOW_VALUE_THRESHOLD_EUR} EUR: DPH z hodnoty zboží + clo{' '}
          {LOW_VALUE_DUTY_PER_ITEM_EUR} EUR za celní položku (DPH pak z hodnoty včetně cla).
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
