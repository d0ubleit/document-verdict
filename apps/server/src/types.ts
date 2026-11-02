/** Общие типы сервера. */

export const DOCUMENT_TYPES = [
  'gph',
  'services',
  'offer',
  'contract-work',
  'rent',
  'credit',
  'mortgage',
  'loan',
  'sale',
  'self-employed',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export type Severity = 'low' | 'medium' | 'high';
export type TrafficLight = 'green' | 'yellow' | 'red';

export interface RiskItem {
  severity: Severity;
  /** Ссылка на пункт договора (плейсхолдеры — не цитируем значения). */
  clause: string;
  description: string;
  action: string;
}

export interface Verdict {
  /** Оценка рисков: 0 (безопасно) … 10 (крайне рискованно). */
  score: number;
  trafficLight: TrafficLight;
  risks: RiskItem[];
  recommendation: string;
}

export interface VerifyRequest {
  documentType: DocumentType;
  /** Обезличенный на клиенте текст документа. */
  maskedText: string;
  /** Опционально: id оплаченного платежа (mock-режим ЮKassa). */
  paymentId?: string;
}

export interface VerifyResponse {
  verdict: Verdict;
  /** true — сервер до-обезличил остатки перед отправкой в ИИ. */
  anonymizedOnServer: boolean;
  /** Плейсхолдеры, применённые сервером. */
  maskedAgain: string[];
  /** true — вердикт получен по оплаченному платежу. */
  paid: boolean;
}
