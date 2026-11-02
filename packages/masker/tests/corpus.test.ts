import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { maskText } from '../src/mask.ts';
import type { PlaceholderType } from '../src/types.ts';

/**
 * Два корпуса:
 * - ../corpus/ — синтетические договоры с вымышленными ПДн (быстрый юнит-гейт);
 * - ../corpus-real/ — реальные договоры из интернета (интеграционный гейт).
 * Формат заголовков файлов: EXPECT: КАТЕГОРИЯ=N ... | KEEP: подстрока |
 * LEAK: подстрока | NO_MASK: 1 (в файле не должно быть ни одной замены).
 */
const CORPUS_DIRS = ['../corpus/', '../corpus-real/'].map((dir) =>
  fileURLToPath(new URL(dir, import.meta.url)),
);

interface CorpusCase {
  file: string;
  expected: Partial<Record<PlaceholderType, number>>;
  keep: string[];
  leak: string[];
  noMask: boolean;
  document: string;
}

function loadCorpus(): CorpusCase[] {
  const cases: CorpusCase[] = [];
  for (const dir of CORPUS_DIRS) {
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.txt'))) {
      const raw = readFileSync(dir + file, 'utf8');
      const expected: Partial<Record<PlaceholderType, number>> = {};
      const keep: string[] = [];
      const leak: string[] = [];
      let noMask = false;
      const body: string[] = [];
      for (const line of raw.split('\n')) {
        if (line.startsWith('EXPECT:')) {
          for (const part of line.slice(7).trim().split(/\s+/)) {
            const [cat, num] = part.split('=');
            if (cat && num) expected[cat as PlaceholderType] = Number(num);
          }
        } else if (line.startsWith('KEEP:')) {
          keep.push(line.slice(5).trim());
        } else if (line.startsWith('LEAK:')) {
          leak.push(line.slice(5).trim());
        } else if (line.startsWith('NO_MASK:')) {
          noMask = line.slice(8).trim() === '1';
        } else {
          body.push(line);
        }
      }
      cases.push({ file, expected, keep, leak, noMask, document: body.join('\n') });
    }
  }
  return cases;
}

const cases = loadCorpus();

describe('тестовый корпус договоров (recall ПДн)', () => {
  it('корпус загружен (не пуст)', () => {
    expect(cases.length).toBeGreaterThanOrEqual(15);
  });

  for (const c of cases) {
    it(`${c.file}: все ожидаемые категории ПДн найдены, ничего не протекло`, () => {
      const r = maskText(c.document);
      for (const [cat, min] of Object.entries(c.expected)) {
        expect(
          r.counts[cat as PlaceholderType],
          `${c.file}: категория ${cat}`,
        ).toBeGreaterThanOrEqual(min ?? 0);
      }
      for (const k of c.keep) {
        expect(r.maskedText, `${c.file}: должно остаться «${k}»`).toContain(k);
      }
      for (const l of c.leak) {
        expect(r.maskedText, `${c.file}: протекла ПДн «${l}»`).not.toContain(l);
      }
      if (c.noMask) {
        expect(
          r.replacements.length,
          `${c.file}: шаблон не должен содержать замен, найдено: ${JSON.stringify(r.replacements)}`,
        ).toBe(0);
      }
    });
  }
});

describe('сводная метрика recall по корпусу', () => {
  it('recall = 100% по каждой категории', () => {
    const totals: Record<string, { expected: number; detected: number }> = {};
    for (const c of cases) {
      const r = maskText(c.document);
      for (const [cat, min] of Object.entries(c.expected)) {
        totals[cat] ??= { expected: 0, detected: 0 };
        totals[cat].expected += min ?? 0;
        totals[cat].detected += r.counts[cat as PlaceholderType] ?? 0;
      }
    }
    console.log('RECALL по корпусу:', JSON.stringify(totals, null, 2));
    for (const [cat, t] of Object.entries(totals)) {
      expect(
        t.detected,
        `категория ${cat}: ожидалось ${t.expected}, найдено ${t.detected}`,
      ).toBeGreaterThanOrEqual(t.expected);
    }
  });
});
