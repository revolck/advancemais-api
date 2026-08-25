import {
  createAvaliacaoRespostaComentarioSchema,
  listAvaliacaoRespostaComentariosQuerySchema,
} from '../validators/avaliacoes-respostas.schema';
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

  it('ENVIO_MATERIAL exige instruções e não aceita questões estruturadas', () => {
    const result = putUpdateAvaliacaoSchema.safeParse({
      tipo: 'ATIVIDADE',
      tipoAtividade: 'ENVIO_MATERIAL',
      titulo: 'Atividade de envio',
      modalidade: 'ONLINE',
      obrigatoria: true,
      valePonto: false,
      dataInicio: '2026-01-27',
      dataFim: '2026-01-31',
      horaInicio: '08:00',
      horaTermino: '09:00',
      questoes: [
        {
          enunciado: 'Questão indevida',
          tipo: 'MULTIPLA_ESCOLHA',
          alternativas: [
            { texto: 'A', correta: true },
            { texto: 'B', correta: false },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain(
        'Instruções de envio são obrigatórias para atividades de envio de material',
      );
      expect(messages).toContain(
        'Atividades do tipo ENVIO_MATERIAL não devem ter questões estruturadas',
      );
    }
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

describe('Comentários de respostas schemas', () => {
  const anexo = {
    url: 'https://arquivos.example.com/comentario/evidencia.pdf',
    nome: 'evidencia.pdf',
    tipo: 'application/pdf',
    tamanho: 2048,
  };

  it('permite comentário somente com anexo', () => {
    const result = createAvaliacaoRespostaComentarioSchema.safeParse({
      conteudo: '',
      anexos: [anexo],
    });

    expect(result.success).toBe(true);
  });

  it('rejeita comentário sem texto e sem anexo', () => {
    const result = createAvaliacaoRespostaComentarioSchema.safeParse({
      conteudo: '   ',
      anexos: [],
    });

    expect(result.success).toBe(false);
  });

  it('rejeita anexo maior que 5 MB ou com formato não permitido', () => {
    const oversized = createAvaliacaoRespostaComentarioSchema.safeParse({
      conteudo: '',
      anexos: [{ ...anexo, tamanho: 5 * 1024 * 1024 + 1 }],
    });
    const unsupported = createAvaliacaoRespostaComentarioSchema.safeParse({
      conteudo: '',
      anexos: [{ ...anexo, nome: 'programa.exe', tipo: 'application/octet-stream' }],
    });

    expect(oversized.success).toBe(false);
    expect(unsupported.success).toBe(false);
  });

  it('normaliza paginação e limita a quantidade por página', () => {
    expect(listAvaliacaoRespostaComentariosQuerySchema.parse({})).toEqual(
      expect.objectContaining({ page: 1, pageSize: 8 }),
    );
    expect(listAvaliacaoRespostaComentariosQuerySchema.safeParse({ pageSize: 31 }).success).toBe(
      false,
    );
  });
});
