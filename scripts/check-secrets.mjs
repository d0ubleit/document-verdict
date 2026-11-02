#!/usr/bin/env node
/**
 * Fails the build when a secret-looking value is tracked by git.
 * Run: npm run check:secrets
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PATTERNS = [
  { name: 'Yandex Cloud API key', re: /AQVN[A-Za-z0-9_-]{20,}/ },
  { name: 'Yandex folder id', re: /b1g[a-z0-9]{15,}/ },
  {
    name: 'Generic API key assignment',
    re: /(api[_-]?key|secret|token|password)\s*[:=]\s*['"][A-Za-z0-9_-]{24,}['"]/i,
  },
  { name: 'Private key block', re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];

const files = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && !f.startsWith('.env') && !f.endsWith('package-lock.json'));

let failures = 0;
for (const file of files) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue; // binary or unreadable
  }
  for (const { name, re } of PATTERNS) {
    const match = content.match(re);
    if (match) {
      console.error(`✖ ${file}: ${name} (${match[0].slice(0, 12)}…)`);
      failures += 1;
    }
  }
}

if (failures > 0) {
  console.error(`\nНайдено проблем: ${failures}. Уберите секреты из репозитория.`);
  process.exit(1);
}
console.log(`✓ Секретов не найдено (проверено файлов: ${files.length}).`);
