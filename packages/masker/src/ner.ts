import type { Candidate, PlaceholderType } from './types.ts';

/**
 * Необязательный NER-слой: русская NER-модель (bert-base-NER-Russian, ONNX)
 * запускается прямо в браузере через @huggingface/transformers.
 *
 * Модель тяжёлая (~100+ МБ, скачивается один раз и кэшируется браузером),
 * поэтому используется лениво и по требованию (опция useNer).
 *
 * В тестах модель не загружается — NER-проход покрывается отдельным
 * смоук-тестом с MASKER_USE_NER=1 (см. README).
 */

type NerEntity = {
  entity_group: string;
  word: string;
  start: number;
  end: number;
  score: number;
};

type NerPipe = (text: string) => Promise<NerEntity[]>;

let pipePromise: Promise<NerPipe> | null = null;

async function getPipe(): Promise<NerPipe> {
  if (!pipePromise) {
    pipePromise = import('@huggingface/transformers').then(async (m) => {
      // pipeline типизирован строже, чем нам нужно, — приводим через unknown.
      const pipeline = m.pipeline as unknown as (
        task: string,
        model: string,
      ) => Promise<(text: string, opts?: { aggregation_strategy?: string }) => Promise<unknown>>;
      const pipe = await pipeline(
        'token-classification',
        'onnx-community/bert-base-NER-Russian-ONNX',
      );
      return async (text: string) => {
        const raw = await pipe(text, { aggregation_strategy: 'simple' });
        const list = Array.isArray(raw) ? raw : [raw];
        return list as NerEntity[];
      };
    });
  }
  return pipePromise;
}

/** Какие NER-метки во что маскируем. */
const LABEL_TO_TYPE: Record<string, PlaceholderType> = {
  PER: 'NAME',
  LOC: 'ADDRESS',
  ORG: 'COMPANY',
  MISC: 'NAME',
};

/** NER-проход: возвращает кандидатов (с реальными индексами в тексте). */
export async function nerCandidates(text: string): Promise<Candidate[]> {
  const pipe = await getPipe();
  const entities = await pipe(text);
  const out: Candidate[] = [];
  for (const e of entities) {
    const type = LABEL_TO_TYPE[e.entity_group];
    if (!type) continue;
    if (e.score < 0.7) continue;
    out.push({ type, start: e.start, end: e.end, raw: text.slice(e.start, e.end), id: -1 });
  }
  return out;
}

/** Инициализация модели заранее (для демо-кнопки «прогреть модель»). */
export function warmUpNer(): Promise<void> {
  return getPipe().then(() => undefined);
}
