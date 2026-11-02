import { applyCandidates, extractText, findCandidates } from '../../../packages/masker/src/index';
import type { MaskResult, MaskReview, PlaceholderType } from '../../../packages/masker/src/types';
import * as pdfjsLib from 'pdfjs-dist';

// PDF worker для браузера (извлечение текста из PDF на клиенте).
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// Примеры из корпуса (raw-импорт: файлы попадают в бандл).
import gph from '../../../packages/masker/corpus/dogovor-gph.txt?raw';
import arenda from '../../../packages/masker/corpus/arenda-kvartiry.txt?raw';
import kredit from '../../../packages/masker/corpus/kreditnyj-dogovor.txt?raw';
import doverennost from '../../../packages/masker/corpus/doverennost.txt?raw';
import samozanyaty from '../../../packages/masker/corpus/dogovor-s-samozanyatym.txt?raw';

const EXAMPLES: { name: string; text: string }[] = [
  { name: 'Договор ГПХ', text: stripHeader(gph) },
  { name: 'Аренда квартиры', text: stripHeader(arenda) },
  { name: 'Кредитный договор', text: stripHeader(kredit) },
  { name: 'Доверенность', text: stripHeader(doverennost) },
  { name: 'Договор с самозанятым', text: stripHeader(samozanyaty) },
];

/** Убирает служебные строки EXPECT/KEEP/LEAK из примера. */
function stripHeader(text: string): string {
  return text
    .split('\n')
    .filter((l) => !/^(EXPECT|KEEP|LEAK):/i.test(l))
    .join('\n');
}

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T;

const API_BASE = 'http://localhost:3000';

const DOC_TYPES: { value: string; label: string }[] = [
  { value: 'gph', label: 'ГПХ с физическим лицом' },
  { value: 'services', label: 'Оказание услуг' },
  { value: 'offer', label: 'Публичная оферта' },
  { value: 'contract-work', label: 'Подряд' },
  { value: 'rent', label: 'Аренда' },
  { value: 'credit', label: 'Кредитный договор' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'loan', label: 'Займ' },
  { value: 'sale', label: 'Купля-продажа' },
  { value: 'self-employed', label: 'С самозанятым' },
];

const exampleSelect = $<HTMLSelectElement>('#example');
const fileInput = $<HTMLInputElement>('#file');
const inputEl = $<HTMLTextAreaElement>('#input');
const outputEl = $<HTMLTextAreaElement>('#output');
const statsEl = $<HTMLElement>('#stats');
const replacementsEl = $<HTMLElement>('#replacements');
const verdictPanelEl = $<HTMLElement>('#verdict-panel');
const verdictResultEl = $<HTMLElement>('#verdict-result');
const docTypeSelect = $<HTMLSelectElement>('#doc-type');
const getVerdictBtn = $<HTMLButtonElement>('#get-verdict');
const payStatusEl = $<HTMLElement>('#pay-status');

for (const t of DOC_TYPES) {
  const opt = document.createElement('option');
  opt.value = t.value;
  opt.textContent = t.label;
  docTypeSelect.appendChild(opt);
}

/** Последний подтверждённый обезличенный текст — источник для вердикта. */
let lastMaskedText = '';
/** Id оплаченного мок-платежа (если пользователь прошёл демо-оплату). */
let lastPaymentId: string | null = null;

for (const ex of EXAMPLES) {
  const opt = document.createElement('option');
  opt.value = ex.name;
  opt.textContent = ex.name;
  exampleSelect.appendChild(opt);
}
inputEl.value = EXAMPLES[0].text;

exampleSelect.addEventListener('change', () => {
  const ex = EXAMPLES.find((e) => e.name === exampleSelect.value);
  if (ex) inputEl.value = ex.text;
});

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const btn = $<HTMLButtonElement>('#mask');
  btn.disabled = true;
  btn.textContent = 'Извлекаем текст…';
  try {
    // PDF/DOCX/сканы/HTML/TXT — всё извлекается на устройстве пользователя.
    const doc = await extractText(file);
    inputEl.value = doc.text;
    statsEl.innerHTML = `<p>Извлечено из <strong>${doc.fileName}</strong> (${doc.format}): ${doc.text.length} символов. Нажмите «Маскировать».</p>`;
  } catch (error) {
    statsEl.innerHTML = `<p class="error">Не удалось извлечь текст: ${error instanceof Error ? error.message : String(error)}</p>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Маскировать';
  }
});

const reviewEl = $<HTMLElement>('#review');
const reviewListEl = $<HTMLElement>('#review-list');

$<HTMLButtonElement>('#mask').addEventListener('click', () => {
  // Шаг 1: найти кандидатов, НЕ применяя замены (экран «подтвердите замены»).
  const review = findCandidates(inputEl.value);

  if (review.candidates.length === 0) {
    reviewEl.hidden = true;
    renderResult({
      maskedText: review.text,
      replacements: [],
      counts: {} as MaskResult['counts'],
      protectedCount: review.protectedCount,
    });
    return;
  }

  renderReview(review);
});

function renderReview(review: MaskReview): void {
  reviewEl.hidden = false;
  verdictPanelEl.hidden = true;
  replacementsEl.innerHTML = '';
  outputEl.value = '';
  statsEl.innerHTML = `
    <p>Найдено <strong>${review.candidates.length}</strong> вхождений персональных данных.
    Защищено от маскирования: <strong>${review.protectedCount}</strong> фрагментов (деньги, даты, ОГРН).</p>
  `;

  const rows = review.candidates
    .map(
      (c) => `
      <label class="review-row">
        <input type="checkbox" data-id="${c.id}" checked />
        <code>${c.type}</code>
        <span class="mono">${escapeHtml(c.raw)}</span>
      </label>`,
    )
    .join('');
  reviewListEl.innerHTML = rows;

  $<HTMLButtonElement>('#confirm').addEventListener('click', () => {
    const selected = new Set<number>();
    reviewListEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((box) => {
      if (box.checked) selected.add(Number(box.dataset.id));
    });
    reviewEl.hidden = true;
    renderResult(applyCandidates(review, selected));
  });

  $<HTMLButtonElement>('#cancel-review').addEventListener('click', () => {
    reviewEl.hidden = true;
    replacementsEl.innerHTML = '';
  });
}

function renderResult(result: MaskResult): void {
  outputEl.value = result.maskedText;
  lastMaskedText = result.maskedText;
  verdictPanelEl.hidden = false;
  verdictResultEl.innerHTML = '';

  const cats = Object.entries(result.counts)
    .filter(([, n]) => n > 0)
    .map(([c, n]) => `${c}: ${n}`)
    .join(' · ');

  statsEl.innerHTML = `
    <p>
      <strong>Заменено:</strong> ${result.replacements.length} вхождений
      (${cats || 'ничего не найдено'}) ·
      <strong>Защищено от маскирования:</strong> ${result.protectedCount} фрагментов (деньги, даты, ОГРН)
    </p>
  `;

  if (result.replacements.length === 0) {
    replacementsEl.innerHTML =
      '<p class="muted">Замен нет — похоже, персональных данных в тексте не нашлось.</p>';
    return;
  }

  const rows = result.replacements
    .map(
      (r) =>
        `<tr><td><code>${r.placeholder}</code></td><td>${escapeHtml(r.type)}</td><td class="mono">${escapeHtml(r.original)}</td></tr>`,
    )
    .join('');
  replacementsEl.innerHTML = `
    <h2>Что заменили (${result.replacements.length})</h2>
    <table>
      <thead><tr><th>Плейсхолдер</th><th>Категория</th><th>Оригинал</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

$<HTMLButtonElement>('#copy').addEventListener('click', async () => {
  await navigator.clipboard.writeText(outputEl.value);
  const btn = $<HTMLButtonElement>('#copy');
  btn.textContent = 'Скопировано ✓';
  setTimeout(() => (btn.textContent = 'Копировать результат'), 1500);
});

interface RiskItemView {
  severity: 'low' | 'medium' | 'high';
  clause: string;
  description: string;
  action: string;
}

interface VerdictView {
  score: number;
  trafficLight: 'green' | 'yellow' | 'red';
  risks: RiskItemView[];
  recommendation: string;
}

interface VerifyResponseView {
  verdict: VerdictView;
  anonymizedOnServer: boolean;
  maskedAgain: string[];
  paid: boolean;
}

const SEVERITY_LABEL: Record<RiskItemView['severity'], string> = {
  low: 'низкий',
  medium: 'средний',
  high: 'высокий',
};

const LIGHT_LABEL: Record<VerdictView['trafficLight'], string> = {
  green: 'Низкий риск',
  yellow: 'Есть риски',
  red: 'Высокий риск',
};

// Мок-оплата ЮKassa: создаём платёж и подтверждаем (имитация вебхука).
document.querySelectorAll<HTMLButtonElement>('[data-plan]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const plan = btn.dataset.plan;
    if (!plan) return;
    btn.disabled = true;
    payStatusEl.className = 'pay-status pending';
    payStatusEl.textContent = 'Создаём платёж (мок ЮKassa)…';
    try {
      const created = await fetch(`${API_BASE}/api/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      if (!created.ok) throw new Error(`Сервер ответил ${created.status}`);
      const { payment } = (await created.json()) as { payment: { id: string } };
      payStatusEl.textContent = 'Платёж создан, подтверждаем оплату…';
      const confirmed = await fetch(`${API_BASE}/api/payments/${payment.id}/confirm`, {
        method: 'POST',
      });
      if (!confirmed.ok) throw new Error(`Сервер ответил ${confirmed.status}`);
      lastPaymentId = payment.id;
      payStatusEl.className = 'pay-status';
      payStatusEl.textContent = `Оплачено ✓ (мок) — платёж ${payment.id.slice(0, 14)}…`;
    } catch (error) {
      payStatusEl.className = 'pay-status error';
      payStatusEl.textContent =
        error instanceof TypeError
          ? 'Сервер недоступен — запустите npm run dev:server.'
          : error instanceof Error
            ? error.message
            : String(error);
    } finally {
      btn.disabled = false;
    }
  });
});

getVerdictBtn.addEventListener('click', async () => {
  if (!lastMaskedText) return;
  getVerdictBtn.disabled = true;
  getVerdictBtn.textContent = 'Формируем вердикт…';
  verdictResultEl.innerHTML = '<p class="muted">Анализируем (обычно 5–30 секунд)…</p>';
  try {
    const response = await fetch(`${API_BASE}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentType: docTypeSelect.value,
        maskedText: lastMaskedText,
        ...(lastPaymentId ? { paymentId: lastPaymentId } : {}),
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(
        response.status === 502
          ? 'Сервер не смог сформировать вердикт (проверьте настройки ИИ или попробуйте позже).'
          : body?.error
            ? `Сервер ответил ошибкой: ${body.error}`
            : `Сервер ответил с кодом ${response.status}.`,
      );
    }
    const data = (await response.json()) as VerifyResponseView;
    renderVerdict(data);
  } catch (error) {
    const message =
      error instanceof TypeError
        ? 'Сервер недоступен. Запустите его: npm run dev:server (localhost:3000).'
        : error instanceof Error
          ? error.message
          : String(error);
    verdictResultEl.innerHTML = `<p class="error">${escapeHtml(message)}</p>`;
  } finally {
    getVerdictBtn.disabled = false;
    getVerdictBtn.textContent = 'Получить вердикт';
  }
});

function renderVerdict(data: VerifyResponseView): void {
  const v = data.verdict;
  const risks = v.risks
    .map(
      (r) => `
      <div class="risk-item">
        <div class="risk-head">
          <span class="risk-severity ${r.severity}">${SEVERITY_LABEL[r.severity]}</span>
          <strong>${escapeHtml(r.clause || 'без пункта')}</strong>
        </div>
        <div>${escapeHtml(r.description)}</div>
        <div class="muted">${ARROW_ICON} ${escapeHtml(r.action)}</div>
      </div>`,
    )
    .join('');
  const paidNote = data.paid
    ? `<div class="anonym-note">${CHECK_ICON} Вердикт по оплаченному запросу (мок ЮKassa).</div>`
    : '';
  const anonymNote = data.anonymizedOnServer
    ? `<div class="anonym-note">${LOCK_ICON} Дополнительно обезличено на сервере: ${data.maskedAgain.join(', ')} — в ИИ ушёл только чистый текст.</div>`
    : '';
  verdictResultEl.innerHTML = `
    <h3>Оценка рисков: <span class="score-badge ${v.trafficLight}">${v.score}/10</span> ${LIGHT_LABEL[v.trafficLight]}</h3>
    ${risks || '<p class="muted">Явных рисков не найдено.</p>'}
    <h3>Рекомендация</h3>
    <p>${escapeHtml(v.recommendation)}</p>
    ${paidNote}
    ${anonymNote}
    <p class="muted">Вердикт носит информационный характер и не заменяет консультацию специалиста.</p>
  `;
}

// Декоративные SVG-иконки (правило скилла: без эмодзи в интерфейсе).
const ARROW_ICON =
  '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
const CHECK_ICON =
  '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
const LOCK_ICON =
  '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Тип нужен, чтобы PlaceholderType был в скоупе типов (для будущего фильтра).
export type { PlaceholderType };
