import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { LlmClient } from './llm.ts';
import type { NerSafetyNet } from './ner.ts';
import { maskEntities } from './ner.ts';
import { MockYooKassaProvider, PAYMENT_PLAN_NAMES } from './payments.ts';
import type { PaymentProvider } from './payments.ts';
import { buildVerdictPrompt } from './prompts.ts';
import { parseAndValidateVerdict, VerdictParseError } from './verdict.ts';
import { DOCUMENT_TYPES } from './types.ts';
import type { VerifyRequest, VerifyResponse } from './types.ts';

export interface ServerOptions {
  llm: LlmClient;
  ner: NerSafetyNet;
  /** Платёжный провайдер (по умолчанию — мок ЮKassa, сеть не используется). */
  payments?: PaymentProvider;
  /** Максимальный размер тела запроса (по умолчанию 1 МБ). */
  bodyLimit?: number;
}

/** Собирает Fastify-приложение с инъекциями (тестируется через app.inject). */
export function buildApp(opts: ServerOptions) {
  const app = Fastify({ logger: false, bodyLimit: opts.bodyLimit ?? 1024 * 1024 });
  const payments = opts.payments ?? new MockYooKassaProvider();

  // Демо-фронтенд живёт на другом порту (vite dev) — разрешаем кросс-домен.
  app.register(cors, { origin: true });

  app.get('/health', async () => ({ status: 'ok' }));

  // ---- Мок-платежи ЮKassa (в памяти; реальная интеграция — TODO) ----

  app.post<{ Body: { plan: (typeof PAYMENT_PLAN_NAMES)[number] } }>(
    '/api/payments',
    {
      schema: {
        body: {
          type: 'object',
          required: ['plan'],
          additionalProperties: false,
          properties: { plan: { type: 'string', enum: [...PAYMENT_PLAN_NAMES] } },
        },
      },
    },
    async (request, reply) => {
      const payment = await payments.createPayment(request.body.plan);
      return reply.code(201).send({ payment });
    },
  );

  app.get<{ Params: { id: string } }>('/api/payments/:id', async (request, reply) => {
    const payment = await payments.getPayment(request.params.id);
    if (!payment) return reply.code(404).send({ error: 'payment_not_found' });
    return { payment };
  });

  // Имитация вебхука payment.succeeded (идемпотентно).
  app.post<{ Params: { id: string } }>('/api/payments/:id/confirm', async (request, reply) => {
    const payment = await payments.confirmPayment(request.params.id);
    if (!payment) return reply.code(404).send({ error: 'payment_not_found' });
    return { payment };
  });

  // ---- Вердикт ----

  app.post<{ Body: VerifyRequest }>(
    '/api/verify',
    {
      schema: {
        body: {
          type: 'object',
          required: ['documentType', 'maskedText'],
          additionalProperties: false,
          properties: {
            documentType: { type: 'string', enum: [...DOCUMENT_TYPES] },
            maskedText: { type: 'string', minLength: 1, maxLength: 500_000 },
            paymentId: { type: 'string', minLength: 1, maxLength: 128 },
          },
        },
      },
    },
    async (request, reply) => {
      const { documentType, maskedText, paymentId } = request.body;

      // Шаг 0: если передан платёж — он должен существовать и быть оплачен.
      let paid = false;
      if (paymentId) {
        const payment = await payments.getPayment(paymentId);
        if (!payment || payment.status !== 'succeeded') {
          return reply.code(402).send({ error: 'payment_required' });
        }
        paid = true;
      }

      // Шаг 1: NER-предохранитель — ловит остатки ПДн в уже обезличенном тексте.
      const entities = await opts.ner.detect(maskedText);
      let textForLlm = maskedText;
      let anonymizedOnServer = false;
      let maskedAgain: string[] = [];
      if (entities.length > 0) {
        const masked = maskEntities(maskedText, entities);
        textForLlm = masked.text;
        anonymizedOnServer = true;
        maskedAgain = masked.applied;
      }

      // Шаг 2: вердикт (текст в памяти, не логируется, автоудаление).
      const prompt = buildVerdictPrompt(documentType, textForLlm);
      const raw = await opts.llm.complete(prompt);

      let verdict: VerifyResponse['verdict'];
      try {
        verdict = parseAndValidateVerdict(raw);
      } catch (error) {
        if (error instanceof VerdictParseError) {
          return reply
            .code(502)
            .send({ error: 'verdict_generation_failed', detail: error.message });
        }
        throw error;
      }

      return {
        verdict,
        anonymizedOnServer,
        maskedAgain,
        paid,
      } satisfies VerifyResponse;
    },
  );

  return app;
}
