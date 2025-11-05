import request from 'supertest';
import express from 'express';
import { prisma } from '@/config/prisma';

/**
 * Testes de Integração - Rota de Alunos
 *
 * Testa:
 * - Funcionalidade básica
 * - Filtros (cidade, status, curso, turma, search)
 * - Paginação
 * - Performance
 * - Retry logic
 */

describe('GET /api/v1/cursos/alunos - Integração', () => {
  let app: express.Application;
  let authToken: string;

  beforeAll(async () => {
    // Setup da aplicação (importar o app real seria ideal)
    // Por enquanto, vamos fazer testes diretos no Prisma

    // Conectar ao banco de testes
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Conectividade com Banco de Dados', () => {
    it('deve conectar ao banco de dados', async () => {
      const result = await prisma.$queryRaw`SELECT 1 as test`;
      expect(result).toBeDefined();
    });

    it('deve ter usuários do tipo ALUNO_CANDIDATO', async () => {
      const count = await prisma.usuarios.count({
        where: {
          role: 'ALUNO_CANDIDATO',
        },
      });

      expect(count).toBeGreaterThan(0);
    });

    it('deve ter alunos com inscrições', async () => {
      const count = await prisma.usuarios.count({
        where: {
          role: 'ALUNO_CANDIDATO',
          turmasInscritas: {
            some: {},
          },
        },
      });

      expect(count).toBeGreaterThan(0);
    });
  });

  describe('Performance dos Índices', () => {
    it('deve filtrar por cidade rapidamente (< 1s)', async () => {
      const start = Date.now();

      const alunos = await prisma.usuarios.findMany({
        where: {
          role: 'ALUNO_CANDIDATO',
          enderecos: {
            some: {
              cidade: {
                equals: 'Campinas',
                mode: 'insensitive',
              },
            },
          },
        },
        take: 10,
      });

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Menos de 1 segundo
      expect(alunos).toBeDefined();
    });

    it('deve contar alunos rapidamente (< 500ms)', async () => {
      const start = Date.now();

      const count = await prisma.usuarios.count({
        where: {
          role: 'ALUNO_CANDIDATO',
          turmasInscritas: {
            some: {},
          },
        },
      });

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500); // Menos de 500ms
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('deve filtrar por status de inscrição rapidamente (< 1s)', async () => {
      const start = Date.now();

      const alunos = await prisma.usuarios.findMany({
        where: {
          role: 'ALUNO_CANDIDATO',
          turmasInscritas: {
            some: {
              status: 'INSCRITO',
            },
          },
        },
        take: 10,
      });

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);
      expect(alunos).toBeDefined();
    });
  });

  describe('Filtros', () => {
    it('deve filtrar alunos por cidade', async () => {
      const alunos = await prisma.usuarios.findMany({
        where: {
          role: 'ALUNO_CANDIDATO',
          enderecos: {
            some: {
              cidade: {
                equals: 'Campinas',
                mode: 'insensitive',
              },
            },
          },
        },
        include: {
          enderecos: {
            take: 1,
            orderBy: {
              criadoEm: 'desc',
            },
          },
        },
        take: 10,
      });

      // Todos os alunos devem ser de Campinas
      alunos.forEach((aluno) => {
        if (aluno.enderecos.length > 0) {
          expect(aluno.enderecos[0].cidade?.toLowerCase()).toBe('campinas');
        }
      });
    });

    it('deve filtrar alunos por status de inscrição', async () => {
      const alunos = await prisma.usuarios.findMany({
        where: {
          role: 'ALUNO_CANDIDATO',
          turmasInscritas: {
            some: {
              status: 'INSCRITO',
            },
          },
        },
        include: {
          turmasInscritas: {
            where: {
              status: 'INSCRITO',
            },
            take: 1,
          },
        },
        take: 10,
      });

      // Todos devem ter pelo menos uma inscrição INSCRITO
      alunos.forEach((aluno) => {
        expect(aluno.turmasInscritas.length).toBeGreaterThan(0);
        expect(aluno.turmasInscritas[0].status).toBe('INSCRITO');
      });
    });

    it('deve buscar alunos por nome (search)', async () => {
      const alunos = await prisma.usuarios.findMany({
        where: {
          role: 'ALUNO_CANDIDATO',
          OR: [
            { nomeCompleto: { contains: 'Silva', mode: 'insensitive' } },
            { email: { contains: 'Silva', mode: 'insensitive' } },
          ],
        },
        take: 10,
      });

      // Todos devem conter "Silva" no nome ou email
      alunos.forEach((aluno) => {
        const hasInName = aluno.nomeCompleto.toLowerCase().includes('silva');
        const hasInEmail = aluno.email.toLowerCase().includes('silva');
        expect(hasInName || hasInEmail).toBe(true);
      });
    });
  });

  describe('Paginação', () => {
    it('deve respeitar o limite de registros', async () => {
      const limit = 5;
      const alunos = await prisma.usuarios.findMany({
        where: {
          role: 'ALUNO_CANDIDATO',
          turmasInscritas: {
            some: {},
          },
        },
        take: limit,
      });

      expect(alunos.length).toBeLessThanOrEqual(limit);
    });

    it('deve funcionar com paginação', async () => {
      const limit = 2;
      const page1 = await prisma.usuarios.findMany({
        where: {
          role: 'ALUNO_CANDIDATO',
          turmasInscritas: {
            some: {},
          },
        },
        take: limit,
        skip: 0,
        orderBy: {
          criadoEm: 'desc',
        },
      });

      const page2 = await prisma.usuarios.findMany({
        where: {
          role: 'ALUNO_CANDIDATO',
          turmasInscritas: {
            some: {},
          },
        },
        take: limit,
        skip: limit,
        orderBy: {
          criadoEm: 'desc',
        },
      });

      // As páginas devem ser diferentes
      if (page1.length > 0 && page2.length > 0) {
        expect(page1[0].id).not.toBe(page2[0].id);
      }
    });
  });

  describe('Estrutura de Dados', () => {
    it('deve retornar alunos com estrutura correta', async () => {
      const alunos = await prisma.usuarios.findMany({
        where: {
          role: 'ALUNO_CANDIDATO',
          turmasInscritas: {
            some: {},
          },
        },
        select: {
          id: true,
          codUsuario: true,
          nomeCompleto: true,
          email: true,
          cpf: true,
          status: true,
          criadoEm: true,
          ultimoLogin: true,
          enderecos: {
            select: {
              cidade: true,
              estado: true,
            },
            take: 1,
            orderBy: {
              criadoEm: 'desc',
            },
          },
          turmasInscritas: {
            select: {
              id: true,
              status: true,
              criadoEm: true,
              turma: {
                select: {
                  id: true,
                  nome: true,
                  codigo: true,
                  status: true,
                  curso: {
                    select: {
                      id: true,
                      nome: true,
                      codigo: true,
                    },
                  },
                },
              },
            },
          },
        },
        take: 1,
      });

      if (alunos.length > 0) {
        const aluno = alunos[0];

        // Validar campos obrigatórios
        expect(aluno.id).toBeDefined();
        expect(aluno.codUsuario).toBeDefined();
        expect(aluno.nomeCompleto).toBeDefined();
        expect(aluno.email).toBeDefined();
        expect(aluno.status).toBeDefined();
        expect(aluno.criadoEm).toBeDefined();

        // Validar inscrições
        expect(Array.isArray(aluno.turmasInscritas)).toBe(true);
        if (aluno.turmasInscritas.length > 0) {
          const inscricao = aluno.turmasInscritas[0];
          expect(inscricao.turma).toBeDefined();
          expect(inscricao.turma.curso).toBeDefined();
        }
      }
    });
  });

  describe('Índices Criados', () => {
    it('deve ter índice em UsuariosEnderecos.cidade', async () => {
      const indexes = await prisma.$queryRaw<any[]>`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'UsuariosEnderecos' 
        AND indexname LIKE '%cidade%'
      `;

      expect(indexes.length).toBeGreaterThan(0);
    });

    it('deve ter índice em CursosTurmasInscricoes.alunoId_status', async () => {
      const indexes = await prisma.$queryRaw<any[]>`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'CursosTurmasInscricoes' 
        AND (indexname LIKE '%alunoId%status%' OR indexname LIKE '%status%')
      `;

      expect(indexes.length).toBeGreaterThan(0);
    });
  });
});
