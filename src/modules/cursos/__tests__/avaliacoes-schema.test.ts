import {
  createAvaliacaoSchema,
  listAvaliacoesQuerySchema,
  putUpdateAvaliacaoSchema,
} from '../validators/avaliacoes.schema';

describe('Avaliações schemas', () => {
  it('permite cursoId sem turmaId na criação (template por curso)', () => {
    const result = createAvaliacaoSchema.safeParse({
      tipo: 'PROVA',
      cursoId: '00000000-0000-0000-0000-000000000000',
      titulo: 'Prova 01',
      recuperacaoFinal: false,
      modalidade: 'AO_VIVO',
      obrigatoria: true,
      valePonto: true,
      peso: 10,
      dataInicio: '2099-01-27',
      dataFim: '2099-01-31',
      horaInicio: '10:00',
      horaTermino: '11:00',
      questoes: [
        {
          enunciado: 'Pergunta 1',
          tipo: 'MULTIPLA_ESCOLHA',
          alternativas: [
            { texto: 'A', correta: true },
            { texto: 'B', correta: false },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('exige peso quando valePonto=true', () => {
    const result = putUpdateAvaliacaoSchema.safeParse({
      tipo: 'ATIVIDADE',
      tipoAtividade: 'PERGUNTA_RESPOSTA',
      titulo: 'Atividade',
      modalidade: 'ONLINE',
      obrigatoria: true,
      valePonto: true,
      dataInicio: '2026-01-27',
      dataFim: '2026-01-31',
      horaInicio: '08:00',
      horaTermino: '09:00',
      descricao: 'Pergunta',
    });

    expect(result.success).toBe(false);
  });

  it('PERGUNTA_RESPOSTA exige descricao (pergunta)', () => {
    const result = putUpdateAvaliacaoSchema.safeParse({
      tipo: 'ATIVIDADE',
      tipoAtividade: 'PERGUNTA_RESPOSTA',
      titulo: 'Atividade',
      modalidade: 'ONLINE',
      obrigatoria: true,
      valePonto: false,
      dataInicio: '2026-01-27',
      dataFim: '2026-01-31',
      horaInicio: '08:00',
      horaTermino: '09:00',
    });

    expect(result.success).toBe(false);
  });

  it('list query normaliza modalidade AO_VIVO -> LIVE e aceita periodo', () => {
    const parsed = listAvaliacoesQuerySchema.parse({
      page: '1',
      pageSize: '10',
      modalidade: 'AO_VIVO',
      periodo: '2026-01-27,2026-01-31',
    });

    expect(parsed.modalidade).toBe('LIVE');
    expect(parsed.periodo).toBe('2026-01-27,2026-01-31');
  });
});
