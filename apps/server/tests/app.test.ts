import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { FakeLlmClient } from '../src/llm.ts';
import type { NerEntity, NerSafetyNet } from '../src/ner.ts';

const VALID_VERDICT = JSON.stringify({
  score: 3,
  trafficLight: 'green',
  risks: [{ severity: 'low', clause: 'п. 1.1', description: 'Предмет ясен', action: 'Ничего' }],
  recommendation: 'Можно подписывать',
});

class FakeNer implements NerSafetyNet {
  constructor(private readonly entities: NerEntity[] = []) {}

  async detect(): Promise<NerEntity[]> {
    return this.entities;
  }
}

class RecordingLlm extends FakeLlmClient {
  public prompts: string[] = [];

  constructor(reply: string) {
    super(reply);
  }

  override async complete(prompt: string): Promise<string> {
    this.prompts.push(prompt);
    return super.complete(prompt);
  }
}

const BODY = { documentType: 'gph', maskedText: 'Исполнитель: [ФИО], сумма 45 000 руб.' };

describe('GET /health', () => {
  it('отвечает ok', async () => {
    const app = buildApp({ llm: new FakeLlmClient(VALID_VERDICT), ner: new FakeNer() });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});

describe('CORS', () => {
  it('возвращает access-control-allow-origin на verify', async () => {
    const app = buildApp({ llm: new FakeLlmClient(VALID_VERDICT), ner: new FakeNer() });
    const res = await app.inject({
      method: 'POST',
      url: '/api/verify',
      payload: BODY,
      headers: { origin: 'http://localhost:5173' },
    });
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('отвечает на preflight OPTIONS', async () => {
    const app = buildApp({ llm: new FakeLlmClient(VALID_VERDICT), ner: new FakeNer() });
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/verify',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'POST',
      },
    });
    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});

describe('POST /api/verify', () => {
  it('возвращает вердикт для корректного запроса', async () => {
    const app = buildApp({ llm: new FakeLlmClient(VALID_VERDICT), ner: new FakeNer() });
    const res = await app.inject({ method: 'POST', url: '/api/verify', payload: BODY });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.verdict.score).toBe(3);
    expect(body.anonymizedOnServer).toBe(false);
    expect(body.maskedAgain).toEqual([]);
  });

  it('до-обезличивает остатки, найденные NER, и помечает это', async () => {
    const llm = new RecordingLlm(VALID_VERDICT);
    const ner = new FakeNer([{ group: 'NAME', start: 14, end: 20, word: 'Иванов', score: 0.99 }]);
    const app = buildApp({ llm, ner });
    const res = await app.inject({ method: 'POST', url: '/api/verify', payload: BODY });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.anonymizedOnServer).toBe(true);
    expect(body.maskedAgain).toEqual(['[ФИО]']);
    // В ИИ ушёл уже до-обезличенный текст.
    expect(llm.prompts[0]).toContain('[ФИО]');
    expect(llm.prompts[0]).not.toContain('Иванов');
  });

  it('принимает markdown-обёртку ответа LLM', async () => {
    const llm = new FakeLlmClient('```json\n' + VALID_VERDICT + '\n```');
    const app = buildApp({ llm, ner: new FakeNer() });
    const res = await app.inject({ method: 'POST', url: '/api/verify', payload: BODY });
    expect(res.statusCode).toBe(200);
    expect(res.json().verdict.score).toBe(3);
  });

  it('отвечает 502 при невалидном ответе LLM', async () => {
    const app = buildApp({ llm: new FakeLlmClient('не JSON'), ner: new FakeNer() });
    const res = await app.inject({ method: 'POST', url: '/api/verify', payload: BODY });
    expect(res.statusCode).toBe(502);
    expect(res.json().error).toBe('verdict_generation_failed');
  });

  it('отвечает 400 при неизвестном типе документа', async () => {
    const app = buildApp({ llm: new FakeLlmClient(VALID_VERDICT), ner: new FakeNer() });
    const res = await app.inject({
      method: 'POST',
      url: '/api/verify',
      payload: { documentType: 'unknown', maskedText: 'текст' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('отвечает 400 при пустом тексте', async () => {
    const app = buildApp({ llm: new FakeLlmClient(VALID_VERDICT), ner: new FakeNer() });
    const res = await app.inject({
      method: 'POST',
      url: '/api/verify',
      payload: { documentType: 'gph', maskedText: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('отвечает 413 при превышении лимита тела', async () => {
    const app = buildApp({
      llm: new FakeLlmClient(VALID_VERDICT),
      ner: new FakeNer(),
      bodyLimit: 100,
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/verify',
      payload: { documentType: 'gph', maskedText: 'x'.repeat(500) },
    });
    expect(res.statusCode).toBe(413);
  });
});

describe('Mock payments', () => {
  it('создаёт платёж по тарифу', async () => {
    const app = buildApp({ llm: new FakeLlmClient(VALID_VERDICT), ner: new FakeNer() });
    const res = await app.inject({
      method: 'POST',
      url: '/api/payments',
      payload: { plan: 'single' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.payment.status).toBe('pending');
    expect(body.payment.amount).toBe(199);
    expect(body.payment.paymentId ?? body.payment.id).toMatch(/^mock_/);
  });

  it('отвечает 400 на неизвестный тариф', async () => {
    const app = buildApp({ llm: new FakeLlmClient(VALID_VERDICT), ner: new FakeNer() });
    const res = await app.inject({
      method: 'POST',
      url: '/api/payments',
      payload: { plan: 'free' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('возвращает платёж по id и 404 для неизвестного', async () => {
    const app = buildApp({ llm: new FakeLlmClient(VALID_VERDICT), ner: new FakeNer() });
    const created = (
      await app.inject({ method: 'POST', url: '/api/payments', payload: { plan: 'pack3' } })
    ).json();
    const id = created.payment.id;
    const ok = await app.inject({ method: 'GET', url: `/api/payments/${id}` });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().payment.id).toBe(id);
    const missing = await app.inject({ method: 'GET', url: '/api/payments/mock_404' });
    expect(missing.statusCode).toBe(404);
  });

  it('подтверждает платёж (мок-вебхук) идемпотентно', async () => {
    const app = buildApp({ llm: new FakeLlmClient(VALID_VERDICT), ner: new FakeNer() });
    const created = (
      await app.inject({ method: 'POST', url: '/api/payments', payload: { plan: 'single' } })
    ).json();
    const id = created.payment.id;
    const first = await app.inject({ method: 'POST', url: `/api/payments/${id}/confirm` });
    expect(first.statusCode).toBe(200);
    expect(first.json().payment.status).toBe('succeeded');
    const second = await app.inject({ method: 'POST', url: `/api/payments/${id}/confirm` });
    expect(second.statusCode).toBe(200);
    expect(second.json().payment.status).toBe('succeeded');
  });

  it('verify без оплаты работает бесплатно (paid: false)', async () => {
    const app = buildApp({ llm: new FakeLlmClient(VALID_VERDICT), ner: new FakeNer() });
    const res = await app.inject({ method: 'POST', url: '/api/verify', payload: BODY });
    expect(res.statusCode).toBe(200);
    expect(res.json().paid).toBe(false);
  });

  it('verify с оплаченным платежом отдаёт paid: true', async () => {
    const app = buildApp({ llm: new FakeLlmClient(VALID_VERDICT), ner: new FakeNer() });
    const created = (
      await app.inject({ method: 'POST', url: '/api/payments', payload: { plan: 'single' } })
    ).json();
    await app.inject({ method: 'POST', url: `/api/payments/${created.payment.id}/confirm` });
    const res = await app.inject({
      method: 'POST',
      url: '/api/verify',
      payload: { ...BODY, paymentId: created.payment.id },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().paid).toBe(true);
  });

  it('verify с неоплаченным платежом → 402', async () => {
    const app = buildApp({ llm: new FakeLlmClient(VALID_VERDICT), ner: new FakeNer() });
    const created = (
      await app.inject({ method: 'POST', url: '/api/payments', payload: { plan: 'single' } })
    ).json();
    const res = await app.inject({
      method: 'POST',
      url: '/api/verify',
      payload: { ...BODY, paymentId: created.payment.id },
    });
    expect(res.statusCode).toBe(402);
    expect(res.json().error).toBe('payment_required');
  });

  it('verify с неизвестным платежом → 402', async () => {
    const app = buildApp({ llm: new FakeLlmClient(VALID_VERDICT), ner: new FakeNer() });
    const res = await app.inject({
      method: 'POST',
      url: '/api/verify',
      payload: { ...BODY, paymentId: 'mock_unknown' },
    });
    expect(res.statusCode).toBe(402);
  });
});
