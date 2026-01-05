import { defineConfig } from 'vitest/config';
export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        exclude: ['node_modules', 'dist', 'build', '.turbo'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                'dist/',
                'build/',
                '.turbo/',
                '**/*.d.ts',
                '**/*.config.{js,ts}',
                '**/coverage/**',
            ],
        },
        typecheck: {
            enabled: true,
        },
    },
    resolve: {
        alias: {
            '@': new URL('./src', import.meta.url).pathname,
        },
    },
});
//# sourceMappingURL=vitest.config.js.map