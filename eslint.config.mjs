// eslint.config.mjs
// @ts-check

import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { fileURLToPath } from 'url';
import path from 'path';

// Converte o import.meta.url para um caminho de arquivo físico
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'], // ignora a própria configuração
  },
  eslint.configs.recommended, // regras básicas do ESLint
  ...tseslint.configs.recommendedTypeChecked, // regras padrões do @typescript-eslint com type-checking
  eslintPluginPrettierRecommended, // integra Prettier + ESLint
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      ecmaVersion: 2020, // permite sintaxes modernas (ES2020)
      sourceType: 'module', // usamos ES Modules
      parserOptions: {
        // 1) tsconfigRootDir: indica a raiz onde está o tsconfig.json
        // 2) project: caminho absoluto (montado via __dirname) para ler o tsconfig.json
        tsconfigRootDir: __dirname,
        project: [path.join(__dirname, 'tsconfig.json')],
      },
    },
  },
  {
    rules: {
      // ----------------------------------------------------------------
      // “off” para evitar erro de “unsafe assignment of an 'any' value”:
      '@typescript-eslint/no-unsafe-assignment': 'off',

      // “off” para permitir explicitamente usar o tipo any (quando realmente precisar)
      '@typescript-eslint/no-explicit-any': 'off',

      // Mantém estes como avisos (warnings):
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',

      // (adicione aqui outras regras que queira customizar)
      // ----------------------------------------------------------------
    },
  },
);
