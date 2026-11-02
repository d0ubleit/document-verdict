import type {
  Candidate,
  MaskOptions,
  MaskResult,
  MaskReview,
  Replacement,
  PlaceholderType,
} from './types.ts';
import { placeholderFor, ALL_PLACEHOLDER_TYPES } from './placeholders.ts';
import { computeProtectedSpans, isProtected } from './protect.ts';
import { RULES } from './rules.ts';

/** Нормализация: NBSP → обычный пробел, сжатие пробелов. */
export function normalize(text: string): string {
  return text
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Убирает пересекающиеся кандидаты: сортировка по start, при равенстве — длиннее первым. */
function dedupeCandidates(candidates: Candidate[]): Candidate[] {
  const sorted = [...candidates].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Candidate[] = [];
  for (const c of sorted) {
    const last = out[out.length - 1];
    if (last && c.start < last.end) continue; // пересечение — оставляем первый (он длиннее)
    out.push(c);
  }
  return out;
}

function applyReplacements(
  text: string,
  candidates: Candidate[],
): { out: string; replacements: Replacement[] } {
  let out = '';
  let cursor = 0;
  const replacements: Replacement[] = [];
  for (const c of candidates) {
    out += text.slice(cursor, c.start);
    const placeholder = placeholderFor(c.type);
    out += placeholder;
    replacements.push({ type: c.type, placeholder, original: c.raw });
    cursor = c.end;
  }
  out += text.slice(cursor);
  return { out, replacements };
}

function countByType(replacements: Replacement[]): Record<PlaceholderType, number> {
  const counts = {} as Record<PlaceholderType, number>;
  for (const type of ALL_PLACEHOLDER_TYPES) {
    counts[type] = 0;
  }
  for (const r of replacements) {
    counts[r.type] += 1;
  }
  return counts;
}

/**
 * Поиск кандидатов на маскирование без применения замен.
 * Возвращает нормализованный текст, кандидатов (с уникальными id) и число
 * защищённых фрагментов. Используется экраном «подтвердите замены».
 */
export function findCandidates(text: string, opts: MaskOptions = {}): MaskReview {
  const normalized = normalize(text);
  const protectedSpans = computeProtectedSpans(normalized);

  const raw: Candidate[] = [];
  for (const rule of RULES) {
    if (rule.aggressiveOnly && !opts.aggressive) continue;
    for (const m of normalized.matchAll(rule.pattern)) {
      if (rule.test && !rule.test(m, normalized)) continue;
      const span = { start: m.index, end: m.index + m[0].length };
      if (isProtected(span, protectedSpans)) continue;
      raw.push({ type: rule.type, start: span.start, end: span.end, raw: m[0], id: -1 });
    }
  }

  // id присваиваются ПОСЛЕ дедупликации — стабильные и уникальные.
  const candidates = dedupeCandidates(raw).map((c, i) => ({ ...c, id: i }));

  return { text: normalized, candidates, protectedCount: protectedSpans.length };
}

/**
 * Применяет выбранное подмножество кандидатов к нормализованному тексту.
 * Без selectedIds применяются все; неизвестные id игнорируются.
 */
export function applyCandidates(review: MaskReview, selectedIds?: ReadonlySet<number>): MaskResult {
  const chosen =
    selectedIds === undefined
      ? review.candidates
      : review.candidates.filter((c) => selectedIds.has(c.id));
  const { out, replacements } = applyReplacements(review.text, chosen);
  return {
    maskedText: out,
    replacements,
    counts: countByType(replacements),
    protectedCount: review.protectedCount,
  };
}

/**
 * Главная функция: маскирует ПДн в тексте.
 * Вызывается ТОЛЬКО на клиенте (браузер). На сервер уходит maskedText.
 */
export function maskText(text: string, opts: MaskOptions = {}): MaskResult {
  return applyCandidates(findCandidates(text, opts));
}
