import { describe, expect, it } from 'vitest';
import { maskText } from '../src/mask.ts';

describe('правила маскирования', () => {
  it('паспорт с контекстом', () => {
    const r = maskText('паспорт 4508 123456, выдан ОУФМС');
    expect(r.maskedText).toContain('[ПАСПОРТ]');
    expect(r.maskedText).not.toContain('4508 123456');
  });

  it('паспорт «серия + №»', () => {
    const r = maskText('паспорт серия 9204 № 765432');
    expect(r.counts.PASSPORT).toBe(1);
  });

  it('паспорт с разделителем «номер» (реальный договор займа)', () => {
    const r = maskText('паспорт гражданина РФ серия 1234 номер 123456, выданный ОУФМС');
    expect(r.counts.PASSPORT).toBe(1);
    expect(r.maskedText).not.toContain('1234 номер 123456');
  });

  it('паспорт с серией через пробел «45 08 № 123456»', () => {
    const r = maskText('паспорт: серия 45 08 № 123456, выдан ОУФМС');
    expect(r.counts.PASSPORT).toBe(1);
    expect(r.maskedText).not.toContain('45 08 № 123456');
  });

  it('паспорт «45 08 123456» (серия и номер через пробелы)', () => {
    const r = maskText('паспорт 45 08 123456, выдан ОУФМС');
    expect(r.counts.PASSPORT).toBe(1);
    expect(r.maskedText).not.toContain('45 08 123456');
  });

  it('слитный паспорт из 10 цифр с контекстом → [ПАСПОРТ], а не [ИНН]', () => {
    const r = maskText('паспорт 4508123456, выдан ОУФМС');
    expect(r.counts.PASSPORT).toBe(1);
    expect(r.counts.INN).toBe(0);
  });

  it('СНИЛС без дефисов с контекстом', () => {
    const r = maskText('СНИЛС 12345678901');
    expect(r.counts.SNILS).toBe(1);
    expect(r.maskedText).not.toContain('12345678901');
  });

  it('телефон из 11 цифр не путается со СНИЛС', () => {
    const r = maskText('тел. 89161234567');
    expect(r.counts.PHONE).toBe(1);
    expect(r.counts.SNILS).toBe(0);
  });

  it('«место рождения: г. Москва» — город маскируется', () => {
    const r = maskText('место рождения: г. Москва, 12.05.1980 года рождения');
    expect(r.counts.ADDRESS).toBeGreaterThanOrEqual(1);
    expect(r.maskedText).not.toContain('Москва');
  });

  it('двойная фамилия «Иванов-Петров Иван Иванович»', () => {
    const r = maskText('гражданин Иванов-Петров Иван Иванович');
    expect(r.counts.NAME).toBe(1);
    expect(r.maskedText).not.toContain('Иванов-Петров');
  });

  it('одиночная фамилия в подписи «Подписал: Иванов»', () => {
    const r = maskText('Подписал: Иванов');
    expect(r.counts.NAME).toBe(1);
    expect(r.maskedText).not.toContain('Иванов');
  });

  it('одиночная фамилия не маскирует роли («в лице Директора общества»)', () => {
    const r = maskText('в лице Директора общества, Морозова Александра Степановича');
    expect(r.counts.NAME).toBe(1);
    expect(r.maskedText).not.toContain('Морозова');
  });

  it('паспорт без контекста не маскируется', () => {
    const r = maskText('сумма 4500 123456 руб.');
    expect(r.maskedText).toContain('4500 123456');
  });

  it('ИНН 10 и 12 цифр', () => {
    const r = maskText('ИНН 7701234567 и ИНН 770112345678');
    expect(r.counts.INN).toBe(2);
  });

  it('СНИЛС', () => {
    const r = maskText('СНИЛС 123-456-789 01');
    expect(r.counts.SNILS).toBe(1);
  });

  it('телефоны в разных форматах', () => {
    const r = maskText('+7 916 123-45-67 и 8 (916) 555-12-34');
    expect(r.counts.PHONE).toBe(2);
  });

  it('email', () => {
    const r = maskText('почта ivanov@example.com');
    expect(r.counts.EMAIL).toBe(1);
  });

  it('расчётный счёт 20 цифр', () => {
    const r = maskText('счёт 40817810900000012345');
    expect(r.counts.ACCOUNT).toBe(1);
  });

  it('дата рождения с контекстом «года рождения»', () => {
    const r = maskText('12.05.1980 года рождения');
    expect(r.counts.DOB).toBe(1);
    expect(r.maskedText).not.toContain('12.05.1980');
  });

  it('дата рождения с «г.р.»', () => {
    const r = maskText('03.07.1988 г.р.');
    expect(r.counts.DOB).toBe(1);
  });

  it('дата выдачи паспорта маскируется («выдан 01.01.2010»)', () => {
    const r = maskText('паспорт 4508 123456, выдан 01.01.2010');
    expect(r.counts.DATE_ISSUE).toBe(1);
    expect(r.maskedText).not.toContain('01.01.2010');
  });

  it('дата договора не путается с датой выдачи', () => {
    const r = maskText('Договор заключён 01.03.2025, срок до 31.12.2025');
    expect(r.counts.DATE_ISSUE).toBe(0);
    expect(r.maskedText).toContain('01.03.2025');
  });

  it('код подразделения маскируется', () => {
    const r = maskText('паспорт 4508 123456, код подразделения 770-123, выдан ОУФМС');
    expect(r.counts.PASSPORT).toBe(2);
    expect(r.maskedText).not.toContain('770-123');
  });

  it('инициалы «П.М.» не блокируются защитой статей закона (реальный ГПХ)', () => {
    const r = maskText('__________________ / Сургутский П.М./');
    expect(r.counts.NAME).toBe(1);
    expect(r.maskedText).not.toContain('Сургутский');
  });

  it('«кем выдан» маскируется (УФМС России по гор. Москве по району Ховрино)', () => {
    const r = maskText(
      'паспорт 4508 123456, выдан 08.05.2013г. УФМС России по гор. Москве по району Ховрино',
    );
    expect(r.counts.ISSUED_BY).toBe(1);
    expect(r.maskedText).not.toContain('УФМС');
    expect(r.maskedText).not.toContain('Ховрино');
  });

  it('адрес без точек («г Одинцово, ул Молодежная, дом 46»)', () => {
    const r = maskText(
      '143007, Московская область, г.о. Одинцовский, г Одинцово, ул Молодежная, дом 46',
    );
    expect(r.counts.ADDRESS).toBeGreaterThanOrEqual(2);
    expect(r.maskedText).not.toContain('Молодежная');
  });

  it('ИП + фамилия', () => {
    const r = maskText('ИП Морозова Ольга');
    expect(r.counts.COMPANY).toBe(1);
  });

  it('ФИО тремя словами маскируется с контекстом человека', () => {
    const r = maskText('Исполнитель: Иванов Иван Иванович');
    expect(r.counts.NAME).toBe(1);
    expect(r.maskedText).toContain('[ФИО]');
  });

  it('ФИО после «в лице генерального директора» (реальная оферта)', () => {
    const r = maskText('в лице генерального директора Ромашкина Дмитрия Алексеевича заключить');
    expect(r.counts.NAME).toBe(1);
    expect(r.maskedText).not.toContain('Ромашкина');
  });

  it('названия организаций из трёх слов не маскируются', () => {
    const r = maskText('проект «Центр правовой поддержки» и «Школа Катерины Ромашкиной»');
    expect(r.counts.NAME).toBe(0);
  });

  it('ФИО с инициалами', () => {
    const r = maskText('Иванов И.И.');
    expect(r.counts.NAME).toBe(1);
  });

  it('инициалы без финальной точки (реальные правила страхования)', () => {
    const r = maskText('Приказом Генерального директора ООО «РБ Страхование» Гаврилова Д.А');
    expect(r.counts.NAME).toBe(1);
    expect(r.maskedText).not.toContain('Гаврилова');
  });

  it('«гр.» + полное ФИО маскируется целиком', () => {
    const r = maskText('Я, гр. Лебедев Игорь Васильевич,');
    expect(r.counts.NAME).toBe(1);
    expect(r.maskedText).not.toContain('Лебедев');
    expect(r.maskedText).not.toContain('Васильевич');
  });

  it('адрес: город + улица + дом + квартира', () => {
    const r = maskText('г. Москва, ул. Ленина, д. 5, кв. 12');
    expect(r.counts.ADDRESS).toBeGreaterThanOrEqual(1);
    expect(r.maskedText).not.toContain('Ленина');
    expect(r.maskedText).not.toContain('кв. 12');
  });

  it('город без улицы и адресного контекста не маскируется (название органа)', () => {
    const r = maskText('Управление ФАС России по г. Москве');
    expect(r.counts.ADDRESS).toBe(0);
  });

  it('город с адресным контекстом маскируется', () => {
    const r = maskText('проживающий по адресу: 123456, г. Москва');
    expect(r.counts.ADDRESS).toBeGreaterThanOrEqual(1);
  });

  it('подпись с повтором фамилии маскируется целиком (реальный договор займа)', () => {
    const r = maskText('Иванов         Иванов Е.И.');
    expect(r.counts.NAME).toBe(1);
    expect(r.maskedText).not.toContain('Иванов');
  });

  it('не маскирует обычный текст про юрлицо', () => {
    const r = maskText('Общество с ограниченной ответственностью «Ромашка»');
    expect(r.counts.NAME).toBe(0);
    expect(r.counts.COMPANY).toBe(0);
  });

  it('агрессивный режим маскирует почтовые индексы', () => {
    const r1 = maskText('адрес: 123456, г. Москва', { aggressive: false });
    const r2 = maskText('адрес: 123456, г. Москва', { aggressive: true });
    expect(r1.counts.ADDRESS).toBe(1);
    expect(r2.counts.ADDRESS).toBe(2);
  });

  it('возвращает список замен и сводку', () => {
    const r = maskText('Исполнитель: Иванов Иван Иванович, тел. +7 916 123-45-67');
    expect(r.replacements.length).toBe(2);
    expect(r.replacements[0].placeholder).toBe('[ФИО]');
    expect(r.counts.NAME).toBe(1);
    expect(r.counts.PHONE).toBe(1);
  });
});
