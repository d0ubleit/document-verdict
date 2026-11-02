import { describe, expect, it } from 'vitest';
import { MockYooKassaProvider, PAYMENT_PLANS } from '../src/payments.ts';

describe('PAYMENT_PLANS', () => {
  it('фиксирует цены на сервере', () => {
    expect(PAYMENT_PLANS.single.amount).toBe(199);
    expect(PAYMENT_PLANS.pack3.amount).toBe(499);
    expect(PAYMENT_PLANS.pack10.amount).toBe(1490);
  });
});

describe('MockYooKassaProvider', () => {
  it('создаёт платёж в статусе pending с суммой по тарифу', async () => {
    const provider = new MockYooKassaProvider();
    const payment = await provider.createPayment('single');
    expect(payment.status).toBe('pending');
    expect(payment.amount).toBe(199);
    expect(payment.currency).toBe('RUB');
    expect(payment.id.startsWith('mock_')).toBe(true);
    expect(payment.confirmationUrl).toContain(payment.id);
  });

  it('разные платежи получают разные id', async () => {
    const provider = new MockYooKassaProvider();
    const a = await provider.createPayment('pack3');
    const b = await provider.createPayment('pack3');
    expect(a.id).not.toBe(b.id);
  });

  it('возвращает платёж по id и null для неизвестного', async () => {
    const provider = new MockYooKassaProvider();
    const payment = await provider.createPayment('pack10');
    expect((await provider.getPayment(payment.id))?.amount).toBe(1490);
    expect(await provider.getPayment('mock_unknown')).toBeNull();
  });

  it('подтверждает платёж идемпотентно', async () => {
    const provider = new MockYooKassaProvider();
    const payment = await provider.createPayment('single');
    const confirmed = await provider.confirmPayment(payment.id);
    expect(confirmed?.status).toBe('succeeded');
    const again = await provider.confirmPayment(payment.id);
    expect(again?.status).toBe('succeeded');
    expect(again?.id).toBe(payment.id);
  });

  it('возвращает null при подтверждении неизвестного платежа', async () => {
    const provider = new MockYooKassaProvider();
    expect(await provider.confirmPayment('mock_nope')).toBeNull();
  });
});
