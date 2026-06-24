import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Only report coverage for the code the test suite actually exercises
      // (server + core), not build artifacts (dist/, www/) or the client.
      include: ['src/core/**', 'src/server/**'],
      exclude: ['node_modules/', 'tests/', 'dist/', 'www/', 'src/client/**', '**/*.d.ts'],
    },
    setupFiles: ['tests/setup.ts'],
  },
});
