import type { Verdict } from './types.ts';

export class VerdictParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VerdictParseError';
  }
}

/** Достаёт первый JSON-объект из ответа LLM (устойчив к markdown-обёртке и мусору). */
export function extractJsonObject(raw: string): unknown {
  const noFences = raw.replace(/```(?:json)?/giu, '').trim();
  const start = noFences.indexOf('{');
  if (start === -1) throw new VerdictParseError('JSON object not found');
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < noFences.length; i += 1) {
    const ch = noFences[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(noFences.slice(start, i + 1)) as unknown;
      }
    }
  }
  throw new VerdictParseError('Unbalanced JSON object');
}

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Валидирует и нормализует ответ LLM в Verdict. */
export function parseAndValidateVerdict(raw: string): Verdict {
  const obj = extractJsonObject(raw);
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    throw new VerdictParseError('Root is not an object');
  }
  const record = obj as Record<string, unknown>;

  const scoreRaw = toNumber(record.score);
  const score = scoreRaw === null ? 5 : Math.min(10, Math.max(0, Math.round(scoreRaw)));

  const trafficLight = (() => {
    const value = String(record.trafficLight ?? '').toLowerCase();
    if (value === 'green' || value === 'yellow' || value === 'red') return value;
    if (score <= 3) return 'green';
    if (score <= 6) return 'yellow';
    return 'red';
  })();

  const risks = Array.isArray(record.risks)
    ? (record.risks as unknown[]).map((r) => {
        const item = (typeof r === 'object' && r !== null ? r : {}) as Record<string, unknown>;
        const severity = String(item.severity ?? 'low').toLowerCase();
        return {
          severity: (severity === 'high' || severity === 'medium' ? severity : 'low') as
            'low' | 'medium' | 'high',
          clause: String(item.clause ?? ''),
          description: String(item.description ?? ''),
          action: String(item.action ?? ''),
        };
      })
    : [];

  const recommendation = String(record.recommendation ?? 'Проверьте договор со специалистом.');

  return { score, trafficLight, risks, recommendation };
}
