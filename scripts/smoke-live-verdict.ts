// Smoke: полный конвейер с РЕАЛЬНЫМ YandexGPT и реальным NER.
// Секреты берутся из .env (YANDEX_API_KEY, YANDEX_FOLDER_ID).
// Run: npx tsx scripts/smoke-live-verdict.ts
import { buildApp } from '../apps/server/src/app.ts';
import { loadProjectEnv } from '../apps/server/src/env.ts';
import { YandexGptClient } from '../apps/server/src/llm.ts';
import { HuggingFaceNerSafetyNet } from '../apps/server/src/ner.ts';

loadProjectEnv();

const apiKey = process.env.YANDEX_API_KEY;
const folderId = process.env.YANDEX_FOLDER_ID;
if (!apiKey || !folderId) {
  console.error('Нужны YANDEX_API_KEY и YANDEX_FOLDER_ID в .env');
  process.exit(1);
}

const app = buildApp({
  llm: new YandexGptClient({ apiKey, folderId }),
  ner: new HuggingFaceNerSafetyNet(),
});

const sample =
  'Исполнитель: [ФИО] обязуется выполнить работы по разработке программного обеспечения за вознаграждение 45 000 руб. ежемесячно. ' +
  'Договор может быть расторгнут заказчиком в одностороннем порядке без предупреждения. ' +
  'Споры рассматриваются в суде по месту нахождения заказчика.';

async function main(): Promise<void> {
  const t0 = Date.now();
  const res = await app.inject({
    method: 'POST',
    url: '/api/verify',
    payload: { documentType: 'gph', maskedText: sample },
  });
  console.log(`HTTP ${res.statusCode} (${Date.now() - t0} ms)`);
  const body = res.json();
  console.log('score:', body.verdict?.score, '| light:', body.verdict?.trafficLight);
  console.log('risks:', body.verdict?.risks?.length);
  for (const r of body.verdict?.risks ?? []) {
    console.log(`  [${r.severity}] ${r.clause}: ${r.description}`);
  }
  console.log('recommendation:', body.verdict?.recommendation);
  console.log('anonymizedOnServer:', body.anonymizedOnServer);
  if (res.statusCode !== 200 || !body.verdict) {
    console.error('SMOKE FAILED');
    process.exit(1);
  }
  console.log('SMOKE OK: живой YandexGPT вернул вердикт.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
