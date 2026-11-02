import { fileURLToPath } from 'node:url';

/**
 * Путь к .env в корне репозитория.
 * ВАЖНО: npm -w запускает скрипт с cwd = apps/server, поэтому путь обязан
 * считаться от модуля, а не от process.cwd().
 */
export function resolveProjectEnvPath(): string {
  return fileURLToPath(new URL('../../../.env', import.meta.url));
}

/**
 * Загружает переменные из .env в process.env.
 * Возвращает false, если файла нет (CI и свежий клон работают без .env).
 */
export function loadProjectEnv(path: string = resolveProjectEnvPath()): boolean {
  try {
    process.loadEnvFile(path);
    return true;
  } catch {
    return false;
  }
}
