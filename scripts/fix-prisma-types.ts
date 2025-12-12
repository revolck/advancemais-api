#!/usr/bin/env ts-node
/**
 * Script para corrigir erros comuns de tipos do Prisma após atualização
 * Adiciona campos obrigatórios faltantes em creates
 */

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import path from 'path';

const FIXES = [
  // Adicionar id e atualizadoEm em creates que faltam
  {
    pattern: /prisma\.(\w+)\.create\(\s*\{\s*data:\s*\{/g,
    replacement: (match: string, model: string) => {
      // Verificar se já tem id e atualizadoEm
      if (match.includes('id:') && match.includes('atualizadoEm:')) {
        return match;
      }
      // Adicionar se necessário (será feito manualmente ou via helper)
      return match;
    },
  },
];

async function fixFiles() {
  const files = await glob('src/**/*.ts', { ignore: ['**/*.test.ts', '**/node_modules/**'] });

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const modified = false;

    // Adicionar import do helper se usar prisma.create
    if (content.includes('prisma.') && content.includes('.create(')) {
      if (!content.includes('from') || !content.includes('prisma-helpers')) {
        // Será feito manualmente onde necessário
      }
    }

    if (modified) {
      writeFileSync(file, content, 'utf-8');
      console.log(`Fixed: ${file}`);
    }
  }
}

// fixFiles().catch(console.error);

console.log('Use o helper addRequiredFields() nos creates que faltam campos obrigatórios');
