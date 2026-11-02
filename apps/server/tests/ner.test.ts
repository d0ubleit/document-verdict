import { describe, expect, it } from 'vitest';
import { maskEntities } from '../src/ner.ts';
import type { NerEntity } from '../src/ner.ts';

describe('maskEntities', () => {
  it('заменяет имена и адреса на плейсхолдеры', () => {
    const entities: NerEntity[] = [
      { group: 'NAME', start: 0, end: 6, word: 'Иванов', score: 0.99 },
      { group: 'ADDRESS', start: 26, end: 32, word: 'Москве', score: 0.99 },
    ];
    const r = maskEntities('Иванов подписал договор в Москве', entities);
    expect(r.text).toBe('[ФИО] подписал договор в [АДРЕС]');
    expect(r.applied).toEqual(['[ФИО]', '[АДРЕС]']);
  });

  it('пропускает пересекающиеся сущности', () => {
    const entities: NerEntity[] = [
      { group: 'NAME', start: 0, end: 11, word: 'Иванов Иван', score: 0.99 },
      { group: 'NAME', start: 7, end: 11, word: 'Иван', score: 0.6 },
    ];
    const r = maskEntities('Иванов Иван идёт', entities);
    expect(r.text).toBe('[ФИО] идёт');
  });

  it('работает с пустым списком', () => {
    const r = maskEntities('текст без сущностей', []);
    expect(r.text).toBe('текст без сущностей');
    expect(r.applied).toEqual([]);
  });
});
