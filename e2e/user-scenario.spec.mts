import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// Самостоятельные вымышленные фикстуры (без сторонних документов и реальных контактов).
const FIXTURES = fileURLToPath(new URL('../packages/masker/tests/fixtures/', import.meta.url));

const PII_TEXT =
  'Исполнитель: Иванов Иван Иванович, паспорт 4508 123456, выдан ОУФМС, тел. +7 916 123-45-67. Сумма: 45 000 руб.';

const textarea = (page: import('@playwright/test').Page) => page.locator('#input');

test.describe('полный пользовательский сценарий', () => {
  test('вставка текста → ревью → снятие галочки → подтверждение', async ({ page }) => {
    await page.goto('/');
    await textarea(page).fill(PII_TEXT);
    await page.locator('#mask').click();

    // Панель «Подтвердите замены»: 3 кандидата (ФИО, паспорт, телефон).
    const review = page.locator('#review');
    await expect(review).toBeVisible();
    await expect(review.locator('.review-row')).toHaveCount(3);

    // Снимаем галочку с ФИО — оно должно остаться в тексте.
    const nameRow = review.locator('.review-row', { hasText: 'Иванов Иван Иванович' });
    await nameRow.locator('input[type="checkbox"]').uncheck();

    await page.locator('#confirm').click();
    await expect(review).toBeHidden();

    const output = page.locator('#output');
    await expect(output).toHaveValue(/\[ПАСПОРТ\]/);
    await expect(output).toHaveValue(/\[ТЕЛЕФОН\]/);
    await expect(output).toHaveValue(/Иванов Иван Иванович/);
    await expect(output).not.toHaveValue(/4508 123456/);

    // Статистика и таблица замен соответствуют применённому подмножеству.
    await expect(page.locator('#stats')).toContainText('Заменено: 2 вхождений');
    await expect(page.locator('#replacements tbody tr')).toHaveCount(2);
  });

  test('загрузка DOCX (микрозайм) → извлечение → маскирование', async ({ page }) => {
    await page.goto('/');
    await page.locator('#file').setInputFiles(FIXTURES + 'dogovor-mikrozaim.docx');

    await expect(page.locator('#stats')).toContainText('Извлечено из');
    await expect(textarea(page)).toHaveValue(/Договор микрозайма/);

    await page.locator('#mask').click();
    await expect(page.locator('#review')).toBeVisible();
    await page.locator('#confirm').click();

    const output = page.locator('#output');
    await expect(output).toHaveValue(/\[ФИО\]/);
    await expect(output).not.toHaveValue(/Иванова/);
  });

  test('загрузка PDF (оферта школы) → извлечение → маскирование', async ({ page }) => {
    await page.goto('/');
    await page.locator('#file').setInputFiles(FIXTURES + 'oferta-romashka.pdf');

    await expect(page.locator('#stats')).toContainText('Извлечено из');
    await expect(textarea(page)).toHaveValue(/public offer/i);

    await page.locator('#mask').click();
    await expect(page.locator('#review')).toBeVisible();
    await page.locator('#confirm').click();

    const output = page.locator('#output');
    await expect(output).toHaveValue(/\[EMAIL\]/);
    await expect(output).toHaveValue(/\[ТЕЛЕФОН\]/);
    await expect(output).not.toHaveValue(/info@example\.com/);
  });

  test('загрузка HTML (сайт юруслуг) → извлечение → маскирование email', async ({ page }) => {
    await page.goto('/');
    await page.locator('#file').setInputFiles(FIXTURES + 'oferta-romashka.html');

    await expect(page.locator('#stats')).toContainText('Извлечено из');
    await expect(textarea(page)).toHaveValue(/info@example\.com/);

    await page.locator('#mask').click();
    await expect(page.locator('#review')).toBeVisible();
    await page.locator('#confirm').click();

    const output = page.locator('#output');
    await expect(output).toHaveValue(/\[EMAIL\]/);
    await expect(output).not.toHaveValue(/info@example\.com/);
  });

  test('текст без ПДн → «Замен нет»', async ({ page }) => {
    await page.goto('/');
    await textarea(page).fill('Обычный текст договора без персональных данных.');
    await page.locator('#mask').click();

    await expect(page.locator('#review')).toBeHidden();
    await expect(page.locator('#replacements')).toContainText('Замен нет');
    await expect(page.locator('#output')).toHaveValue(
      'Обычный текст договора без персональных данных.',
    );
  });

  test('«Сбросить» скрывает панель ревью', async ({ page }) => {
    await page.goto('/');
    await textarea(page).fill(PII_TEXT);
    await page.locator('#mask').click();
    await expect(page.locator('#review')).toBeVisible();

    await page.locator('#cancel-review').click();
    await expect(page.locator('#review')).toBeHidden();
  });

  test('«Копировать результат»', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await textarea(page).fill(PII_TEXT);
    await page.locator('#mask').click();
    await page.locator('#confirm').click();

    await page.locator('#copy').click();
    await expect(page.locator('#copy')).toHaveText('Скопировано ✓');
  });

  test('пример из корпуса заполняет поле ввода', async ({ page }) => {
    await page.goto('/');
    await page.locator('#example').selectOption({ label: 'Договор ГПХ' });
    await expect(textarea(page)).toHaveValue(/Иванов Иван Иванович/);
  });

  test('мок-оплата ЮKassa: создать платёж и подтвердить', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-plan="pack3"]').click();
    const status = page.locator('#pay-status');
    await expect(status).toContainText('Оплачено', { timeout: 15_000 });
  });

  test('полный сценарий: вердикт с сервера', async ({ page }) => {
    await page.goto('/');
    await textarea(page).fill(PII_TEXT);
    await page.locator('#mask').click();
    await expect(page.locator('#review')).toBeVisible();
    await page.locator('#confirm').click();

    // После подтверждения появляется панель вердикта.
    const panel = page.locator('#verdict-panel');
    await expect(panel).toBeVisible();
    await expect(page.locator('#doc-type')).toHaveValue('gph');

    await page.locator('#get-verdict').click();
    const result = page.locator('#verdict-result');
    await expect(result).toContainText('Оценка рисков');
    await expect(result).toContainText('/10');
    await expect(result).toContainText('Неустойка');
    await expect(result).toContainText('Рекомендация');
    await expect(result).toContainText('не заменяет консультацию');
  });
});
