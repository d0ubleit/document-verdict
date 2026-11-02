#!/usr/bin/env node
/**
 * Guards user-facing copy against factually wrong privacy claims.
 * The document text IS sent to the server (masked); only personal data
 * stays on the device. Wording like "документ не покидает устройство
 * в исходном виде" is fine, "документ не покидает устройство" is not.
 * Run: npm run check:copy
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const CHECKS = [
  {
    name: 'claims the document does not leave the device',
    re: /документ[а-яё]*\s+(никогда\s+)?не\s+покида[а-яё]*\s+(устройство|браузер)/i,
    // "в исходном виде" makes the claim accurate (only raw form stays local).
    allow: /исходн[\p{L}]*\s+виде/iu,
  },
  {
    name: 'English variant of the same claim',
    re: /\bdocument\b[^.\n]{0,40}\b(never\s+leaves|stays\s+on\s+the\s+device)\b/i,
    allow: /raw|original/i,
  },
];

// Self-check: the guard must catch the wrong wording and allow the right one.
const BAD = 'Ваш документ не покидает устройство.';
const GOOD = 'Документ не покидает устройство в исходном виде.';
if (!CHECKS[0].re.test(BAD)) {
  console.error('✖ check-copy самотест провален: паттерн не ловит плохую формулировку');
  process.exit(1);
}
if (CHECKS[0].re.test(GOOD) && !CHECKS[0].allow.test(GOOD)) {
  console.error('✖ check-copy самотест провален: паттерн ругается на корректную формулировку');
  process.exit(1);
}

const FILES = execSync('git ls-files "*.md" "*.html"', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

let failures = 0;
for (const file of FILES) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const { name, re, allow } of CHECKS) {
      if (re.test(line) && !allow.test(line)) {
        console.error(`✖ ${file}:${i + 1}: ${name}\n    ${line.trim().slice(0, 120)}`);
        failures += 1;
      }
    }
  });
}

if (failures > 0) {
  console.error(
    `\nНайдено неточных формулировок: ${failures}. ` +
      'Пишите «персональные данные не покидают устройство», а не «документ».',
  );
  process.exit(1);
}
console.log(`✓ Формулировки о приватности точны (проверено файлов: ${FILES.length}).`);
