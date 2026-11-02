/** Клиент языковой модели. В проде — YandexGPT, в тестах — фейк. */

export interface LlmClient {
  complete(prompt: string): Promise<string>;
}

/** Детерминированный фейк для тестов и dry-run-режима. */
export class FakeLlmClient implements LlmClient {
  constructor(private readonly reply: string) {}

  async complete(_prompt: string): Promise<string> {
    return this.reply;
  }
}

export interface YandexGptOptions {
  /** API-ключ Яндекс Облака (сервисный аккаунт). */
  apiKey: string;
  /** Каталог Яндекс Облака. */
  folderId: string;
  /** Идентификатор модели (по умолчанию yandexgpt-lite). */
  modelUri?: string;
  /** Для тестов: другой endpoint. */
  baseUrl?: string;
}

/** Минимальный fetch-интерфейс (инъекция для тестов). */
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

interface CompletionResponse {
  result?: {
    alternatives?: Array<{ message?: { text?: string } }>;
  };
}

/**
 * Клиент YandexGPT (Yandex Cloud Foundation Models API).
 * Авторизация — API-ключ сервисного аккаунта; каталог обязателен.
 * Все секреты берутся из .env (YANDEX_API_KEY, YANDEX_FOLDER_ID).
 */
export class YandexGptClient implements LlmClient {
  private readonly fetchImpl: FetchLike;

  constructor(
    private readonly opts: YandexGptOptions,
    fetchImpl?: FetchLike,
  ) {
    this.fetchImpl = fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  }

  async complete(prompt: string): Promise<string> {
    const url =
      this.opts.baseUrl ?? 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion';
    const modelUri = this.opts.modelUri ?? `gpt://${this.opts.folderId}/yandexgpt-lite/latest`;

    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Api-Key ${this.opts.apiKey}`,
        'x-folder-id': this.opts.folderId,
      },
      body: JSON.stringify({
        modelUri,
        completionOptions: { temperature: 0.3, maxTokens: 2000 },
        messages: [{ role: 'user', text: prompt }],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`YandexGPT API ${response.status}: ${detail.slice(0, 200)}`);
    }

    const data = JSON.parse(await response.text()) as CompletionResponse;
    const text = data.result?.alternatives?.[0]?.message?.text;
    if (!text) {
      throw new Error('YandexGPT: empty response');
    }
    return text;
  }
}
