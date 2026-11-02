import type { PlaceholderType } from './types.ts';

/** Единый словарь плейсхолдеров — стабильные токены для промпта и UI. */
export const PLACEHOLDER_BY_TYPE: Record<PlaceholderType, string> = {
  PASSPORT: '[ПАСПОРТ]',
  INN: '[ИНН]',
  SNILS: '[СНИЛС]',
  PHONE: '[ТЕЛЕФОН]',
  EMAIL: '[EMAIL]',
  ACCOUNT: '[СЧЁТ]',
  DOB: '[ДАТА_РОЖДЕНИЯ]',
  DATE_ISSUE: '[ДАТА_ВЫДАЧИ]',
  ISSUED_BY: '[КЕМ_ВЫДАН]',
  COMPANY: '[КОМПАНИЯ]',
  NAME: '[ФИО]',
  ADDRESS: '[АДРЕС]',
};

export function placeholderFor(type: PlaceholderType): string {
  return PLACEHOLDER_BY_TYPE[type];
}

export const ALL_PLACEHOLDER_TYPES = Object.keys(PLACEHOLDER_BY_TYPE) as PlaceholderType[];
