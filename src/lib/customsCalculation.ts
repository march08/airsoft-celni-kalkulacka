export const VAT_RATE = 0.21;
export const TAX_RATE = 0.03;
export const HANDLING_FEE_CZK = 350;
export const LOW_VALUE_THRESHOLD_EUR = 150;
export const LOW_VALUE_DUTY_PER_ITEM_EUR = 3;
export const LOW_VALUE_DUTY_START_DATE = new Date('2026-07-01T00:00:00');

export interface CustomsCalculationInput {
  priceCzk: number;
  priceEur: number;
  tariffLineCount: number;
  eurRateCzk: number;
  referenceDate?: Date;
}

export interface CustomsCalculationResult {
  isLowValueShipment: boolean;
  lowValueDutyApplies: boolean;
  vatAmount: number;
  taxAmount: number;
  handlingFee: number;
  feesTotal: number;
  customsTotal: number;
}

export function isLowValueShipment(priceEur: number): boolean {
  return priceEur > 0 && priceEur <= LOW_VALUE_THRESHOLD_EUR;
}

export function isLowValueDutyInEffect(referenceDate: Date): boolean {
  return referenceDate >= LOW_VALUE_DUTY_START_DATE;
}

export function calculateCustomsFees(
  input: CustomsCalculationInput
): CustomsCalculationResult {
  const { priceCzk, priceEur, tariffLineCount, eurRateCzk } = input;
  const referenceDate = input.referenceDate ?? new Date();
  const lowValue = isLowValueShipment(priceEur);
  const lowValueDutyApplies = lowValue && isLowValueDutyInEffect(referenceDate);

  const vatAmount = priceCzk * VAT_RATE;

  let taxAmount: number;
  let handlingFee: number;

  if (lowValue) {
    taxAmount = lowValueDutyApplies
      ? tariffLineCount * LOW_VALUE_DUTY_PER_ITEM_EUR * eurRateCzk
      : 0;
    handlingFee = 0;
  } else {
    // Equivalent to price × 1.21 × 1.03: duty on VAT-inclusive value for airsoft (3%).
    taxAmount = priceCzk * (1 + VAT_RATE) * TAX_RATE;
    handlingFee = HANDLING_FEE_CZK;
  }

  const feesTotal = vatAmount + taxAmount + handlingFee;
  const customsTotal = priceCzk + feesTotal;

  return {
    isLowValueShipment: lowValue,
    lowValueDutyApplies,
    vatAmount,
    taxAmount,
    handlingFee,
    feesTotal,
    customsTotal,
  };
}
