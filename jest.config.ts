import type { Config } from 'jest';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente do .env; um .env.test, se existir, vence (ex.: banco de
// testes em DATABASE_URL e DIRECT_URL — o Prisma usa DIRECT_URL primeiro)
dotenv.config();
dotenv.config({ path: '.env.test', override: true });

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^(\\.+/.*)\\.js$': '$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          target: 'ES2020',
          module: 'commonjs',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          skipLibCheck: true,
        },
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!(.*\\.mjs$))'],
  setupFiles: ['<rootDir>/jest.setup.ts'],
  globals: {
    'process.env': {
      ...process.env,
      NODE_ENV: 'test',
    },
  },
};

export default config;
