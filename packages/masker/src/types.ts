/**
 * Типы модуля маскирования.
 * Всё работает на клиенте (браузер) — сервер получает только обезличенный текст.
 */

/** Категории персональных данных, которые мы маскируем. */
export type PlaceholderType =
  | 'PASSPORT'
  | 'INN'
  | 'SNILS'
  | 'PHONE'
  | 'EMAIL'
  | 'ACCOUNT'
  | 'DOB'
  | 'DATE_ISSUE'
  | 'ISSUED_BY'
  | 'COMPANY'
  | 'NAME'
  | 'ADDRESS';

/** Найденный кандидат на замену. */
export interface Candidate {
  type: PlaceholderType;
  /** Начало вхождения в нормализованном тексте (индекс). */
  start: number;
  /** Конец вхождения (индекс, не включительно). */
  end: number;
  /** Оригинальный фрагмент. */
  raw: string;
  /** Стабильный идентификатор для выбора подмножества (см. applyCandidates). */
  id: number;
}

/**
 * Результат поиска кандидатов без применения: пользователь проверяет список
 * (экран «Мы заменили... — подтвердите») и подтверждает выбранное.
 */
export interface MaskReview {
  /** Нормализованный текст (источник для applyCandidates). */
  text: string;
  candidates: Candidate[];
  protectedCount: number;
}

/** Защищённый фрагмент: деньги, даты договора, ОГРН и т.п. — маскировать запрещено. */
export interface ProtectedSpan {
  start: number;
  end: number;
  reason: string;
}

/** Одна выполненная замена. */
export interface Replacement {
  type: PlaceholderType;
  placeholder: string;
  original: string;
}

export interface MaskResult {
  /** Текст с плейсхолдерами вместо ПДн. */
  maskedText: string;
  /** Список замен (для экрана «Мы заменили...»). */
  replacements: Replacement[];
  /** Сводка по категориям. */
  counts: Record<PlaceholderType, number>;
  /** Сколько вхождений защищено от маскирования (деньги, даты...). */
  protectedCount: number;
}

export interface MaskOptions {
  /** Использовать NER-модель (тяжелее; по умолчанию false). */
  useNer?: boolean;
  /** Агрессивный режим: маскировать даже без контекстных слов. */
  aggressive?: boolean;
}
