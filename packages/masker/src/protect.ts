import type { ProtectedSpan } from './types.ts';

/** Контекст «даты рождения» — такие даты НЕ защищаем, их маскирует правило DOB. */
const BIRTH_CONTEXT = /(рождени|родился|родилась|год рождения|г\.р\.)/iu;

/** Контекст «даты выдачи» — такие даты НЕ защищаем, их маскирует правило DATE_ISSUE. */
const ISSUE_CONTEXT = /(выдан|выдано|выдачи|выданн|когда выдан)/iu;

/**
 * Есть ли контекстное слово в окне [index-radius, index) или [index+len, index+len+radiusAfter].
 */
export function hasContextNear(
  text: string,
  index: number,
  re: RegExp,
  radiusBefore = 60,
  radiusAfter = 40,
): boolean {
  const before = text.slice(Math.max(0, index - radiusBefore), index);
  const after = text.slice(index, index + radiusAfter);
  return re.test(before) || re.test(after);
}

/**
 * Вычисляет защищённые фрагменты: деньги, даты (кроме дат рождения),
 * ОГРН юрлиц, статьи законов, номера договоров.
 * Маскирующие правила не имеют права трогать эти фрагменты.
 */
export function computeProtectedSpans(text: string): ProtectedSpan[] {
  const spans: ProtectedSpan[] = [];

  const push = (start: number, end: number, reason: string) => {
    if (end <= start) return;
    spans.push({ start, end, reason });
  };

  // Деньги: 45 081 234,56 ₽ | 12 500 руб. | 1,5 млн руб. | 300 тыс.
  const money =
    /(?<!\d)\d{1,3}(?:\s?\d{3})*(?:[.,]\d{1,3})?\s*(?:₽|руб\.?|р\.|тыс\.|млн|миллион)/giu;
  for (const m of text.matchAll(money)) {
    push(m.index, m.index + m[0].length, 'money');
  }

  // Даты договора (дд.мм.гггг), кроме дат рождения и дат выдачи документов —
  // их маскируют правила DOB и DATE_ISSUE.
  // Контекст рождения ищем и до, и после даты («12.05.1980 года рождения»).
  const dates = /\b\d{1,2}\.\d{1,2}\.\d{4}\b/gu;
  for (const m of text.matchAll(dates)) {
    if (hasContextNear(text, m.index, BIRTH_CONTEXT, 40, 30)) continue;
    if (hasContextNear(text, m.index, ISSUE_CONTEXT, 35, 0)) continue;
    push(m.index, m.index + m[0].length, 'contract-date');
  }

  // ОГРН юрлица (13 цифр) — не ПДн, оставляем для контекста.
  const ogrn = /(?<![\d])\d{13}(?!\d)/gu;
  for (const m of text.matchAll(ogrn)) {
    push(m.index, m.index + m[0].length, 'ogrn');
  }

  // Статьи законов и пункты: ст. 45 ГК РФ, п. 3.2, ч. 2.
  // Обязательно число после ключа: иначе «п.» путается с инициалами «П.М.»,
  // и фамилия с инициалами на «П» не маскируется (реальный ГПХ).
  // (\b не работает перед кириллицей — используем Unicode-лукараунды.)
  const articles =
    /(?<![\p{L}\p{N}_])(?:ст\.|статья|п\.|пункт|ч\.|часть|раздел|глава)\s*\d[\dА-Яа-яёЁ.-]{0,11}/giu;
  for (const m of text.matchAll(articles)) {
    push(m.index, m.index + m[0].length, 'article');
  }

  // Номера договоров: № 12-ГПХ/2025.
  // НЕ защищаем «№» сразу после серии из 4 цифр — это серия+номер паспорта
  // («паспорт серия 9204 № 765432»), его должно маскировать правило PASSPORT.
  const docNums = /(?<![\p{N}] )(?<![\p{L}\p{N}_])(?:№|номер)\s*[\d/А-ЯЁа-яё-]{1,24}/giu;
  for (const m of text.matchAll(docNums)) {
    push(m.index, m.index + m[0].length, 'doc-number');
  }

  // Сливаем пересекающиеся фрагменты.
  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: ProtectedSpan[] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s.start < last.end) {
      if (s.end > last.end) last.end = s.end;
    } else {
      merged.push({ ...s });
    }
  }
  return merged;
}

/** Пересекается ли интервал с защищённым фрагментом. */
export function isProtected(
  span: { start: number; end: number },
  protectedSpans: ProtectedSpan[],
): boolean {
  return protectedSpans.some((p) => span.start < p.end && span.end > p.start);
}
