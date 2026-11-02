import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveProjectEnvPath, loadProjectEnv } from '../src/env.ts';

describe('resolveProjectEnvPath', () => {
  it('указывает на .env в корне репозитория (не зависит от cwd)', () => {
    const envPath = resolveProjectEnvPath();
    expect(envPath.endsWith('.env')).toBe(true);
    expect(isAbsolute(envPath)).toBe(true);
    // Корень репозитория определяем по package.json рядом с .env —
    // это работает в любом клоне, в отличие от проверки имени папки.
    expect(existsSync(join(dirname(envPath), 'package.json'))).toBe(true);
  });
});

describe('loadProjectEnv', () => {
  it('загружает переменные из указанного файла', () => {
    const dir = mkdtempSync(join(tmpdir(), 'verdict-env-'));
    const envFile = join(dir, '.env');
    try {
      writeFileSync(envFile, 'VERDICT_TEST_FLAG=ok\n', 'utf8');
      expect(loadProjectEnv(envFile)).toBe(true);
      expect(process.env.VERDICT_TEST_FLAG).toBe('ok');
    } finally {
      delete process.env.VERDICT_TEST_FLAG;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('возвращает false для отсутствующего файла и не бросает исключение', () => {
    expect(() => loadProjectEnv(join(tmpdir(), 'verdict-missing-.env'))).not.toThrow();
    expect(loadProjectEnv(join(tmpdir(), 'verdict-missing-.env'))).toBe(false);
  });

  it('в CI (без .env) не падает', () => {
    expect(typeof loadProjectEnv()).toBe('boolean');
  });
});
