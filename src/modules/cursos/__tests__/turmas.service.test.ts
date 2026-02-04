import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { prisma } from '@/config/prisma';
import { turmasService } from '../services/turmas.service';
import { CursosTurnos, CursosMetodos, CursoStatus } from '@prisma/client';

const uuidCurso = '33333333-3333-3333-3333-333333333333';
const uuidAulaTemplate = '11111111-1111-1111-1111-111111111111';
const uuidProvaTemplate = '22222222-2222-2222-2222-222222222222';
const uuidTurmaCriada = '44444444-4444-4444-4444-444444444444';
const uuidModulo = '55555555-5555-5555-5555-555555555555';
const uuidAulaClonada = '66666666-6666-6666-6666-666666666666';
const uuidProvaClonada = '77777777-7777-7777-7777-777777777777';
const uuidInstrutor = '88888888-8888-8888-8888-888888888888';

const turmaRawParaMapper = {
  id: uuidTurmaCriada,
  codigo: 'TRAB1234',
  nome: 'Turma Teste',
  estruturaTipo: 'MODULAR',
  turno: CursosTurnos.NOITE,
  metodo: CursosMetodos.LIVE,
  status: CursoStatus.RASCUNHO,
  vagasIlimitadas: false,
  vagasTotais: 30,
  vagasDisponiveis: 30,
  dataInicio: new Date(),
  dataFim: new Date(),
  dataInscricaoInicio: new Date(),
  dataInscricaoFim: new Date(),
  CursosTurmasInstrutores: [],
  CursosTurmasInscricoes: [],
  CursosTurmasAulas: [],
  CursosTurmasModulos: [],
  CursosTurmasProvas: [],
  CursosTurmasRegrasAvaliacao: null,
};

function createMockTx(overrides: Record<string, any> = {}) {
  const defaultTx = {
    cursos: {
      findUnique: jest.fn().mockResolvedValue({ id: uuidCurso }),
    },
    cursosTurmasAulas: {
      count: jest.fn().mockResolvedValue(1),
      findFirst: jest
        .fn()
        .mockResolvedValueOnce({
          id: uuidAulaTemplate,
          nome: 'Aula Template',
          cursoId: uuidCurso,
          turmaId: null,
          deletedAt: null,
          descricao: null,
          instrutorId: null,
          urlVideo: null,
          sala: null,
          modalidade: 'ONLINE',
          tipoLink: null,
          obrigatoria: true,
          duracaoMinutos: 60,
          gravarAula: true,
          apenasMateriaisComplementares: false,
          dataInicio: null,
          dataFim: null,
          horaInicio: null,
          horaFim: null,
          CursosTurmasAulasMateriais: [],
        })
        .mockResolvedValueOnce(null), // generateNextAulaCodigo: nenhuma aula AUL-*
      findMany: jest.fn().mockResolvedValue([{ id: uuidAulaTemplate }]),
      create: jest.fn().mockResolvedValue({ id: uuidAulaClonada }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    cursosTurmasProvas: {
      count: jest.fn().mockResolvedValue(1),
      findFirst: jest
        .fn()
        .mockResolvedValueOnce({
          id: uuidProvaTemplate,
          cursoId: uuidCurso,
          turmaId: null,
          titulo: 'Prova Template',
          etiqueta: 'P1',
          tipo: 'PROVA',
          tipoAtividade: null,
          descricao: null,
          peso: 10,
          valePonto: true,
          ativo: true,
          recuperacaoFinal: false,
          modalidade: 'ONLINE',
          obrigatoria: true,
          instrutorId: null,
          dataInicio: null,
          dataFim: null,
          horaInicio: null,
          horaTermino: null,
          CursosTurmasProvasQuestoes: [],
        })
        .mockResolvedValueOnce(null), // makeUniqueEtiqueta: etiqueta livre
      findMany: jest.fn().mockResolvedValue([{ id: uuidProvaTemplate }]),
      create: jest.fn().mockResolvedValue({ id: uuidProvaClonada }),
    },
    cursosTurmasProvasQuestoes: {
      create: jest.fn().mockResolvedValue({ id: 'questao-1' }),
    },
    cursosTurmasProvasQuestoesAlternativas: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    cursosTurmas: {
      findUnique: jest
        .fn()
        .mockResolvedValueOnce(null) // generateUniqueTurmaCode: código livre
        .mockResolvedValueOnce(turmaRawParaMapper), // fetchTurmaDetailed (raw para mapper)
      create: jest.fn().mockResolvedValue({
        id: uuidTurmaCriada,
        codigo: 'TRAB1234',
        nome: 'Turma Teste',
        cursoId: uuidCurso,
        estruturaTipo: 'MODULAR',
        turno: CursosTurnos.NOITE,
        metodo: CursosMetodos.LIVE,
        status: CursoStatus.RASCUNHO,
        vagasIlimitadas: false,
        vagasTotais: 30,
        vagasDisponiveis: 30,
        dataInicio: new Date(),
        dataFim: new Date(),
        dataInscricaoInicio: new Date(),
        dataInscricaoFim: new Date(),
        instrutorId: null,
      }),
    },
    cursosTurmasInstrutores: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    cursosTurmasModulos: {
      create: jest.fn().mockResolvedValue({ id: uuidModulo }),
    },
  };

  const merged = {
    ...defaultTx,
    ...overrides,
    cursosTurmasAulas: {
      ...defaultTx.cursosTurmasAulas,
      ...(overrides.cursosTurmasAulas ?? {}),
    },
    cursosTurmasProvas: {
      ...defaultTx.cursosTurmasProvas,
      ...(overrides.cursosTurmasProvas ?? {}),
    },
  };

  return merged;
}

const estruturaModularValida = {
  modules: [
    {
      title: 'Módulo 1',
      items: [
        {
          type: 'AULA' as const,
          title: 'Aula 1',
          templateId: uuidAulaTemplate,
          instructorId: uuidInstrutor,
        },
        {
          type: 'PROVA' as const,
          title: 'Prova 1',
          templateId: uuidProvaTemplate,
          instructorId: uuidInstrutor,
        },
      ],
    },
  ],
  standaloneItems: [] as any[],
};

const estruturaPadraoValida = {
  modules: [] as any[],
  standaloneItems: [
    {
      type: 'AULA' as const,
      title: 'Aula Avulsa',
      templateId: uuidAulaTemplate,
      instructorId: uuidInstrutor,
    },
    {
      type: 'PROVA' as const,
      title: 'Prova Avulsa',
      templateId: uuidProvaTemplate,
      instructorId: uuidInstrutor,
    },
  ],
};

const datasValidas = {
  dataInicio: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  dataFim: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
  dataInscricaoInicio: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
  dataInscricaoFim: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000),
};

describe('Turmas Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create - cenários de erro', () => {
    it('deve lançar CURSO_NOT_FOUND quando curso não existe', async () => {
      const mockTx = createMockTx({
        cursos: { findUnique: jest.fn().mockResolvedValue(null) },
      });

      jest.spyOn(prisma, '$transaction').mockImplementation(async (fn: any) => {
        return fn(mockTx);
      });

      await expect(
        turmasService.create(uuidCurso, {
          nome: 'Turma Teste',
          estruturaTipo: 'MODULAR',
          turno: CursosTurnos.NOITE,
          metodo: CursosMetodos.LIVE,
          vagasIlimitadas: false,
          vagasTotais: 30,
          ...datasValidas,
          estrutura: estruturaModularValida,
        }),
      ).rejects.toMatchObject({
        message: 'Curso não encontrado',
        code: 'CURSO_NOT_FOUND',
      });

      expect(mockTx.cursos.findUnique).toHaveBeenCalledWith({
        where: { id: uuidCurso },
        select: { id: true },
      });
    });

    it('deve lançar TURMA_PREREQUISITOS_NAO_ATENDIDOS quando não há templates de aula', async () => {
      const mockTx = createMockTx({
        cursosTurmasAulas: {
          count: jest.fn().mockResolvedValue(0),
          findFirst: jest.fn(),
          create: jest.fn(),
          createMany: jest.fn(),
          findMany: jest.fn().mockResolvedValue([]),
        },
        cursosTurmasProvas: {
          count: jest.fn().mockResolvedValue(1),
          findFirst: jest.fn(),
          create: jest.fn(),
          findMany: jest.fn().mockResolvedValue([{ id: uuidProvaTemplate }]),
        },
      });

      jest.spyOn(prisma, '$transaction').mockImplementation(async (fn: any) => fn(mockTx));

      await expect(
        turmasService.create(uuidCurso, {
          nome: 'Turma Teste',
          estruturaTipo: 'MODULAR',
          turno: CursosTurnos.NOITE,
          metodo: CursosMetodos.LIVE,
          vagasIlimitadas: false,
          vagasTotais: 30,
          ...datasValidas,
          estrutura: estruturaModularValida,
        }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('Templates informados'),
        code: 'TURMA_PREREQUISITOS_NAO_ATENDIDOS',
        details: expect.objectContaining({
          missingAulaTemplateIds: [uuidAulaTemplate],
        }),
      });
    });

    it('deve lançar TURMA_PREREQUISITOS_NAO_ATENDIDOS quando não há templates de avaliação', async () => {
      const mockTx = createMockTx({
        cursosTurmasAulas: {
          count: jest.fn().mockResolvedValue(1),
          findFirst: jest.fn(),
          create: jest.fn(),
          createMany: jest.fn(),
          findMany: jest.fn().mockResolvedValue([{ id: uuidAulaTemplate }]),
        },
        cursosTurmasProvas: {
          count: jest.fn().mockResolvedValue(0),
          findMany: jest.fn().mockResolvedValue([]),
        },
      });

      jest.spyOn(prisma, '$transaction').mockImplementation(async (fn: any) => fn(mockTx));

      await expect(
        turmasService.create(uuidCurso, {
          nome: 'Turma Teste',
          estruturaTipo: 'MODULAR',
          turno: CursosTurnos.NOITE,
          metodo: CursosMetodos.LIVE,
          vagasIlimitadas: false,
          vagasTotais: 30,
          ...datasValidas,
          estrutura: estruturaModularValida,
        }),
      ).rejects.toMatchObject({
        code: 'TURMA_PREREQUISITOS_NAO_ATENDIDOS',
        details: expect.objectContaining({
          missingAvaliacaoTemplateIds: [uuidProvaTemplate],
        }),
      });
    });

    it('deve lançar VALIDATION_ERROR quando vagasIlimitadas false e vagasTotais ausente/zero', async () => {
      const mockTx = createMockTx();

      jest.spyOn(prisma, '$transaction').mockImplementation(async (fn: any) => fn(mockTx));

      await expect(
        turmasService.create(uuidCurso, {
          nome: 'Turma Teste',
          estruturaTipo: 'MODULAR',
          turno: CursosTurnos.NOITE,
          metodo: CursosMetodos.LIVE,
          vagasIlimitadas: false,
          vagasTotais: 0,
          ...datasValidas,
          estrutura: estruturaModularValida,
        }),
      ).rejects.toMatchObject({
        message: 'Informe o total de vagas',
        code: 'VALIDATION_ERROR',
      });
    });

    it('deve lançar AULA_TEMPLATE_NOT_FOUND quando template de aula não existe', async () => {
      const mockTx = createMockTx({
        cursosTurmasAulas: {
          ...createMockTx().cursosTurmasAulas,
          findFirst: jest.fn().mockResolvedValue(null), // template não encontrado
        },
      });
      mockTx.cursosTurmasAulas.findFirst.mockResolvedValue(null);

      jest.spyOn(prisma, '$transaction').mockImplementation(async (fn: any) => fn(mockTx));

      await expect(
        turmasService.create(uuidCurso, {
          nome: 'Turma Teste',
          estruturaTipo: 'MODULAR',
          turno: CursosTurnos.NOITE,
          metodo: CursosMetodos.LIVE,
          vagasIlimitadas: false,
          vagasTotais: 30,
          ...datasValidas,
          estrutura: estruturaModularValida,
        }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('Aula template não encontrada'),
        code: 'AULA_TEMPLATE_NOT_FOUND',
        details: { templateId: uuidAulaTemplate },
      });
    });

    it('deve lançar AVALIACAO_TEMPLATE_NOT_FOUND quando template de avaliação não existe', async () => {
      const mockTx = createMockTx({
        cursosTurmasAulas: {
          count: jest.fn().mockResolvedValue(1),
          findFirst: jest
            .fn()
            .mockResolvedValueOnce({
              id: uuidAulaTemplate,
              nome: 'Aula',
              cursoId: uuidCurso,
              turmaId: null,
              deletedAt: null,
              descricao: null,
              instrutorId: null,
              urlVideo: null,
              sala: null,
              modalidade: 'ONLINE',
              tipoLink: null,
              obrigatoria: true,
              duracaoMinutos: 60,
              gravarAula: true,
              apenasMateriaisComplementares: false,
              dataInicio: null,
              dataFim: null,
              horaInicio: null,
              horaFim: null,
              CursosTurmasAulasMateriais: [],
            })
            .mockResolvedValueOnce(null), // generateNextAulaCodigo
          create: jest.fn().mockResolvedValue({ id: uuidAulaClonada }),
          createMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        cursosTurmasProvas: {
          count: jest.fn().mockResolvedValue(1),
          findFirst: jest.fn().mockResolvedValue(null), // template prova não encontrado
          create: jest.fn(),
        },
      });

      jest.spyOn(prisma, '$transaction').mockImplementation(async (fn: any) => fn(mockTx));

      await expect(
        turmasService.create(uuidCurso, {
          nome: 'Turma Teste',
          estruturaTipo: 'MODULAR',
          turno: CursosTurnos.NOITE,
          metodo: CursosMetodos.LIVE,
          vagasIlimitadas: false,
          vagasTotais: 30,
          ...datasValidas,
          estrutura: estruturaModularValida,
        }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('Avaliação template não encontrada'),
        code: 'AVALIACAO_TEMPLATE_NOT_FOUND',
        details: { templateId: uuidProvaTemplate },
      });
    });
  });

  describe('create - sucesso com vínculos de aulas, módulos e provas', () => {
    it('deve criar turma MODULAR com módulos, aulas e provas clonadas e retornar mapping', async () => {
      const mockTx = createMockTx();

      jest.spyOn(prisma, '$transaction').mockImplementation(async (fn: any) => fn(mockTx));

      const result = await turmasService.create(uuidCurso, {
        nome: 'Turma Teste',
        estruturaTipo: 'MODULAR',
        turno: CursosTurnos.NOITE,
        metodo: CursosMetodos.LIVE,
        vagasIlimitadas: false,
        vagasTotais: 30,
        ...datasValidas,
        estrutura: estruturaModularValida,
      });

      expect(result).toHaveProperty('id', uuidTurmaCriada);
      expect(result).toHaveProperty('nome', 'Turma Teste');
      expect(result).toHaveProperty('codigo');
      expect(result).toHaveProperty('mapping');
      expect(Array.isArray(result.mapping)).toBe(true);
      expect(result.mapping.length).toBe(2); // 1 AULA + 1 PROVA no módulo

      const mappingAula = result.mapping.find((m: any) => m.tipo === 'AULA');
      const mappingProva = result.mapping.find((m: any) => m.tipo === 'PROVA');
      expect(mappingAula).toBeDefined();
      expect(mappingAula?.templateId).toBe(uuidAulaTemplate);
      expect(mappingAula?.instanceId).toBe(uuidAulaClonada);
      expect(mappingAula?.strategy).toBe('CLONE');
      expect(mappingProva).toBeDefined();
      expect(mappingProva?.templateId).toBe(uuidProvaTemplate);
      expect(mappingProva?.instanceId).toBe(uuidProvaClonada);

      expect(mockTx.cursosTurmas.create).toHaveBeenCalledTimes(1);
      expect(mockTx.cursosTurmasModulos.create).toHaveBeenCalledTimes(1);
      expect(mockTx.cursosTurmasModulos.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            turmaId: uuidTurmaCriada,
            nome: 'Módulo 1',
            ordem: 1,
          }),
        }),
      );
      expect(mockTx.cursosTurmasAulas.create).toHaveBeenCalledTimes(1);
      expect(mockTx.cursosTurmasProvas.create).toHaveBeenCalledTimes(1);
    });

    it('deve criar turma PADRAO com standaloneItems (aulas e provas avulsas)', async () => {
      const mockTx = createMockTx();
      mockTx.cursosTurmasAulas.findFirst
        .mockReset()
        .mockResolvedValueOnce({
          id: uuidAulaTemplate,
          nome: 'Aula Avulsa',
          cursoId: uuidCurso,
          turmaId: null,
          deletedAt: null,
          descricao: null,
          instrutorId: null,
          urlVideo: null,
          sala: null,
          modalidade: 'ONLINE',
          tipoLink: null,
          obrigatoria: true,
          duracaoMinutos: 60,
          gravarAula: true,
          apenasMateriaisComplementares: false,
          dataInicio: null,
          dataFim: null,
          horaInicio: null,
          horaFim: null,
          CursosTurmasAulasMateriais: [],
        })
        .mockResolvedValueOnce(null); // generateNextAulaCodigo
      mockTx.cursosTurmasProvas.findFirst
        .mockReset()
        .mockResolvedValueOnce({
          id: uuidProvaTemplate,
          cursoId: uuidCurso,
          turmaId: null,
          titulo: 'Prova Avulsa',
          etiqueta: 'P1',
          tipo: 'PROVA',
          tipoAtividade: null,
          descricao: null,
          peso: 10,
          valePonto: true,
          ativo: true,
          recuperacaoFinal: false,
          modalidade: 'ONLINE',
          obrigatoria: true,
          instrutorId: null,
          dataInicio: null,
          dataFim: null,
          horaInicio: null,
          horaTermino: null,
          CursosTurmasProvasQuestoes: [],
        })
        .mockResolvedValueOnce(null); // makeUniqueEtiqueta

      jest.spyOn(prisma, '$transaction').mockImplementation(async (fn: any) => fn(mockTx));

      const result = await turmasService.create(uuidCurso, {
        nome: 'Turma PADRAO',
        estruturaTipo: 'PADRAO',
        turno: CursosTurnos.INTEGRAL,
        metodo: CursosMetodos.ONLINE,
        vagasIlimitadas: true,
        ...datasValidas,
        estrutura: estruturaPadraoValida,
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('mapping');
      expect(result.mapping.length).toBe(2); // 1 AULA + 1 PROVA standalone
      expect(mockTx.cursosTurmas.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ nome: 'Turma PADRAO' }),
        }),
      );
      expect(mockTx.cursosTurmasModulos.create).not.toHaveBeenCalled();
      expect(mockTx.cursosTurmasAulas.create).toHaveBeenCalledTimes(1);
      expect(mockTx.cursosTurmasProvas.create).toHaveBeenCalledTimes(1);
    });

    it('deve criar turma DINAMICA com modules e standaloneItems', async () => {
      const mockTx = createMockTx();
      const templateAula = {
        id: uuidAulaTemplate,
        nome: 'Aula',
        cursoId: uuidCurso,
        turmaId: null,
        deletedAt: null,
        descricao: null,
        instrutorId: null,
        urlVideo: null,
        sala: null,
        modalidade: 'ONLINE',
        tipoLink: null,
        obrigatoria: true,
        duracaoMinutos: 60,
        gravarAula: true,
        apenasMateriaisComplementares: false,
        dataInicio: null,
        dataFim: null,
        horaInicio: null,
        horaFim: null,
        CursosTurmasAulasMateriais: [],
      };
      mockTx.cursosTurmasAulas.findFirst
        .mockReset()
        .mockResolvedValueOnce(templateAula)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(templateAula)
        .mockResolvedValueOnce(null);
      const templateProva = {
        id: uuidProvaTemplate,
        cursoId: uuidCurso,
        turmaId: null,
        titulo: 'Prova',
        etiqueta: 'P1',
        tipo: 'PROVA',
        tipoAtividade: null,
        descricao: null,
        peso: 10,
        valePonto: true,
        ativo: true,
        recuperacaoFinal: false,
        modalidade: 'ONLINE',
        obrigatoria: true,
        instrutorId: null,
        dataInicio: null,
        dataFim: null,
        horaInicio: null,
        horaTermino: null,
        CursosTurmasProvasQuestoes: [],
      };
      const templateAtividade = {
        ...templateProva,
        titulo: 'Atividade',
        etiqueta: 'AT1',
        tipo: 'ATIVIDADE',
        tipoAtividade: 'QUESTOES',
        peso: 5,
      };
      mockTx.cursosTurmasProvas.findFirst
        .mockReset()
        .mockResolvedValueOnce(templateProva)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(templateAtividade)
        .mockResolvedValueOnce(null);

      jest.spyOn(prisma, '$transaction').mockImplementation(async (fn: any) => fn(mockTx));

      const result = await turmasService.create(uuidCurso, {
        nome: 'Turma DINAMICA',
        estruturaTipo: 'DINAMICA',
        turno: CursosTurnos.NOITE,
        metodo: CursosMetodos.LIVE,
        vagasIlimitadas: false,
        vagasTotais: 25,
        ...datasValidas,
        estrutura: {
          modules: [
            {
              title: 'Módulo 1',
              items: [
                {
                  type: 'AULA' as const,
                  title: 'Aula M1',
                  templateId: uuidAulaTemplate,
                  instructorId: uuidInstrutor,
                },
                {
                  type: 'PROVA' as const,
                  title: 'Prova M1',
                  templateId: uuidProvaTemplate,
                  instructorId: uuidInstrutor,
                },
              ],
            },
          ],
          standaloneItems: [
            {
              type: 'AULA' as const,
              title: 'Aula Avulsa',
              templateId: uuidAulaTemplate,
              instructorId: uuidInstrutor,
            },
            {
              type: 'ATIVIDADE' as const,
              title: 'Atividade Avulsa',
              templateId: uuidProvaTemplate,
              instructorId: uuidInstrutor,
            },
          ],
        },
      });

      expect(result).toHaveProperty('id');
      expect(result.mapping.length).toBe(4); // 2 no módulo + 2 standalone
      expect(mockTx.cursosTurmas.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ nome: 'Turma DINAMICA' }),
        }),
      );
      expect(mockTx.cursosTurmasModulos.create).toHaveBeenCalledTimes(1);
      expect(mockTx.cursosTurmasAulas.create).toHaveBeenCalledTimes(2);
      expect(mockTx.cursosTurmasProvas.create).toHaveBeenCalledTimes(2);
    });

    it('deve aceitar vagasIlimitadas true sem vagasTotais', async () => {
      const mockTx = createMockTx();

      jest.spyOn(prisma, '$transaction').mockImplementation(async (fn: any) => fn(mockTx));

      const result = await turmasService.create(uuidCurso, {
        nome: 'Turma Ilimitada',
        estruturaTipo: 'MODULAR',
        turno: CursosTurnos.NOITE,
        metodo: CursosMetodos.LIVE,
        vagasIlimitadas: true,
        ...datasValidas,
        estrutura: estruturaModularValida,
      });

      expect(result).toHaveProperty('id');
      expect(mockTx.cursosTurmas.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            vagasIlimitadas: true,
            vagasTotais: 0,
            vagasDisponiveis: 0,
          }),
        }),
      );
    });

    it('deve vincular instrutores quando instrutorId e instrutorIds informados', async () => {
      const mockTx = createMockTx();
      const instrutorPrincipal = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const instrutorSecundario = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

      jest.spyOn(prisma, '$transaction').mockImplementation(async (fn: any) => fn(mockTx));

      await turmasService.create(uuidCurso, {
        nome: 'Turma Com Instrutores',
        estruturaTipo: 'MODULAR',
        turno: CursosTurnos.NOITE,
        metodo: CursosMetodos.LIVE,
        vagasIlimitadas: false,
        vagasTotais: 30,
        instrutorId: instrutorPrincipal,
        instrutorIds: [instrutorPrincipal, instrutorSecundario],
        ...datasValidas,
        estrutura: estruturaModularValida,
      });

      expect(mockTx.cursosTurmasInstrutores.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            { turmaId: uuidTurmaCriada, instrutorId: instrutorPrincipal },
            { turmaId: uuidTurmaCriada, instrutorId: instrutorSecundario },
          ]),
          skipDuplicates: true,
        }),
      );
    });
  });
});
