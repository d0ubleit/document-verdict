// Программная проверка вёрстки лендинга.
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
const res = await page.evaluate(() => {
  const doc = document.scrollingElement;
  const issues = [];
  if (doc.scrollWidth > doc.clientWidth + 1)
    issues.push(`horizontal overflow: ${doc.scrollWidth} > ${doc.clientWidth}`);
  const must = [
    'h1',
    '.hero',
    '.stats-strip',
    '#how',
    '#tool',
    '#privacy',
    '#pricing',
    '#faq',
    '.final-cta',
    '.footer',
    '.nav',
    '.mock-card',
  ];
  for (const sel of must) {
    const el = document.querySelector(sel);
    if (!el) issues.push(`missing: ${sel}`);
    else {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) issues.push(`zero size: ${sel}`);
    }
  }
  const pricingCards = document.querySelectorAll('.price-card').length;
  const steps = document.querySelectorAll('.step').length;
  return { issues, pricingCards, steps, title: document.title };
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
if (res.issues.length) {
  console.error('LAYOUT ISSUES:', res.issues);
  process.exit(1);
}
console.log('LAYOUT OK');
