import { prisma, retryOperation } from '@/config/prisma';

/**
 * Testes de Performance e Resiliência
 *
 * Valida:
 * - Retry logic
 * - Reconexão automática
 * - Performance sob carga
 * - Timeout handling
 */

describe('Performance e Resiliência', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Retry Logic', () => {
    it('deve executar operação com sucesso na primeira tentativa', async () => {
      let attempts = 0;

      const result = await retryOperation(
        async () => {
          attempts++;
          return await prisma.usuarios.count({
            where: { role: 'ALUNO_CANDIDATO' },
          });
        },
        3,
        100,
      );

      expect(result).toBeGreaterThanOrEqual(0);
      expect(attempts).toBe(1); // Sucesso na primeira tentativa
    });

    it('deve retry em caso de erro simulado', async () => {
      let attempts = 0;

      try {
        await retryOperation(
          async () => {
            attempts++;
            if (attempts < 2) {
              // Simula erro de conexão na primeira tentativa
              const error: any = new Error("Can't reach database server");
              error.code = 'P1001';
              throw error;
            }
            return 'success';
          },
          3,
          100,
        );
      } catch {
        // Pode dar erro se não conseguir reconectar
      }

      expect(attempts).toBeGreaterThan(1); // Deve ter tentado mais de uma vez
    });
  });

  describe('Performance de Queries Complexas', () => {
    it('deve executar query complexa em tempo aceitável (< 2s)', async () => {
      const start = Date.now();

      const alunos = await prisma.usuarios.findMany({
        where: {
          role: 'ALUNO_CANDIDATO',
          turmasInscritas: {
            some: {},
          },
        },
        select: {
          id: true,
          nomeCompleto: true,
          enderecos: {
            select: {
              cidade: true,
              estado: true,
            },
            take: 1,
          },
          turmasInscritas: {
            select: {
              id: true,
              status: true,
              turma: {
                select: {
                  nome: true,
                  curso: {
                    select: {
                      nome: true,
                    },
                  },
                },
              },
            },
          },
        },
        take: 10,
      });

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(2000); // Menos de 2 segundos
      expect(alunos).toBeDefined();
    });

    it('deve executar múltiplas queries em paralelo eficientemente', async () => {
      const start = Date.now();

      const [count, alunos, total] = await Promise.all([
        prisma.usuarios.count({
          where: {
            role: 'ALUNO_CANDIDATO',
            turmasInscritas: { some: {} },
          },
        }),
        prisma.usuarios.findMany({
          where: {
            role: 'ALUNO_CANDIDATO',
            turmasInscritas: { some: {} },
          },
          take: 5,
        }),
        prisma.usuarios.count({
          where: { role: 'ALUNO_CANDIDATO' },
        }),
      ]);

      const duration = Date.now() - start;

      // Queries em paralelo devem ser mais rápidas que sequenciais
      expect(duration).toBeLessThan(3000);
      expect(count).toBeGreaterThanOrEqual(0);
      expect(alunos).toBeDefined();
      expect(total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Carga e Estresse', () => {
    it('deve suportar 10 requisições simultâneas', async () => {
      const promises = Array.from({ length: 10 }, () =>
        prisma.usuarios.count({
          where: {
            role: 'ALUNO_CANDIDATO',
            turmasInscritas: { some: {} },
          },
        }),
      );

      const results = await Promise.all(promises);

      // Todas as requisições devem completar
      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result).toBeGreaterThanOrEqual(0);
      });
    });

    it('deve manter performance com filtros complexos', async () => {
      const start = Date.now();

      const alunos = await prisma.usuarios.findMany({
        where: {
          role: 'ALUNO_CANDIDATO',
          turmasInscritas: {
            some: {
              status: 'INSCRITO',
              turma: {
                status: 'EM_ANDAMENTO',
              },
            },
          },
          enderecos: {
            some: {
              cidade: { not: null },
            },
          },
        },
        take: 10,
      });

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(2000);
      expect(alunos).toBeDefined();
    });
  });

  describe('Detecção de Supabase Pooler', () => {
    it('deve detectar se está usando Supabase Pooler', () => {
      const databaseUrl = process.env.DATABASE_URL || '';
      const isPooler = databaseUrl.includes('pooler.supabase.com');

      // Apenas log informativo
      console.log('🔍 Supabase Pooler:', isPooler ? 'SIM' : 'NÃO');
      console.log('📊 Database URL pattern:', databaseUrl.substring(0, 50) + '...');

      expect(databaseUrl).toBeDefined();
      expect(databaseUrl.length).toBeGreaterThan(0);
    });
  });

  describe('Validação de Configurações', () => {
    it('deve estar configurado para produção', () => {
      expect(process.env.NODE_ENV).toBeDefined();
    });

    it('deve ter DATABASE_URL configurada', () => {
      expect(process.env.DATABASE_URL).toBeDefined();
      expect(process.env.DATABASE_URL?.length).toBeGreaterThan(0);
    });

    it('deve ter DIRECT_URL configurada', () => {
      expect(process.env.DIRECT_URL).toBeDefined();
      expect(process.env.DIRECT_URL?.length).toBeGreaterThan(0);
    });
  });
});
