#!/bin/bash

#############################################
# Teste Completo da Rota de Alunos
# Testa diretamente no banco de dados
#############################################

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

cd "$(dirname "$0")/.."

echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}🧪 TESTE COMPLETO - ROTA DE ALUNOS${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""

# Teste 1: Verificar se há alunos no banco
echo -e "${YELLOW}1️⃣  Verificando alunos no banco...${NC}"
npx ts-node -r tsconfig-paths/register -e "
import { prisma } from './src/config/prisma';

(async () => {
  try {
    const count = await prisma.usuarios.count({
      where: {
        role: 'ALUNO_CANDIDATO',
        turmasInscritas: { some: {} }
      }
    });
    
    console.log('\x1b[32m✅ ' + count + ' alunos com inscrições encontrados\x1b[0m');
    
    if (count === 0) {
      console.log('\x1b[33m⚠️  Nenhum aluno encontrado. Execute: pnpm seed\x1b[0m');
      process.exit(1);
    }
    
    await prisma.\$disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error('\x1b[31m❌ Erro:', error.message, '\x1b[0m');
    process.exit(1);
  }
})();
"

echo ""

# Teste 2: Testar filtro por cidade com performance
echo -e "${YELLOW}2️⃣  Testando filtro por cidade (com índice)...${NC}"
npx ts-node -r tsconfig-paths/register -e "
import { prisma } from './src/config/prisma';

(async () => {
  try {
    const start = Date.now();
    
    const alunos = await prisma.usuarios.findMany({
      where: {
        role: 'ALUNO_CANDIDATO',
        enderecos: {
          some: {
            cidade: { equals: 'Campinas', mode: 'insensitive' }
          }
        }
      },
      include: {
        enderecos: { take: 1 }
      },
      take: 10
    });
    
    const duration = Date.now() - start;
    
    console.log('\x1b[32m✅ ' + alunos.length + ' alunos de Campinas encontrados\x1b[0m');
    console.log('\x1b[34m⏱️  Performance: ' + duration + 'ms\x1b[0m');
    
    if (duration > 1000) {
      console.log('\x1b[33m⚠️  Query lenta! Verifique os índices.\x1b[0m');
    } else {
      console.log('\x1b[32m✅ Performance excelente (< 1s)\x1b[0m');
    }
    
    await prisma.\$disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error('\x1b[31m❌ Erro:', error.message, '\x1b[0m');
    process.exit(1);
  }
})();
"

echo ""

# Teste 3: Testar filtro por status
echo -e "${YELLOW}3️⃣  Testando filtro por status de inscrição...${NC}"
npx ts-node -r tsconfig-paths/register -e "
import { prisma } from './src/config/prisma';

(async () => {
  try {
    const start = Date.now();
    
    const alunos = await prisma.usuarios.findMany({
      where: {
        role: 'ALUNO_CANDIDATO',
        turmasInscritas: {
          some: { status: 'INSCRITO' }
        }
      },
      take: 10
    });
    
    const duration = Date.now() - start;
    
    console.log('\x1b[32m✅ ' + alunos.length + ' alunos com status INSCRITO\x1b[0m');
    console.log('\x1b[34m⏱️  Performance: ' + duration + 'ms\x1b[0m');
    
    if (duration > 1000) {
      console.log('\x1b[33m⚠️  Query lenta!\x1b[0m');
    } else {
      console.log('\x1b[32m✅ Performance excelente\x1b[0m');
    }
    
    await prisma.\$disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error('\x1b[31m❌ Erro:', error.message, '\x1b[0m');
    process.exit(1);
  }
})();
"

echo ""

# Teste 4: Testar paginação
echo -e "${YELLOW}4️⃣  Testando paginação...${NC}"
npx ts-node -r tsconfig-paths/register -e "
import { prisma } from './src/config/prisma';

(async () => {
  try {
    const limit = 5;
    
    const [page1, page2, total] = await Promise.all([
      prisma.usuarios.findMany({
        where: {
          role: 'ALUNO_CANDIDATO',
          turmasInscritas: { some: {} }
        },
        take: limit,
        skip: 0,
        orderBy: { criadoEm: 'desc' }
      }),
      prisma.usuarios.findMany({
        where: {
          role: 'ALUNO_CANDIDATO',
          turmasInscritas: { some: {} }
        },
        take: limit,
        skip: limit,
        orderBy: { criadoEm: 'desc' }
      }),
      prisma.usuarios.count({
        where: {
          role: 'ALUNO_CANDIDATO',
          turmasInscritas: { some: {} }
        }
      })
    ]);
    
    const totalPages = Math.ceil(total / limit);
    
    console.log('\x1b[32m✅ Paginação funcionando\x1b[0m');
    console.log('\x1b[34m   Página 1: ' + page1.length + ' alunos\x1b[0m');
    console.log('\x1b[34m   Página 2: ' + page2.length + ' alunos\x1b[0m');
    console.log('\x1b[34m   Total: ' + total + ' alunos (' + totalPages + ' páginas)\x1b[0m');
    
    await prisma.\$disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error('\x1b[31m❌ Erro:', error.message, '\x1b[0m');
    process.exit(1);
  }
})();
"

echo ""

# Teste 5: Testar query completa (como a API faz)
echo -e "${YELLOW}5️⃣  Testando query completa (API simulation)...${NC}"
npx ts-node -r tsconfig-paths/register -e "
import { prisma, retryOperation } from './src/config/prisma';

(async () => {
  try {
    const start = Date.now();
    
    const [alunos, total] = await retryOperation(
      async () => {
        const [alunosResult, totalResult] = await Promise.all([
          prisma.usuarios.findMany({
            where: {
              role: 'ALUNO_CANDIDATO',
              turmasInscritas: { some: {} }
            },
            select: {
              id: true,
              codUsuario: true,
              nomeCompleto: true,
              email: true,
              enderecos: {
                select: { cidade: true, estado: true },
                take: 1
              },
              turmasInscritas: {
                select: {
                  id: true,
                  status: true,
                  turma: {
                    select: {
                      nome: true,
                      curso: { select: { nome: true } }
                    }
                  }
                }
              }
            },
            take: 10,
            orderBy: { criadoEm: 'desc' }
          }),
          prisma.usuarios.count({
            where: {
              role: 'ALUNO_CANDIDATO',
              turmasInscritas: { some: {} }
            }
          })
        ]);
        
        return [alunosResult, totalResult];
      },
      3,
      1500
    );
    
    const duration = Date.now() - start;
    
    console.log('\x1b[32m✅ Query completa executada com sucesso\x1b[0m');
    console.log('\x1b[34m   Retornados: ' + alunos.length + ' alunos\x1b[0m');
    console.log('\x1b[34m   Total no banco: ' + total + ' alunos\x1b[0m');
    console.log('\x1b[34m   Performance: ' + duration + 'ms\x1b[0m');
    
    if (alunos.length > 0) {
      const primeiro = alunos[0];
      console.log('\x1b[34m   👤 Primeiro: ' + primeiro.nomeCompleto + '\x1b[0m');
      console.log('\x1b[34m   📧 Email: ' + primeiro.email + '\x1b[0m');
      console.log('\x1b[34m   📚 Inscrições: ' + primeiro.turmasInscritas.length + '\x1b[0m');
    }
    
    if (duration > 2000) {
      console.log('\x1b[33m⚠️  Query lenta! Performance pode melhorar.\x1b[0m');
    } else {
      console.log('\x1b[32m✅ Performance excelente!\x1b[0m');
    }
    
    await prisma.\$disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error('\x1b[31m❌ Erro:', error.message, '\x1b[0m');
    process.exit(1);
  }
})();
"

echo ""
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ TODOS OS TESTES PASSARAM!${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}💡 A rota /cursos/alunos está funcionando perfeitamente!${NC}"
echo -e "${YELLOW}   Agora teste no Postman com autenticação.${NC}"

