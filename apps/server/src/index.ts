import { buildApp } from './app.ts';
import { loadProjectEnv } from './env.ts';
import { FakeLlmClient, YandexGptClient } from './llm.ts';
import { HuggingFaceNerSafetyNet, NoopNerSafetyNet } from './ner.ts';
import type { Verdict } from './types.ts';

const PORT = Number(process.env.PORT ?? 3000);

// Секреты — только из .env в корне репозитория (в git не попадает).
loadProjectEnv();

const FAKE_VERDICT: Verdict = {
  score: 4,
  trafficLight: 'yellow',
  risks: [
    {
      severity: 'medium',
      clause: 'п. 4.2',
      description: 'Неустойка 1% за каждый день просрочки — выше среднерыночной.',
      action: 'Попробуйте согласовать снижение до 0,1%.',
    },
    {
      severity: 'low',
      clause: 'п. 8.1',
      description: 'Споры рассматриваются по месту нахождения заказчика.',
      action: 'Учитывайте при подписании.',
    },
  ],
  recommendation: 'В целом договор приемлем, но пункт о неустойке стоит смягчить.',
};

const apiKey = process.env.YANDEX_API_KEY;
const folderId = process.env.YANDEX_FOLDER_ID;
const fakeLlm = process.env.FAKE_LLM === '1';

let llm;
if (fakeLlm) {
  llm = new FakeLlmClient(JSON.stringify(FAKE_VERDICT));
} else if (apiKey && folderId) {
  llm = new YandexGptClient({ apiKey, folderId });
} else {
  llm = new FakeLlmClient('');
}

if (!apiKey || !folderId) {
  if (fakeLlm) {
    console.warn('[server] FAKE_LLM=1 — тестовый режим с заранее заданным вердиктом.');
  } else {
    const missing = [apiKey ? '' : 'YANDEX_API_KEY', folderId ? '' : 'YANDEX_FOLDER_ID']
      .filter(Boolean)
      .join(', ');
    console.warn(
      `[server] Отсутствуют: ${missing} — dry-run режим: вердикт будет ошибкой генерации. Добавьте их в .env (см. README → «Настройка YandexGPT»).`,
    );
  }
}

const ner = process.env.FAKE_NER === '1' ? new NoopNerSafetyNet() : new HuggingFaceNerSafetyNet();
if (process.env.FAKE_NER === '1') {
  console.warn('[server] FAKE_NER=1 — тестовый режим без NER-предохранителя.');
}

const app = buildApp({ llm, ner });

app.listen({ port: PORT, host: '0.0.0.0' }).then((address) => {
  console.log(`[server] listening on ${address}`);
});
