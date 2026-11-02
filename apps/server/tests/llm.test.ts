import { describe, expect, it } from 'vitest';
import { YandexGptClient } from '../src/llm.ts';
import type { FetchLike } from '../src/llm.ts';

function fakeFetch(overrides: {
  ok?: boolean;
  status?: number;
  body?: string;
  onRequest?: (url: string, init: { headers: Record<string, string>; body: string }) => void;
}): FetchLike {
  return async (url, init) => {
    overrides.onRequest?.(url, init);
    return {
      ok: overrides.ok ?? true,
      status: overrides.status ?? 200,
      text: async () => overrides.body ?? '',
    };
  };
}

const OPTS = { apiKey: 'test-key', folderId: 'test-folder' };

describe('YandexGptClient', () => {
  it('отправляет корректный запрос и возвращает текст ответа', async () => {
    const captured: {
      url: string;
      headers: Record<string, string>;
      body: string;
    }[] = [];
    const client = new YandexGptClient(
      OPTS,
      fakeFetch({
        body: JSON.stringify({ result: { alternatives: [{ message: { text: '{"score": 2}' } }] } }),
        onRequest: (url, init) => {
          captured.push({ url, headers: init.headers, body: init.body });
        },
      }),
    );

    const text = await client.complete('Проверь договор');
    expect(text).toBe('{"score": 2}');

    expect(captured[0].url).toBe('https://llm.api.cloud.yandex.net/foundationModels/v1/completion');
    expect(captured[0].headers.Authorization).toBe('Api-Key test-key');
    expect(captured[0].headers['x-folder-id']).toBe('test-folder');
    const body = JSON.parse(captured[0].body) as {
      modelUri: string;
      completionOptions: { temperature: number };
      messages: Array<{ role: string; text: string }>;
    };
    expect(body.modelUri).toBe('gpt://test-folder/yandexgpt-lite/latest');
    expect(body.completionOptions.temperature).toBeLessThan(1);
    expect(body.messages[0].text).toBe('Проверь договор');
  });

  it('бросает ошибку с кодом и деталями при неуспешном ответе', async () => {
    const client = new YandexGptClient(
      OPTS,
      fakeFetch({ ok: false, status: 401, body: '{"message":"unauthorized"}' }),
    );
    await expect(client.complete('prompt')).rejects.toThrow(/401/);
  });

  it('бросает ошибку при пустом ответе модели', async () => {
    const client = new YandexGptClient(
      OPTS,
      fakeFetch({ body: JSON.stringify({ result: { alternatives: [] } }) }),
    );
    await expect(client.complete('prompt')).rejects.toThrow(/empty response/i);
  });
});
