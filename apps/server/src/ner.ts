/**
 * NER-предохранитель: ловит остаточные персональные данные в тексте,
 * который пользователь уже обезличил на клиенте и подтвердил.
 * Модель: Gherman/bert-base-NER-Russian (конвертация onnx-community,
 * int8 ~178 МБ) — размечена под российские паспортные данные
 * (LAST_NAME/FIRST_NAME/MIDDLE_NAME/CITY/STREET/HOUSE/REGION/DISTRICT).
 * Загружается лениво при первом запросе; в тестах — фейк.
 */

export interface NerEntity {
  group: 'NAME' | 'ADDRESS' | 'OTHER';
  start: number;
  end: number;
  word: string;
  score: number;
}

export interface NerSafetyNet {
  detect(text: string): Promise<NerEntity[]>;
}

/** Пустой предохранитель для e2e-тестов (без скачивания модели). */
export class NoopNerSafetyNet implements NerSafetyNet {
  async detect(): Promise<NerEntity[]> {
    return [];
  }
}

const GROUP_MAP: Record<string, 'NAME' | 'ADDRESS'> = {
  LAST_NAME: 'NAME',
  FIRST_NAME: 'NAME',
  MIDDLE_NAME: 'NAME',
  CITY: 'ADDRESS',
  STREET: 'ADDRESS',
  HOUSE: 'ADDRESS',
  REGION: 'ADDRESS',
  DISTRICT: 'ADDRESS',
  COUNTRY: 'ADDRESS',
};

type NerPipe = (
  text: string,
) => Promise<Array<{ entity: string; word: string; start: number; end: number; score: number }>>;

export class HuggingFaceNerSafetyNet implements NerSafetyNet {
  private pipePromise: Promise<NerPipe> | null = null;

  private getPipe(): Promise<NerPipe> {
    if (!this.pipePromise) {
      this.pipePromise = import('@huggingface/transformers').then(async (mod) => {
        const pipeline = mod.pipeline as unknown as (
          task: string,
          model: string,
          opts?: { dtype?: string },
        ) => Promise<(text: string, opts?: unknown) => Promise<unknown>>;
        // dtype q8 = int8 (~178 МБ вместо 709 МБ fp32); transformers.js v3.
        const raw = await pipeline(
          'token-classification',
          'onnx-community/bert-base-NER-Russian-ONNX',
          {
            dtype: 'q8',
          },
        );
        return (async (text: string) => {
          const out = await raw(text, { aggregation_strategy: 'simple' });
          const list = Array.isArray(out) ? out : [out];
          return list as Array<{
            entity: string;
            word: string;
            start: number;
            end: number;
            score: number;
          }>;
        }) as NerPipe;
      });
    }
    return this.pipePromise;
  }

  async detect(text: string): Promise<NerEntity[]> {
    const pipe = await this.getPipe();
    const entities = await pipe(text.slice(0, 200_000));
    const result: NerEntity[] = [];
    for (const e of entities) {
      // transformers.js v3: поле entity вида «U-LAST_NAME» (BIOES-префикс).
      const label = e.entity.replace(/^[BIUL]-/u, '');
      const group = GROUP_MAP[label];
      if (!group || e.score < 0.5) continue;
      result.push({ group, start: e.start, end: e.end, word: e.word, score: e.score });
    }
    return result;
  }
}

/** Заменяет найденные сущности на плейсхолдеры (слева направо, без пересечений). */
export function maskEntities(
  text: string,
  entities: NerEntity[],
): { text: string; applied: string[] } {
  const sorted = [...entities].sort((a, b) => a.start - b.start || b.end - a.end);
  let out = '';
  let cursor = 0;
  const applied: string[] = [];
  for (const e of sorted) {
    if (e.start < cursor) continue; // пересечение — пропускаем
    out += text.slice(cursor, e.start);
    const placeholder = e.group === 'NAME' ? '[ФИО]' : e.group === 'ADDRESS' ? '[АДРЕС]' : '[ПДН]';
    out += placeholder;
    applied.push(placeholder);
    cursor = e.end;
  }
  out += text.slice(cursor);
  return { text: out, applied };
}
