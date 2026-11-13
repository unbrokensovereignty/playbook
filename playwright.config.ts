import { defineConfig, type Project } from '@playwright/test';

/**
 * End-to-end checks run against the built single file, just as people open it: in Chromium in a
 * light and a dark theme. `E2E_BROWSERS=others` runs Firefox (light) and WebKit, Safari's engine
 * (dark), instead, and `all` runs everything (those browsers need `npx playwright install firefox webkit`).
 */
const which = process.env['E2E_BROWSERS'] ?? 'chromium';
// a Chromium that came some other way (a container may have one already): PW_CHROMIUM=/path/to/chrome
const own = process.env['PW_CHROMIUM'] ? { launchOptions: { executablePath: process.env['PW_CHROMIUM'] } } : {};
const chromium: Project[] = [
  { name: 'light', use: { colorScheme: 'light', ...own } },
  { name: 'dark', use: { colorScheme: 'dark', ...own } },
];
const others: Project[] = [
  { name: 'firefox', use: { browserName: 'firefox', colorScheme: 'light' } },
  { name: 'webkit', use: { browserName: 'webkit', colorScheme: 'dark' } },
];

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: { viewport: { width: 1280, height: 820 }, browserName: 'chromium' },
  projects: which === 'others' ? others : which === 'all' ? [...chromium, ...others] : chromium,
});
