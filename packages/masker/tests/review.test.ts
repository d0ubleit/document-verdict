import { describe, expect, it } from 'vitest';
import { applyCandidates, findCandidates, maskText } from '../src/mask.ts';

const SAMPLE =
  'Исполнитель: Иванов Иван Иванович, паспорт 4508 123456, выдан ОУФМС, тел. +7 916 123-45-67, сумма 45 000 руб.';

describe('findCandidates', () => {
  it('находит те же замены, что и maskText', () => {
    const review = findCandidates(SAMPLE);
    const full = maskText(SAMPLE);
    expect(review.candidates.length).toBe(full.replacements.length);
    const byType = (arr: { type: string }[]) =>
      Object.fromEntries(
        [...new Set(arr.map((r) => r.type))].map((t) => [
          t,
          arr.filter((r) => r.type === t).length,
        ]),
      );
    expect(byType(review.candidates)).toEqual(byType(full.replacements));
  });

  it('присваивает уникальные id', () => {
    const review = findCandidates(SAMPLE);
    const ids = review.candidates.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => Number.isInteger(id) && id >= 0)).toBe(true);
  });

  it('возвращает нормализованный текст и счётчик защищённых фрагментов', () => {
    const review = findCandidates(SAMPLE);
    expect(review.text).not.toContain('  ');
    expect(review.protectedCount).toBeGreaterThanOrEqual(1); // 45 000 руб.
  });
});

describe('applyCandidates', () => {
  it('со всеми кандидатами даёт тот же результат, что и maskText', () => {
    const review = findCandidates(SAMPLE);
    const viaApply = applyCandidates(review);
    const viaMask = maskText(SAMPLE);
    expect(viaApply.maskedText).toBe(viaMask.maskedText);
    expect(viaApply.replacements).toEqual(viaMask.replacements);
    expect(viaApply.protectedCount).toBe(viaMask.protectedCount);
  });

  it('исключённый кандидат остаётся в тексте без плейсхолдера', () => {
    const review = findCandidates(SAMPLE);
    const nameCandidate = review.candidates.find((c) => c.type === 'NAME');
    expect(nameCandidate).toBeDefined();
    const others = new Set(
      review.candidates.map((c) => c.id).filter((id) => id !== nameCandidate!.id),
    );
    const result = applyCandidates(review, others);
    expect(result.maskedText).toContain(nameCandidate!.raw);
    expect(result.maskedText).not.toContain('[ФИО]');
  });

  it('пустой набор id оставляет нормализованный текст без изменений', () => {
    const review = findCandidates(SAMPLE);
    const result = applyCandidates(review, new Set());
    expect(result.maskedText).toBe(review.text);
    expect(result.replacements).toHaveLength(0);
  });

  it('неизвестные id игнорируются (равносильно пустому выбору)', () => {
    const review = findCandidates(SAMPLE);
    const withUnknown = applyCandidates(review, new Set([999_999]));
    const empty = applyCandidates(review, new Set());
    expect(withUnknown.maskedText).toBe(empty.maskedText);
  });

  it('набор из всех реальных id + неизвестных равен полному маскированию', () => {
    const review = findCandidates(SAMPLE);
    const allPlusUnknown = new Set([...review.candidates.map((c) => c.id), 999_999]);
    const full = applyCandidates(review);
    expect(applyCandidates(review, allPlusUnknown).maskedText).toBe(full.maskedText);
  });

  it('подсчёт замен соответствует применённому подмножеству', () => {
    const review = findCandidates(SAMPLE);
    const id = review.candidates[0].id;
    const result = applyCandidates(review, new Set([id]));
    expect(result.replacements.length).toBe(1);
    expect(result.counts[result.replacements[0].type]).toBe(1);
  });
});
