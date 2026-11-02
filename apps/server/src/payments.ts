import { randomUUID } from 'node:crypto';

/**
 * Тарифы (цены фиксируются на сервере; клиент присылает только имя тарифа).
 */
export const PAYMENT_PLANS = {
  single: { amount: 199, description: 'Проверка договора' },
  pack3: { amount: 499, description: 'Пакет из 3 проверок' },
  pack10: { amount: 1490, description: 'Пакет из 10 проверок' },
} as const;

export type PaymentPlan = keyof typeof PAYMENT_PLANS;

export const PAYMENT_PLAN_NAMES = Object.keys(PAYMENT_PLANS) as PaymentPlan[];

export type PaymentStatus = 'pending' | 'succeeded';

export interface Payment {
  id: string;
  amount: number;
  currency: 'RUB';
  status: PaymentStatus;
  description: string;
  plan: PaymentPlan;
  /** Ссылка на платёжную форму (в моке — фейковая, с пометкой mock). */
  confirmationUrl: string;
  createdAt: string;
}

export interface PaymentProvider {
  createPayment(plan: PaymentPlan): Promise<Payment>;
  getPayment(id: string): Promise<Payment | null>;
  /** Идемпотентное подтверждение (в реальном ЮKassa — вебхук). */
  confirmPayment(id: string): Promise<Payment | null>;
}

/**
 * Мок-провайдер ЮKassa: хранит платежи в памяти, id с префиксом `mock_`,
 * подтверждение имитирует вебхук. Ничего не уходит во внешнюю сеть.
 */
export class MockYooKassaProvider implements PaymentProvider {
  private readonly payments = new Map<string, Payment>();

  async createPayment(plan: PaymentPlan): Promise<Payment> {
    const id = `mock_${randomUUID()}`;
    const tariff = PAYMENT_PLANS[plan];
    const payment: Payment = {
      id,
      amount: tariff.amount,
      currency: 'RUB',
      status: 'pending',
      description: tariff.description,
      plan,
      confirmationUrl: `https://yookassa.ru/checkout/mock/${id}`,
      createdAt: new Date().toISOString(),
    };
    this.payments.set(id, payment);
    return payment;
  }

  async getPayment(id: string): Promise<Payment | null> {
    return this.payments.get(id) ?? null;
  }

  async confirmPayment(id: string): Promise<Payment | null> {
    const payment = this.payments.get(id);
    if (!payment) return null;
    payment.status = 'succeeded';
    return payment;
  }
}

export interface YooKassaOptions {
  shopId: string;
  secretKey: string;
}

/**
 * TODO(YooKassa): реальная интеграция — POST https://api.yookassa.ru/v3/payments
 * с Basic-авторизацией (shopId:secretKey), Idempotence-Key, затем вебхук
 * payment.succeeded. Сейчас используется только MockYooKassaProvider.
 */
export class YooKassaProvider implements PaymentProvider {
  constructor(private readonly opts: YooKassaOptions) {}

  async createPayment(_plan: PaymentPlan): Promise<Payment> {
    throw new Error(
      'YooKassaProvider is not implemented: use MockYooKassaProvider or add shopId/secretKey (see README).',
    );
  }

  async getPayment(_id: string): Promise<Payment | null> {
    throw new Error('YooKassaProvider is not implemented yet.');
  }

  async confirmPayment(_id: string): Promise<Payment | null> {
    throw new Error('YooKassaProvider is not implemented yet.');
  }
}
