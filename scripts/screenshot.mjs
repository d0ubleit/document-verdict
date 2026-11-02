// Скриншоты лендинга для визуальной проверки дизайна.
// Run: node scripts/screenshot.mjs (vite dev на :5173)
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await page.screenshot({ path: '/tmp/landing-top.png' });
await page.evaluate(() => document.querySelector('#tool').scrollIntoView());
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/landing-tool.png' });
await page.evaluate(() => document.querySelector('#pricing').scrollIntoView());
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/landing-pricing.png' });
await browser.close();
console.log('screenshots done');
