import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        setupFiles: ['./tests/setup.js'],
        fileParallelism: false,
        // bcrypt (cost 12) plus a remote test database can exceed the 5 s default.
        testTimeout: 30000,
        hookTimeout: 30000
    }
});
