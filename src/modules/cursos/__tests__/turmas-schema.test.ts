import { describe, it, expect } from '@jest/globals';
import {
  createTurmaSchema,
  updateTurmaSchema,
  listTurmasQuerySchema,
  turmaInscricaoSchema,
  updateInscricaoStatusSchema,
} from '../validators/turmas.schema';
import { CursosTurnos, CursosMetodos, StatusInscricao } from '@prisma/client';

const uuidAula = '11111111-1111-1111-1111-111111111111';
const uuidProva = '22222222-2222-2222-2222-222222222222';
const uuidCurso = '33333333-3333-3333-3333-333333333333';
const uuidInstrutor = '44444444-4444-4444-4444-444444444444';

const datasValidas = {
  dataInicio: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  dataFim: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
  dataInscricaoInicio: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
  dataInscricaoFim: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000),
};

describe('Turmas Schemas', () => {
  describe('createTurmaSchema', () => {
    const baseCreate = {
      nome: 'Turma Teste',
      estruturaTipo: 'MODULAR' as const,
      turno: CursosTurnos.NOITE,
      metodo: CursosMetodos.LIVE,
      vagasIlimitadas: false,
      vagasTotais: 30,
      ...datasValidas,
      estrutura: {
        modules: [
          {
            title: 'Módulo 1',
            items: [
              {
                type: 'AULA' as const,
                title: 'Aula 1',
                templateId: uuidAula,
                instructorId: uuidInstrutor,
              },
              {
                type: 'PROVA' as const,
                title: 'Prova 1',
                templateId: uuidProva,
                instructorId: uuidInstrutor,
              },
            ],
          },
        ],
        standaloneItems: [] as any[],
      },
    };

    it('aceita payload válido MODULAR com módulos e itens AULA + PROVA', () => {
      const result = createTurmaSchema.safeParse(baseCreate);
      expect(result.success).toBe(true);
    });

    it('aceita payload válido PADRAO com standaloneItems (mínimo 1 AULA e 1 PROVA/ATIVIDADE)', () => {
      const payload = {
        ...baseCreate,
        estruturaTipo: 'PADRAO' as const,
        estrutura: {
          modules: [],
          standaloneItems: [
            {
              type: 'AULA' as const,
              title: 'Aula Avulsa',
              templateId: uuidAula,
              instructorId: uuidInstrutor,
            },
            {
              type: 'PROVA' as const,
              title: 'Prova Avulsa',
              templateId: uuidProva,
              instructorId: uuidInstrutor,
            },
          ],
        },
      };
      const result = createTurmaSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('aceita estrutura DINAMICA com modules e standaloneItems', () => {
      const payload = {
        ...baseCreate,
        estruturaTipo: 'DINAMICA' as const,
        estrutura: {
          modules: [
            {
              title: 'Módulo 1',
              items: [
                {
                  type: 'AULA' as const,
                  title: 'Aula',
                  templateId: uuidAula,
                  instructorId: uuidInstrutor,
                },
                {
                  type: 'PROVA' as const,
                  title: 'Prova',
                  templateId: uuidProva,
                  instructorId: uuidInstrutor,
                },
              ],
            },
          ],
          standaloneItems: [
            {
              type: 'ATIVIDADE' as const,
              title: 'Atividade',
              templateId: uuidProva,
              instructorId: uuidInstrutor,
            },
          ],
        },
      };
      const result = createTurmaSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejeita MODULAR sem módulos', () => {
      const payload = {
        ...baseCreate,
        estruturaTipo: 'MODULAR' as const,
        estrutura: {
          modules: [],
          standaloneItems: [],
        },
      };
      const result = createTurmaSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const msg = result.error.issues.find((i) => i.path?.join('.').includes('modules'));
        expect(msg?.message).toMatch(/ao menos 1 módulo/i);
      }
    });

    it('rejeita MODULAR com standaloneItems', () => {
      const payload = {
        ...baseCreate,
        estrutura: {
          modules: [{ title: 'M1', items: [] }],
          standaloneItems: [
            {
              type: 'AULA' as const,
              title: 'A',
              templateId: uuidAula,
              instructorId: uuidInstrutor,
            },
          ],
        },
      };
      const result = createTurmaSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const msg = result.error.issues.find((i) => i.path?.join('.').includes('standalone'));
        expect(msg?.message).toMatch(/não aceita itens avulsos|standaloneItems/i);
      }
    });

    it('rejeita PADRAO com modules preenchidos', () => {
      const payload = {
        ...baseCreate,
        estruturaTipo: 'PADRAO' as const,
        estrutura: {
          modules: [{ title: 'M1', items: [] }],
          standaloneItems: [
            {
              type: 'AULA' as const,
              title: 'A',
              templateId: uuidAula,
              instructorId: uuidInstrutor,
            },
            {
              type: 'PROVA' as const,
              title: 'P',
              templateId: uuidProva,
              instructorId: uuidInstrutor,
            },
          ],
        },
      };
      const result = createTurmaSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const msg = result.error.issues.find((i) => i.path?.join('.').includes('modules'));
        expect(msg?.message).toMatch(/PADRAO não utiliza módulos|modules deve ser vazio/i);
      }
    });

    it('rejeita PADRAO sem standaloneItems', () => {
      const payload = {
        ...baseCreate,
        estruturaTipo: 'PADRAO' as const,
        estrutura: {
          modules: [],
          standaloneItems: [],
        },
      };
      const result = createTurmaSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const msg = result.error.issues.find((i) => i.path?.join('.').includes('standalone'));
        expect(msg?.message).toMatch(/ao menos 1 item avulso|standaloneItems/i);
      }
    });

    it('rejeita estrutura sem nenhuma AULA', () => {
      const payload = {
        ...baseCreate,
        estrutura: {
          modules: [
            {
              title: 'M1',
              items: [
                {
                  type: 'PROVA' as const,
                  title: 'P1',
                  templateId: uuidProva,
                  instructorId: uuidInstrutor,
                },
                {
                  type: 'PROVA' as const,
                  title: 'P2',
                  templateId: uuidProva,
                  instructorId: uuidInstrutor,
                },
              ],
            },
          ],
          standaloneItems: [],
        },
      };
      const result = createTurmaSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const msg = result.error.issues.find((i) => i.path?.join('.').includes('estrutura'));
        expect(msg?.message).toMatch(/ao menos 1.*AULA/i);
      }
    });

    it('rejeita estrutura sem nenhum item PROVA ou ATIVIDADE', () => {
      const payload = {
        ...baseCreate,
        estrutura: {
          modules: [
            {
              title: 'M1',
              items: [
                {
                  type: 'AULA' as const,
                  title: 'A1',
                  templateId: uuidAula,
                  instructorId: uuidInstrutor,
                },
                {
                  type: 'AULA' as const,
                  title: 'A2',
                  templateId: uuidAula,
                  instructorId: uuidInstrutor,
                },
              ],
            },
          ],
          standaloneItems: [],
        },
      };
      const result = createTurmaSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const msg = result.error.issues.find((i) => i.path?.join('.').includes('estrutura'));
        expect(msg?.message).toMatch(/PROVA ou ATIVIDADE/i);
      }
    });

    it('rejeita recuperacaoFinal em item que não seja PROVA', () => {
      const payload = {
        ...baseCreate,
        estrutura: {
          modules: [
            {
              title: 'M1',
              items: [
                {
                  type: 'AULA' as const,
                  title: 'A1',
                  templateId: uuidAula,
                  recuperacaoFinal: true,
                  instructorId: uuidInstrutor,
                },
                {
                  type: 'PROVA' as const,
                  title: 'P1',
                  templateId: uuidProva,
                  instructorId: uuidInstrutor,
                },
              ],
            },
          ],
          standaloneItems: [],
        },
      };
      const result = createTurmaSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const msg = result.error.issues.find(
          (i) => i.message && /recuperacaoFinal/i.test(i.message),
        );
        expect(msg?.message).toMatch(/recuperacaoFinal.*PROVA/i);
      }
    });

    it('aceita recuperacaoFinal em item PROVA', () => {
      const payload = {
        ...baseCreate,
        estrutura: {
          modules: [
            {
              title: 'M1',
              items: [
                {
                  type: 'AULA' as const,
                  title: 'A1',
                  templateId: uuidAula,
                  instructorId: uuidInstrutor,
                },
                {
                  type: 'PROVA' as const,
                  title: 'Recuperação',
                  templateId: uuidProva,
                  recuperacaoFinal: true,
                  instructorId: uuidInstrutor,
                },
              ],
            },
          ],
          standaloneItems: [],
        },
      };
      const result = createTurmaSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejeita dataFim anterior a dataInicio', () => {
      const payload = {
        ...baseCreate,
        dataInicio: new Date('2026-02-10'),
        dataFim: new Date('2026-02-01'),
        dataInscricaoInicio: new Date('2026-01-01'),
        dataInscricaoFim: new Date('2026-02-05'),
      };
      const result = createTurmaSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const msg = result.error.issues.find((i) => i.path?.includes('dataFim'));
        expect(msg?.message).toMatch(/posterior.*início/i);
      }
    });

    it('rejeita dataInscricaoFim anterior a dataInscricaoInicio', () => {
      const payload = {
        ...baseCreate,
        dataInicio: new Date('2026-03-01'),
        dataFim: new Date('2026-04-01'),
        dataInscricaoInicio: new Date('2026-02-15'),
        dataInscricaoFim: new Date('2026-02-01'),
      };
      const result = createTurmaSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const msg = result.error.issues.find((i) => i.path?.includes('dataInscricaoFim'));
        expect(msg?.message).toMatch(/posterior.*inicial/i);
      }
    });

    it('rejeita dataInicio anterior à dataInscricaoFim', () => {
      const payload = {
        ...baseCreate,
        dataInicio: new Date('2026-02-01'),
        dataFim: new Date('2026-04-01'),
        dataInscricaoInicio: new Date('2026-01-01'),
        dataInscricaoFim: new Date('2026-02-15'),
      };
      const result = createTurmaSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const msg = result.error.issues.find((i) => i.path?.includes('dataInicio'));
        expect(msg?.message).toMatch(/não pode ser anterior|data final das inscrições/i);
      }
    });

    it('rejeita vagasTotais ausente quando vagasIlimitadas é false', () => {
      const payload = {
        ...baseCreate,
        vagasIlimitadas: false,
        vagasTotais: undefined,
      };
      const result = createTurmaSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const msg = result.error.issues.find(
          (i) => i.path?.includes('vagasTotais') || (i as any).message?.includes('vagas'),
        );
        expect(msg).toBeDefined();
      }
    });

    it('aceita vagasIlimitadas true sem vagasTotais', () => {
      const payload = {
        ...baseCreate,
        vagasIlimitadas: true,
        vagasTotais: undefined,
      };
      const result = createTurmaSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejeita nome com menos de 3 caracteres', () => {
      const result = createTurmaSchema.safeParse({
        ...baseCreate,
        nome: 'Ab',
      });
      expect(result.success).toBe(false);
    });

    it('rejeita templateId inválido (não UUID)', () => {
      const payload = {
        ...baseCreate,
        estrutura: {
          modules: [
            {
              title: 'M1',
              items: [
                {
                  type: 'AULA' as const,
                  title: 'A1',
                  templateId: 'not-a-uuid',
                  instructorId: uuidInstrutor,
                },
                {
                  type: 'PROVA' as const,
                  title: 'P1',
                  templateId: uuidProva,
                  instructorId: uuidInstrutor,
                },
              ],
            },
          ],
          standaloneItems: [],
        },
      };
      const result = createTurmaSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('aceita instrutorId e instrutorIds com instrutorId contido em instrutorIds', () => {
      const payload = {
        ...baseCreate,
        instrutorId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        instrutorIds: [
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        ],
      };
      const result = createTurmaSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejeita instrutorId não contido em instrutorIds quando ambos enviados', () => {
      const payload = {
        ...baseCreate,
        instrutorId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        instrutorIds: ['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'],
      };
      const result = createTurmaSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const msg = result.error.issues.find((i) => i.path?.includes('instrutorId'));
        expect(msg?.message).toMatch(/instrutorId.*instrutorIds|contido/i);
      }
    });
  });

  describe('updateTurmaSchema', () => {
    it('aceita atualização parcial com datas válidas', () => {
      const result = updateTurmaSchema.safeParse({
        nome: 'Turma Atualizada',
        dataInicio: new Date('2026-03-01'),
        dataFim: new Date('2026-04-01'),
      });
      expect(result.success).toBe(true);
    });

    it('rejeita dataFim anterior a dataInicio na atualização', () => {
      const result = updateTurmaSchema.safeParse({
        dataInicio: new Date('2026-04-01'),
        dataFim: new Date('2026-03-01'),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('listTurmasQuerySchema', () => {
    it('aceita query mínima com defaults', () => {
      const result = listTurmasQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.pageSize).toBe(10);
      }
    });

    it('aceita page e pageSize válidos', () => {
      const result = listTurmasQuerySchema.safeParse({ page: '2', pageSize: '20' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.pageSize).toBe(20);
      }
    });

    it('aceita status, turno, metodo e instrutorId opcionais', () => {
      const result = listTurmasQuerySchema.safeParse({
        page: 1,
        pageSize: 10,
        status: 'PUBLICADO',
        turno: CursosTurnos.NOITE,
        metodo: CursosMetodos.LIVE,
        instrutorId: uuidCurso,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('turmaInscricaoSchema', () => {
    it('aceita alunoId UUID válido', () => {
      const result = turmaInscricaoSchema.safeParse({ alunoId: uuidCurso });
      expect(result.success).toBe(true);
    });

    it('rejeita alunoId inválido', () => {
      const result = turmaInscricaoSchema.safeParse({ alunoId: 'x' });
      expect(result.success).toBe(false);
    });
  });

  describe('updateInscricaoStatusSchema', () => {
    it('aceita status válido de inscrição', () => {
      const result = updateInscricaoStatusSchema.safeParse({
        status: StatusInscricao.CONCLUIDO,
      });
      expect(result.success).toBe(true);
    });

    it('rejeita status inválido', () => {
      const result = updateInscricaoStatusSchema.safeParse({
        status: 'INVALIDO',
      });
      expect(result.success).toBe(false);
    });
  });
});
