import { describe, expect, it } from 'vitest';
import {
  LOW_VALUE_DUTY_START_DATE,
  calculateCustomsFees,
  isLowValueDutyInEffect,
  isLowValueShipment,
} from './customsCalculation';

const EUR_RATE = 25;

describe('isLowValueShipment', () => {
  it('treats 150 EUR as low value', () => {
    expect(isLowValueShipment(150)).toBe(true);
  });

  it('treats values above 150 EUR as standard import', () => {
    expect(isLowValueShipment(150.01)).toBe(false);
  });
});

describe('isLowValueDutyInEffect', () => {
  it('is false before 1 July 2026', () => {
    expect(isLowValueDutyInEffect(new Date('2026-06-30'))).toBe(false);
  });

  it('is true from 1 July 2026', () => {
    expect(isLowValueDutyInEffect(LOW_VALUE_DUTY_START_DATE)).toBe(true);
  });
});

describe('calculateCustomsFees', () => {
  it('calculates standard airsoft import above 150 EUR', () => {
    const priceCzk = 4000;
    const result = calculateCustomsFees({
      priceCzk,
      priceEur: 160,
      tariffLineCount: 1,
      eurRateCzk: EUR_RATE,
      referenceDate: LOW_VALUE_DUTY_START_DATE,
    });

    expect(result.isLowValueShipment).toBe(false);
    expect(result.taxAmount).toBe(priceCzk * 0.032);
    expect(result.vatAmount).toBe(priceCzk * 1.032 * 0.21);
    expect(result.handlingFeeVatAmount).toBe(350 * 0.21);
    expect(result.handlingFee).toBe(350);
    expect(result.customsTotal).toBe(
      (priceCzk + priceCzk * 0.032 + 350) * 1.21
    );
  });

  it('calculates low-value import with only VAT before July 2026', () => {
    const priceCzk = 2000;
    const result = calculateCustomsFees({
      priceCzk,
      priceEur: 80,
      tariffLineCount: 2,
      eurRateCzk: EUR_RATE,
      referenceDate: new Date('2026-06-17'),
    });

    expect(result.isLowValueShipment).toBe(true);
    expect(result.lowValueDutyApplies).toBe(false);
    expect(result.vatAmount).toBe(420);
    expect(result.taxAmount).toBe(0);
    expect(result.handlingFee).toBe(0);
    expect(result.handlingFeeVatAmount).toBe(0);
    expect(result.customsTotal).toBe(priceCzk * 1.21);
  });

  it('adds 3 EUR per tariff line from July 2026 for low-value imports', () => {
    const priceCzk = 2000;
    const result = calculateCustomsFees({
      priceCzk,
      priceEur: 80,
      tariffLineCount: 2,
      eurRateCzk: EUR_RATE,
      referenceDate: LOW_VALUE_DUTY_START_DATE,
    });

    expect(result.lowValueDutyApplies).toBe(true);
    expect(result.taxAmount).toBe(2 * 3 * EUR_RATE);
    expect(result.vatAmount).toBe((priceCzk + 150) * 0.21);
    expect(result.customsTotal).toBe(priceCzk + 150 + (priceCzk + 150) * 0.21);
  });

  it('includes goods value in customsTotal', () => {
    const priceCzk = 2000;
    const result = calculateCustomsFees({
      priceCzk,
      priceEur: 80,
      tariffLineCount: 1,
      eurRateCzk: EUR_RATE,
      referenceDate: LOW_VALUE_DUTY_START_DATE,
    });

    expect(result.customsTotal).toBeGreaterThan(priceCzk);
    expect(result.customsTotal).toBe(priceCzk + result.feesTotal);
  });
});
