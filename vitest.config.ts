import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.{ts,tsx,mjs}'],
    exclude: ['node_modules', '.next'],
  },
});
