import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

// Package scripts select one configured browser instance at a time so failures
// remain attributable to Chromium, Firefox, or WebKit.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [
        { browser: 'chromium' },
        { browser: 'firefox' },
        { browser: 'webkit' },
      ],
    },
  },
});
