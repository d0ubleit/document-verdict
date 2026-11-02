// Smoke: real NER safety net + fake LLM. Verifies the whole server pipeline
// catches a leaked name and auto-masks it BEFORE the verdict.
// Run: npx tsx scripts/smoke-ner-pipeline.ts
import { buildApp } from '../apps/server/src/app.ts';
import { FakeLlmClient } from '../apps/server/src/llm.ts';
import { HuggingFaceNerSafetyNet } from '../apps/server/src/ner.ts';

const VALID_VERDICT = JSON.stringify({
  score: 3,
  trafficLight: 'green',
  risks: [{ severity: 'low', clause: 'п. 1.1', description: 'Ок', action: 'Ничего' }],
  recommendation: 'Можно подписывать',
});

const app = buildApp({ llm: new FakeLlmClient(VALID_VERDICT), ner: new HuggingFaceNerSafetyNet() });

async function main(): Promise<void> {
  // Симулируем утечку: клиент «не заметил» фамилию.
  const leaked = 'Гражданин Иванов, паспорт [ПАСПОРТ], сумма 45 000 руб.';

  const t0 = Date.now();
  const res = await app.inject({
    method: 'POST',
    url: '/api/verify',
    payload: { documentType: 'gph', maskedText: leaked },
  });
  console.log(`HTTP ${res.statusCode} (${Date.now() - t0} ms)`);
  const body = res.json();
  console.log('anonymizedOnServer:', body.anonymizedOnServer);
  console.log('maskedAgain:', JSON.stringify(body.maskedAgain));
  console.log('verdict.score:', body.verdict?.score);
  if (res.statusCode !== 200 || !body.anonymizedOnServer) {
    console.error('SMOKE FAILED');
    process.exit(1);
  }
  console.log('SMOKE OK: утечка поймана и до-обезличена до вердикта.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
