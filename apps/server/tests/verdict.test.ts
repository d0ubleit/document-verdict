import { describe, expect, it } from 'vitest';
import { extractJsonObject, parseAndValidateVerdict, VerdictParseError } from '../src/verdict.ts';

const VALID = JSON.stringify({
  score: 7,
  trafficLight: 'red',
  risks: [
    { severity: 'high', clause: 'п. 4.2', description: 'Неустойка 1% в день', action: 'Оспорить' },
  ],
  recommendation: 'Не подписывайте в текущем виде',
});

describe('extractJsonObject', () => {
  it('извлекает JSON из markdown-обёртки', () => {
    const obj = extractJsonObject('```json\n' + VALID + '\n```');
    expect((obj as { score: number }).score).toBe(7);
  });

  it('извлекает JSON с текстом до и после', () => {
    const obj = extractJsonObject('Вот результат:\n' + VALID + '\nНадеюсь, поможет.');
    expect((obj as { score: number }).score).toBe(7);
  });

  it('бросает VerdictParseError без JSON-объекта', () => {
    expect(() => extractJsonObject('просто текст')).toThrow(VerdictParseError);
  });

  it('бросает VerdictParseError при несбалансированных скобках', () => {
    expect(() => extractJsonObject('{"score": 5')).toThrow(VerdictParseError);
  });
});

describe('parseAndValidateVerdict', () => {
  it('парсит корректный вердикт', () => {
    const v = parseAndValidateVerdict(VALID);
    expect(v.score).toBe(7);
    expect(v.trafficLight).toBe('red');
    expect(v.risks).toHaveLength(1);
    expect(v.risks[0].severity).toBe('high');
  });

  it('выводит светофор из оценки при неверном значении', () => {
    const v = parseAndValidateVerdict('{"score": 2, "trafficLight": "purple", "risks": []}');
    expect(v.trafficLight).toBe('green');
  });

  it('заполняет пропущенные поля значениями по умолчанию', () => {
    const v = parseAndValidateVerdict('{}');
    expect(v.score).toBe(5);
    expect(v.trafficLight).toBe('yellow');
    expect(v.risks).toEqual([]);
    expect(v.recommendation.length).toBeGreaterThan(0);
  });

  it('ограничивает оценку диапазоном 0-10', () => {
    expect(parseAndValidateVerdict('{"score": 99}').score).toBe(10);
    expect(parseAndValidateVerdict('{"score": -5}').score).toBe(0);
  });

  it('нормализует severity рисков', () => {
    const v = parseAndValidateVerdict(
      '{"risks": [{"severity": "HIGH"}, {"severity": "unknown"}, {"severity": "medium"}]}',
    );
    expect(v.risks.map((r) => r.severity)).toEqual(['high', 'low', 'medium']);
  });

  it('бросает VerdictParseError на мусоре', () => {
    expect(() => parseAndValidateVerdict('не JSON')).toThrow(VerdictParseError);
  });
});
