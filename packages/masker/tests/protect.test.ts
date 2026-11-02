import { describe, expect, it } from 'vitest';
import { maskText } from '../src/mask.ts';

describe('защита от маскирования (деньги, даты, ОГРН, статьи)', () => {
  it('не маскирует денежные суммы', () => {
    const r = maskText('Стоимость: 45 081 234,56 ₽ и 12 500 руб., аванс 1,5 млн руб.');
    expect(r.maskedText).toContain('45 081 234,56 ₽');
    expect(r.maskedText).toContain('12 500 руб.');
    expect(r.maskedText).toContain('1,5 млн руб.');
  });

  it('не маскирует даты договора', () => {
    const r = maskText('Договор заключён 01.03.2025, срок до 31.12.2025.');
    expect(r.maskedText).toContain('01.03.2025');
    expect(r.maskedText).toContain('31.12.2025');
  });

  it('не маскирует ОГРН юрлица, но маскирует ИНН', () => {
    const r = maskText('ОГРН 1027700132195, ИНН 7701234567.');
    expect(r.maskedText).toContain('1027700132195');
    expect(r.maskedText).toContain('[ИНН]');
  });

  it('не маскирует статьи закона и номера договоров', () => {
    const r = maskText('согласно ст. 702 ГК РФ, п. 3.2 договора № 12-ГПХ/2025');
    expect(r.maskedText).toContain('ст. 702 ГК РФ');
    expect(r.maskedText).toContain('№ 12-ГПХ/2025');
  });

  it('не путает «4+6» без контекста с паспортом', () => {
    const r = maskText('Сумма: 4500 123456 руб.');
    expect(r.maskedText).toContain('4500 123456 руб.');
  });
});
