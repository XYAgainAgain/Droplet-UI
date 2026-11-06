import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

// Scripts run one browser at a time, so each failure names its browser
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
