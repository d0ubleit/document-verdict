import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    launchOptions: {
      args: ['--no-sandbox'],
    },
  },
  webServer: [
    {
      command: 'npm run dev:web',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      // Тестовый режим: заранее заданный вердикт, NER без скачивания модели.
      command: 'FAKE_LLM=1 FAKE_NER=1 npx tsx apps/server/src/index.ts',
      url: 'http://localhost:3000/health',
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
