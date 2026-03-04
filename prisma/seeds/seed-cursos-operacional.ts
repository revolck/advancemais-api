/**
 * Seed complementar para cenários operacionais de cursos:
 * aulas, agenda, avaliações/provas, questões, respostas, notas e frequência.
 */

import {
  CursosAgendaTipo,
  CursosAulaStatus,
  CursosAvaliacaoTipo,
  CursosEstagioFrequenciaStatus,
  CursosEstagioGrupoTurno,
  CursosEstagioModoAlocacao,
  CursosEstagioParticipanteStatus,
  CursosEstagioPeriodicidade,
  CursosEstagioProgramaStatus,
  CursosEstagioTipoParticipacao,
  CursosAtividadeTipo,
  CursosFrequenciaStatus,
  CursosMetodos,
  CursosNotasTipo,
  CursosTipoQuestao,
  Prisma,
  PrismaClient,
  Roles,
  StatusInscricao,
} from '@prisma/client';

type SeedResult = {
  turmasProcessadas: number;
  aulasCriadasOuAtualizadas: number;
  avaliacoesCriadasOuAtualizadas: number;
  questoesCriadas: number;
  respostasCriadasOuAtualizadas: number;
  notasCriadasOuAtualizadas: number;
  frequenciasCriadasOuAtualizadas: number;
  agendaCriada: number;
  estagiosCriadosOuAtualizados: number;
  estagiosAlunosVinculados: number;
  estagiosFrequenciasCriadasOuAtualizadas: number;
};

const MINUTOS_PRESENCA_PADRAO = 30;
const OBS_META_PREFIX = '__FREQMETA__';
const OBS_META_SEPARATOR = '__::';

const formatCode = (prefix: string, source: string, suffix: string) => {
  const compact = source.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return `${prefix}${compact.slice(0, Math.max(0, 12 - prefix.length - suffix.length))}${suffix}`.slice(
    0,
    12,
  );
};

const buildFreqObservacoes = (
  observacoes: string | null | undefined,
  meta: {
    tipoOrigem: 'AULA' | 'PROVA' | 'ATIVIDADE';
    origemId: string;
    origemTitulo?: string | null;
    modoLancamento?: 'MANUAL' | 'AUTOMATICO';
    minutosPresenca?: number | null;
    minimoMinutosParaPresenca?: number | null;
    lancadoPorId?: string | null;
    lancadoEm?: string | null;
  },
) => {
  const payload = Buffer.from(JSON.stringify(meta), 'utf8').toString('base64url');
  const cleanObs = (observacoes ?? '').trim();
  return `${OBS_META_PREFIX}${payload}${OBS_META_SEPARATOR}${cleanObs}`;
};

const ensureAgendaItem = async (
  prisma: PrismaClient,
  payload: {
    turmaId: string;
    tipo: CursosAgendaTipo;
    titulo: string;
    descricao?: string | null;
    inicio: Date;
    fim?: Date | null;
    aulaId?: string | null;
    provaId?: string | null;
  },
) => {
  const existing = await prisma.cursosTurmasAgenda.findFirst({
    where: {
      turmaId: payload.turmaId,
      tipo: payload.tipo,
      aulaId: payload.aulaId ?? null,
      provaId: payload.provaId ?? null,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.cursosTurmasAgenda.update({
      where: { id: existing.id },
      data: {
        titulo: payload.titulo,
        descricao: payload.descricao ?? null,
        inicio: payload.inicio,
        fim: payload.fim ?? null,
      },
    });
    return false;
  }

  await prisma.cursosTurmasAgenda.create({
    data: {
      turmaId: payload.turmaId,
      tipo: payload.tipo,
      titulo: payload.titulo,
      descricao: payload.descricao ?? null,
      inicio: payload.inicio,
      fim: payload.fim ?? null,
      aulaId: payload.aulaId ?? null,
      provaId: payload.provaId ?? null,
    },
  });
  return true;
};

export async function seedCursosOperacional(prisma?: PrismaClient): Promise<SeedResult> {
  const client = prisma ?? new PrismaClient();
  console.log('🌱 Iniciando seed operacional de cursos...');

  const instrutor = await client.usuarios.findFirst({
    where: { role: Roles.INSTRUTOR },
    select: { id: true, nomeCompleto: true },
  });
  const lancador = await client.usuarios.findFirst({
    where: { role: { in: [Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO] } },
    select: { id: true, nomeCompleto: true },
  });

  if (!instrutor) {
    console.log('  ⚠️ Nenhum instrutor encontrado. Execute seed-usuarios.ts primeiro.');
    return {
      turmasProcessadas: 0,
      aulasCriadasOuAtualizadas: 0,
      avaliacoesCriadasOuAtualizadas: 0,
      questoesCriadas: 0,
      respostasCriadasOuAtualizadas: 0,
      notasCriadasOuAtualizadas: 0,
      frequenciasCriadasOuAtualizadas: 0,
      agendaCriada: 0,
      estagiosCriadosOuAtualizados: 0,
      estagiosAlunosVinculados: 0,
      estagiosFrequenciasCriadasOuAtualizadas: 0,
    };
  }

  const turmas = await client.cursosTurmas.findMany({
    where: {
      Cursos: { statusPadrao: 'PUBLICADO' },
    },
    include: {
      Cursos: { select: { id: true, nome: true, codigo: true } },
    },
    orderBy: { criadoEm: 'asc' },
    take: 4,
  });

  if (turmas.length === 0) {
    console.log('  ⚠️ Nenhuma turma encontrada. Execute seed-cursos.ts primeiro.');
    return {
      turmasProcessadas: 0,
      aulasCriadasOuAtualizadas: 0,
      avaliacoesCriadasOuAtualizadas: 0,
      questoesCriadas: 0,
      respostasCriadasOuAtualizadas: 0,
      notasCriadasOuAtualizadas: 0,
      frequenciasCriadasOuAtualizadas: 0,
      agendaCriada: 0,
      estagiosCriadosOuAtualizados: 0,
      estagiosAlunosVinculados: 0,
      estagiosFrequenciasCriadasOuAtualizadas: 0,
    };
  }

  const result: SeedResult = {
    turmasProcessadas: 0,
    aulasCriadasOuAtualizadas: 0,
    avaliacoesCriadasOuAtualizadas: 0,
    questoesCriadas: 0,
    respostasCriadasOuAtualizadas: 0,
    notasCriadasOuAtualizadas: 0,
    frequenciasCriadasOuAtualizadas: 0,
    agendaCriada: 0,
    estagiosCriadosOuAtualizados: 0,
    estagiosAlunosVinculados: 0,
    estagiosFrequenciasCriadasOuAtualizadas: 0,
  };

  for (const turma of turmas) {
    result.turmasProcessadas += 1;
    console.log(`  🎓 Turma: ${turma.nome} (${turma.codigo})`);

    const modulo = await (async () => {
      const existing = await client.cursosTurmasModulos.findFirst({
        where: { turmaId: turma.id, nome: 'Módulo Inicial' },
      });
      if (existing) return existing;
      return client.cursosTurmasModulos.create({
        data: {
          turmaId: turma.id,
          nome: 'Módulo Inicial',
          descricao: 'Módulo base para testes E2E',
          ordem: 1,
          obrigatorio: true,
        },
      });
    })();

    const now = new Date();
    const aulasData = [
      {
        codigo: formatCode('A', turma.id, '1'),
        nome: `Aula 01 - ${turma.Cursos.nome}`,
        ordem: 1,
        status: CursosAulaStatus.PUBLICADA,
        dataInicio: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        dataFim: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000),
      },
      {
        codigo: formatCode('A', turma.id, '2'),
        nome: `Aula 02 - ${turma.Cursos.nome}`,
        ordem: 2,
        status: CursosAulaStatus.PUBLICADA,
        dataInicio: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        dataFim: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000),
      },
      {
        codigo: formatCode('A', turma.id, '3'),
        nome: `Aula 03 - ${turma.Cursos.nome}`,
        ordem: 3,
        status: CursosAulaStatus.RASCUNHO,
        dataInicio: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        dataFim: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000),
      },
    ];

    const aulas: { id: string; nome: string; ordem: number; dataInicio: Date | null }[] = [];
    for (const aula of aulasData) {
      const aulaDb = await client.cursosTurmasAulas.upsert({
        where: { codigo: aula.codigo },
        update: {
          cursoId: turma.cursoId,
          turmaId: turma.id,
          instrutorId: instrutor.id,
          moduloId: modulo.id,
          nome: aula.nome,
          ordem: aula.ordem,
          status: aula.status,
          modalidade: CursosMetodos.ONLINE,
          dataInicio: aula.dataInicio,
          dataFim: aula.dataFim,
          horaInicio: '19:00',
          horaFim: '20:30',
          criadoPorId: lancador?.id ?? instrutor.id,
        },
        create: {
          codigo: aula.codigo,
          cursoId: turma.cursoId,
          turmaId: turma.id,
          instrutorId: instrutor.id,
          moduloId: modulo.id,
          nome: aula.nome,
          ordem: aula.ordem,
          status: aula.status,
          modalidade: CursosMetodos.ONLINE,
          dataInicio: aula.dataInicio,
          dataFim: aula.dataFim,
          horaInicio: '19:00',
          horaFim: '20:30',
          criadoPorId: lancador?.id ?? instrutor.id,
        },
        select: { id: true, nome: true, ordem: true, dataInicio: true },
      });
      result.aulasCriadasOuAtualizadas += 1;
      aulas.push(aulaDb);
    }

    const provaEtiqueta = `P-${turma.codigo.slice(0, 8).toUpperCase()}`;
    const atividadeEtiqueta = `AT-${turma.codigo.slice(0, 7).toUpperCase()}`;

    const prova = await client.cursosTurmasProvas.upsert({
      where: { turmaId_etiqueta: { turmaId: turma.id, etiqueta: provaEtiqueta } },
      update: {
        cursoId: turma.cursoId,
        moduloId: modulo.id,
        instrutorId: instrutor.id,
        tipo: CursosAvaliacaoTipo.PROVA,
        titulo: `Prova - ${turma.Cursos.nome}`,
        descricao: 'Prova objetiva para testes automatizados',
        peso: new Prisma.Decimal(10),
        valePonto: true,
        status: CursosAulaStatus.PUBLICADA,
        ativo: true,
        dataInicio: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        dataFim: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
        ordem: 1,
      },
      create: {
        cursoId: turma.cursoId,
        turmaId: turma.id,
        moduloId: modulo.id,
        instrutorId: instrutor.id,
        tipo: CursosAvaliacaoTipo.PROVA,
        titulo: `Prova - ${turma.Cursos.nome}`,
        etiqueta: provaEtiqueta,
        descricao: 'Prova objetiva para testes automatizados',
        peso: new Prisma.Decimal(10),
        valePonto: true,
        status: CursosAulaStatus.PUBLICADA,
        ativo: true,
        dataInicio: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        dataFim: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
        ordem: 1,
      },
    });
    result.avaliacoesCriadasOuAtualizadas += 1;

    const atividade = await client.cursosTurmasProvas.upsert({
      where: { turmaId_etiqueta: { turmaId: turma.id, etiqueta: atividadeEtiqueta } },
      update: {
        cursoId: turma.cursoId,
        moduloId: modulo.id,
        instrutorId: instrutor.id,
        tipo: CursosAvaliacaoTipo.ATIVIDADE,
        tipoAtividade: CursosAtividadeTipo.PERGUNTA_RESPOSTA,
        titulo: `Atividade - ${turma.Cursos.nome}`,
        descricao: 'Atividade discursiva para fluxo de correção manual',
        peso: new Prisma.Decimal(10),
        valePonto: true,
        status: CursosAulaStatus.PUBLICADA,
        ativo: true,
        dataInicio: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        dataFim: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
        ordem: 2,
      },
      create: {
        cursoId: turma.cursoId,
        turmaId: turma.id,
        moduloId: modulo.id,
        instrutorId: instrutor.id,
        tipo: CursosAvaliacaoTipo.ATIVIDADE,
        tipoAtividade: CursosAtividadeTipo.PERGUNTA_RESPOSTA,
        titulo: `Atividade - ${turma.Cursos.nome}`,
        etiqueta: atividadeEtiqueta,
        descricao: 'Atividade discursiva para fluxo de correção manual',
        peso: new Prisma.Decimal(10),
        valePonto: true,
        status: CursosAulaStatus.PUBLICADA,
        ativo: true,
        dataInicio: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        dataFim: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
        ordem: 2,
      },
    });
    result.avaliacoesCriadasOuAtualizadas += 1;

    const questaoProva1 = await (async () => {
      const existing = await client.cursosTurmasProvasQuestoes.findFirst({
        where: { provaId: prova.id, ordem: 1 },
      });
      if (existing) {
        return client.cursosTurmasProvasQuestoes.update({
          where: { id: existing.id },
          data: {
            enunciado: 'Qual é o framework frontend usado neste projeto?',
            tipo: CursosTipoQuestao.MULTIPLA_ESCOLHA,
            peso: new Prisma.Decimal(5),
            obrigatoria: true,
          },
        });
      }
      result.questoesCriadas += 1;
      return client.cursosTurmasProvasQuestoes.create({
        data: {
          provaId: prova.id,
          enunciado: 'Qual é o framework frontend usado neste projeto?',
          tipo: CursosTipoQuestao.MULTIPLA_ESCOLHA,
          ordem: 1,
          peso: new Prisma.Decimal(5),
          obrigatoria: true,
        },
      });
    })();

    const questaoProva2 = await (async () => {
      const existing = await client.cursosTurmasProvasQuestoes.findFirst({
        where: { provaId: prova.id, ordem: 2 },
      });
      if (existing) {
        return client.cursosTurmasProvasQuestoes.update({
          where: { id: existing.id },
          data: {
            enunciado: 'Explique em poucas palavras a função da API REST.',
            tipo: CursosTipoQuestao.TEXTO,
            peso: new Prisma.Decimal(5),
            obrigatoria: true,
          },
        });
      }
      result.questoesCriadas += 1;
      return client.cursosTurmasProvasQuestoes.create({
        data: {
          provaId: prova.id,
          enunciado: 'Explique em poucas palavras a função da API REST.',
          tipo: CursosTipoQuestao.TEXTO,
          ordem: 2,
          peso: new Prisma.Decimal(5),
          obrigatoria: true,
        },
      });
    })();

    const alternativas = [
      { ordem: 1, texto: 'Angular', correta: false },
      { ordem: 2, texto: 'Vue', correta: false },
      { ordem: 3, texto: 'React / Next.js', correta: true },
      { ordem: 4, texto: 'Svelte', correta: false },
    ];
    for (const alternativa of alternativas) {
      const existing = await client.cursosTurmasProvasQuestoesAlternativas.findFirst({
        where: { questaoId: questaoProva1.id, ordem: alternativa.ordem },
      });
      if (existing) {
        await client.cursosTurmasProvasQuestoesAlternativas.update({
          where: { id: existing.id },
          data: {
            texto: alternativa.texto,
            correta: alternativa.correta,
          },
        });
      } else {
        await client.cursosTurmasProvasQuestoesAlternativas.create({
          data: {
            questaoId: questaoProva1.id,
            ordem: alternativa.ordem,
            texto: alternativa.texto,
            correta: alternativa.correta,
          },
        });
      }
    }

    const inscricoes = await client.cursosTurmasInscricoes.findMany({
      where: {
        turmaId: turma.id,
        status: { in: [StatusInscricao.INSCRITO, StatusInscricao.EM_ANDAMENTO] },
      },
      include: {
        Usuarios: { select: { id: true, nomeCompleto: true } },
      },
      take: 10,
    });

    for (const inscricao of inscricoes) {
      const progressoAula = aulas[0];
      if (progressoAula) {
        await client.cursosAulasProgresso.upsert({
          where: {
            aulaId_inscricaoId: {
              aulaId: progressoAula.id,
              inscricaoId: inscricao.id,
            },
          },
          update: {
            turmaId: turma.id,
            alunoId: inscricao.alunoId,
            percentualAssistido: new Prisma.Decimal(80),
            tempoAssistidoSegundos: 48 * 60,
            concluida: true,
            concluidaEm: new Date(),
            ultimaPosicao: 48 * 60,
            iniciadoEm: progressoAula.dataInicio ?? new Date(),
          },
          create: {
            aulaId: progressoAula.id,
            turmaId: turma.id,
            inscricaoId: inscricao.id,
            alunoId: inscricao.alunoId,
            percentualAssistido: new Prisma.Decimal(80),
            tempoAssistidoSegundos: 48 * 60,
            concluida: true,
            concluidaEm: new Date(),
            ultimaPosicao: 48 * 60,
            iniciadoEm: progressoAula.dataInicio ?? new Date(),
          },
        });
      }

      const envioProva = await client.cursosTurmasProvasEnvios.upsert({
        where: { provaId_inscricaoId: { provaId: prova.id, inscricaoId: inscricao.id } },
        update: {
          nota: new Prisma.Decimal(8),
          pesoTotal: new Prisma.Decimal(10),
          realizadoEm: new Date(now.getTime() - 60 * 60 * 1000),
          observacoes: 'Envio automático de seed',
        },
        create: {
          provaId: prova.id,
          inscricaoId: inscricao.id,
          nota: new Prisma.Decimal(8),
          pesoTotal: new Prisma.Decimal(10),
          realizadoEm: new Date(now.getTime() - 60 * 60 * 1000),
          observacoes: 'Envio automático de seed',
        },
      });

      const alternativaCorreta = await client.cursosTurmasProvasQuestoesAlternativas.findFirst({
        where: { questaoId: questaoProva1.id, correta: true },
        orderBy: { ordem: 'asc' },
      });
      const alternativaErrada = await client.cursosTurmasProvasQuestoesAlternativas.findFirst({
        where: { questaoId: questaoProva1.id, correta: false },
        orderBy: { ordem: 'asc' },
      });
      const alternativaSelecionada =
        parseInt(inscricao.id.replace(/[^0-9]/g, '').slice(-1) || '0', 10) % 2 === 0
          ? alternativaCorreta
          : alternativaErrada;

      if (alternativaSelecionada) {
        await client.cursosTurmasProvasRespostas.upsert({
          where: {
            questaoId_inscricaoId: {
              questaoId: questaoProva1.id,
              inscricaoId: inscricao.id,
            },
          },
          update: {
            envioId: envioProva.id,
            alternativaId: alternativaSelecionada.id,
            corrigida: true,
            nota: alternativaSelecionada.correta ? new Prisma.Decimal(5) : new Prisma.Decimal(0),
          },
          create: {
            questaoId: questaoProva1.id,
            inscricaoId: inscricao.id,
            envioId: envioProva.id,
            alternativaId: alternativaSelecionada.id,
            corrigida: true,
            nota: alternativaSelecionada.correta ? new Prisma.Decimal(5) : new Prisma.Decimal(0),
          },
        });
        result.respostasCriadasOuAtualizadas += 1;
      }

      await client.cursosTurmasProvasRespostas.upsert({
        where: {
          questaoId_inscricaoId: {
            questaoId: questaoProva2.id,
            inscricaoId: inscricao.id,
          },
        },
        update: {
          envioId: envioProva.id,
          respostaTexto: `Resposta discursiva de ${inscricao.Usuarios?.nomeCompleto ?? 'Aluno'}`,
          corrigida: true,
          nota: new Prisma.Decimal(3),
        },
        create: {
          questaoId: questaoProva2.id,
          inscricaoId: inscricao.id,
          envioId: envioProva.id,
          respostaTexto: `Resposta discursiva de ${inscricao.Usuarios?.nomeCompleto ?? 'Aluno'}`,
          corrigida: true,
          nota: new Prisma.Decimal(3),
        },
      });
      result.respostasCriadasOuAtualizadas += 1;

      await client.cursosNotas.upsert({
        where: { inscricaoId_provaId: { inscricaoId: inscricao.id, provaId: prova.id } },
        update: {
          turmaId: turma.id,
          tipo: CursosNotasTipo.PROVA,
          titulo: `Nota da ${prova.titulo}`,
          nota: envioProva.nota ?? new Prisma.Decimal(8),
          peso: prova.peso,
          valorMaximo: new Prisma.Decimal(10),
          dataReferencia: envioProva.realizadoEm ?? now,
          referenciaExterna: `PROVA:${prova.id}`,
          observacoes: 'Gerada automaticamente no seed',
        },
        create: {
          turmaId: turma.id,
          inscricaoId: inscricao.id,
          provaId: prova.id,
          tipo: CursosNotasTipo.PROVA,
          titulo: `Nota da ${prova.titulo}`,
          nota: envioProva.nota ?? new Prisma.Decimal(8),
          peso: prova.peso,
          valorMaximo: new Prisma.Decimal(10),
          dataReferencia: envioProva.realizadoEm ?? now,
          referenciaExterna: `PROVA:${prova.id}`,
          observacoes: 'Gerada automaticamente no seed',
        },
      });
      result.notasCriadasOuAtualizadas += 1;

      const notaManualRef = `OUTRO:${atividade.id}:${inscricao.id}`;
      const notaManualExistente = await client.cursosNotas.findFirst({
        where: {
          turmaId: turma.id,
          inscricaoId: inscricao.id,
          provaId: null,
          referenciaExterna: notaManualRef,
        },
        select: { id: true },
      });
      if (notaManualExistente) {
        await client.cursosNotas.update({
          where: { id: notaManualExistente.id },
          data: {
            tipo: CursosNotasTipo.ATIVIDADE,
            titulo: 'Nota complementar de atividade',
            nota: new Prisma.Decimal(1.5),
            valorMaximo: new Prisma.Decimal(10),
            referenciaExterna: notaManualRef,
            dataReferencia: now,
            descricao: 'Bônus por participação',
            observacoes: 'Lançamento manual de seed',
          },
        });
      } else {
        await client.cursosNotas.create({
          data: {
            turmaId: turma.id,
            inscricaoId: inscricao.id,
            tipo: CursosNotasTipo.ATIVIDADE,
            titulo: 'Nota complementar de atividade',
            nota: new Prisma.Decimal(1.5),
            valorMaximo: new Prisma.Decimal(10),
            referenciaExterna: notaManualRef,
            dataReferencia: now,
            descricao: 'Bônus por participação',
            observacoes: 'Lançamento manual de seed',
          },
        });
      }
      result.notasCriadasOuAtualizadas += 1;

      const freqDataRef = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
      );
      const freqExistente = await client.cursosFrequenciaAlunos.findFirst({
        where: {
          turmaId: turma.id,
          inscricaoId: inscricao.id,
          aulaId: aulas[0]?.id ?? null,
          dataReferencia: freqDataRef,
        },
        select: { id: true },
      });

      const ausente = parseInt(inscricao.id.replace(/[^0-9]/g, '').slice(-1) || '0', 10) % 3 === 0;
      const status = ausente ? CursosFrequenciaStatus.AUSENTE : CursosFrequenciaStatus.PRESENTE;
      const justificativa = ausente ? 'Ausência registrada para teste de fluxo.' : null;
      const observacoes = buildFreqObservacoes(
        ausente ? 'Ausente no seed operacional' : 'Presença automática no seed operacional',
        {
          tipoOrigem: 'AULA',
          origemId: aulas[0]?.id ?? '',
          origemTitulo: aulas[0]?.nome ?? 'Aula seed',
          modoLancamento: 'MANUAL',
          minutosPresenca: ausente ? 0 : 48,
          minimoMinutosParaPresenca: MINUTOS_PRESENCA_PADRAO,
          lancadoPorId: lancador?.id ?? instrutor.id,
          lancadoEm: now.toISOString(),
        },
      );

      if (freqExistente) {
        await client.cursosFrequenciaAlunos.update({
          where: { id: freqExistente.id },
          data: {
            status,
            justificativa,
            observacoes,
            dataReferencia: freqDataRef,
          },
        });
      } else {
        await client.cursosFrequenciaAlunos.create({
          data: {
            turmaId: turma.id,
            inscricaoId: inscricao.id,
            aulaId: aulas[0]?.id ?? null,
            dataReferencia: freqDataRef,
            status,
            justificativa,
            observacoes,
          },
        });
      }
      result.frequenciasCriadasOuAtualizadas += 1;
    }

    for (const aula of aulas) {
      const created = await ensureAgendaItem(client, {
        turmaId: turma.id,
        tipo: CursosAgendaTipo.AULA,
        titulo: aula.nome,
        descricao: `Agenda automática da aula ${aula.ordem}`,
        inicio: aula.dataInicio ?? new Date(),
        fim: aula.dataInicio ? new Date(aula.dataInicio.getTime() + 90 * 60 * 1000) : null,
        aulaId: aula.id,
      });
      if (created) result.agendaCriada += 1;
    }

    const agendaProvaCriada = await ensureAgendaItem(client, {
      turmaId: turma.id,
      tipo: CursosAgendaTipo.PROVA,
      titulo: prova.titulo,
      descricao: 'Evento de prova criado via seed operacional',
      inicio: prova.dataInicio ?? now,
      fim: prova.dataFim ?? null,
      provaId: prova.id,
    });
    if (agendaProvaCriada) result.agendaCriada += 1;

    const agendaAtividadeCriada = await ensureAgendaItem(client, {
      turmaId: turma.id,
      tipo: CursosAgendaTipo.ATIVIDADE,
      titulo: atividade.titulo,
      descricao: 'Evento de atividade criado via seed operacional',
      inicio: atividade.dataInicio ?? now,
      fim: atividade.dataFim ?? null,
      provaId: atividade.id,
    });
    if (agendaAtividadeCriada) result.agendaCriada += 1;

    // Estágio operacional (visão geral + detalhe + frequência)
    const estagioTitulo = `Estágio Supervisionado - ${turma.Cursos.nome}`;
    const estagioInicio = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const estagioFim = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
    const diasObrigatoriosEstagio = (() => {
      let total = 0;
      const start = new Date(estagioInicio);
      start.setHours(0, 0, 0, 0);
      const end = new Date(estagioFim);
      end.setHours(0, 0, 0, 0);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const day = d.getDay();
        if (day === 1 || day === 3 || day === 5) total += 1;
      }
      return total;
    })();
    const cargaHorariaMinutosEstagio = diasObrigatoriosEstagio * 240;

    const estagioExistente = await client.cursosEstagiosProgramas.findFirst({
      where: {
        turmaId: turma.id,
        titulo: estagioTitulo,
      },
      select: { id: true },
    });

    const estagio = estagioExistente
      ? await client.cursosEstagiosProgramas.update({
          where: { id: estagioExistente.id },
          data: {
            cursoId: turma.cursoId,
            turmaId: turma.id,
            descricao: 'Estágio operacional gerado automaticamente para testes E2E',
            obrigatorio: true,
            modoAlocacao: CursosEstagioModoAlocacao.ESPECIFICOS,
            usarGrupos: true,
            periodicidade: CursosEstagioPeriodicidade.DIAS_SEMANA,
            diasSemana: ['SEG', 'QUA', 'SEX'],
            dataInicio: estagioInicio,
            dataFim: estagioFim,
            incluirSabados: false,
            horarioPadraoInicio: null,
            horarioPadraoFim: null,
            diasObrigatorios: diasObrigatoriosEstagio,
            cargaHorariaMinutos: cargaHorariaMinutosEstagio,
            status: CursosEstagioProgramaStatus.EM_ANDAMENTO,
            atualizadoPorId: lancador?.id ?? instrutor.id,
          },
          select: { id: true },
        })
      : await client.cursosEstagiosProgramas.create({
          data: {
            cursoId: turma.cursoId,
            turmaId: turma.id,
            titulo: estagioTitulo,
            descricao: 'Estágio operacional gerado automaticamente para testes E2E',
            obrigatorio: true,
            modoAlocacao: CursosEstagioModoAlocacao.ESPECIFICOS,
            usarGrupos: true,
            periodicidade: CursosEstagioPeriodicidade.DIAS_SEMANA,
            diasSemana: ['SEG', 'QUA', 'SEX'],
            dataInicio: estagioInicio,
            dataFim: estagioFim,
            incluirSabados: false,
            horarioPadraoInicio: null,
            horarioPadraoFim: null,
            diasObrigatorios: diasObrigatoriosEstagio,
            cargaHorariaMinutos: cargaHorariaMinutosEstagio,
            status: CursosEstagioProgramaStatus.EM_ANDAMENTO,
            criadoPorId: lancador?.id ?? instrutor.id,
            atualizadoPorId: lancador?.id ?? instrutor.id,
          },
          select: { id: true },
        });
    result.estagiosCriadosOuAtualizados += 1;

    const grupoManhaExistente = await client.cursosEstagiosProgramasGrupos.findFirst({
      where: { estagioId: estagio.id, nome: 'Grupo Manhã' },
      select: { id: true },
    });
    const grupoManha = grupoManhaExistente
      ? await client.cursosEstagiosProgramasGrupos.update({
          where: { id: grupoManhaExistente.id },
          data: {
            turno: CursosEstagioGrupoTurno.MANHA,
            capacidade: 30,
            horaInicio: '08:00',
            horaFim: '12:00',
          },
          select: { id: true, capacidade: true },
        })
      : await client.cursosEstagiosProgramasGrupos.create({
          data: {
            estagioId: estagio.id,
            nome: 'Grupo Manhã',
            turno: CursosEstagioGrupoTurno.MANHA,
            capacidade: 30,
            horaInicio: '08:00',
            horaFim: '12:00',
          },
          select: { id: true, capacidade: true },
        });

    const grupoTardeExistente = await client.cursosEstagiosProgramasGrupos.findFirst({
      where: { estagioId: estagio.id, nome: 'Grupo Tarde' },
      select: { id: true },
    });
    const grupoTarde = grupoTardeExistente
      ? await client.cursosEstagiosProgramasGrupos.update({
          where: { id: grupoTardeExistente.id },
          data: {
            turno: CursosEstagioGrupoTurno.TARDE,
            capacidade: 30,
            horaInicio: '13:00',
            horaFim: '17:00',
          },
          select: { id: true, capacidade: true },
        })
      : await client.cursosEstagiosProgramasGrupos.create({
          data: {
            estagioId: estagio.id,
            nome: 'Grupo Tarde',
            turno: CursosEstagioGrupoTurno.TARDE,
            capacidade: 30,
            horaInicio: '13:00',
            horaFim: '17:00',
          },
          select: { id: true, capacidade: true },
        });

    const estagioDataRef = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
    );

    for (let index = 0; index < inscricoes.length; index += 1) {
      const inscricao = inscricoes[index];
      const grupoId = index % 2 === 0 ? grupoManha.id : grupoTarde.id;
      const ausente = parseInt(inscricao.id.replace(/[^0-9]/g, '').slice(-1) || '0', 10) % 4 === 0;

      const participante = await client.cursosEstagiosProgramasAlunos.upsert({
        where: {
          estagioId_inscricaoId: {
            estagioId: estagio.id,
            inscricaoId: inscricao.id,
          },
        },
        update: {
          grupoId,
          tipoParticipacao: CursosEstagioTipoParticipacao.INICIAL,
          status: CursosEstagioParticipanteStatus.EM_ANDAMENTO,
          diasObrigatorios: 1,
          diasPresentes: ausente ? 0 : 1,
          diasAusentes: ausente ? 1 : 0,
          percentualFrequencia: new Prisma.Decimal(ausente ? 0 : 100),
          atualizadoPorId: lancador?.id ?? instrutor.id,
        },
        create: {
          estagioId: estagio.id,
          grupoId,
          inscricaoId: inscricao.id,
          alunoId: inscricao.alunoId,
          tipoParticipacao: CursosEstagioTipoParticipacao.INICIAL,
          status: CursosEstagioParticipanteStatus.EM_ANDAMENTO,
          diasObrigatorios: 1,
          diasPresentes: ausente ? 0 : 1,
          diasAusentes: ausente ? 1 : 0,
          percentualFrequencia: new Prisma.Decimal(ausente ? 0 : 100),
          criadoPorId: lancador?.id ?? instrutor.id,
          atualizadoPorId: lancador?.id ?? instrutor.id,
        },
        select: { id: true },
      });
      result.estagiosAlunosVinculados += 1;

      const freqEstagio = await client.cursosEstagiosProgramasFrequencias.upsert({
        where: {
          estagioAlunoId_dataReferencia: {
            estagioAlunoId: participante.id,
            dataReferencia: estagioDataRef,
          },
        },
        update: {
          status: ausente
            ? CursosEstagioFrequenciaStatus.AUSENTE
            : CursosEstagioFrequenciaStatus.PRESENTE,
          motivo: ausente ? 'Ausência registrada para testes de estágio.' : null,
          atualizadoPorId: lancador?.id ?? instrutor.id,
        },
        create: {
          estagioId: estagio.id,
          estagioAlunoId: participante.id,
          dataReferencia: estagioDataRef,
          status: ausente
            ? CursosEstagioFrequenciaStatus.AUSENTE
            : CursosEstagioFrequenciaStatus.PRESENTE,
          motivo: ausente ? 'Ausência registrada para testes de estágio.' : null,
          lancadoPorId: lancador?.id ?? instrutor.id,
          atualizadoPorId: lancador?.id ?? instrutor.id,
        },
        select: { id: true },
      });
      result.estagiosFrequenciasCriadasOuAtualizadas += 1;

      const historicoExiste = await client.cursosEstagiosProgramasFrequenciasHistorico.findFirst({
        where: {
          frequenciaId: freqEstagio.id,
          toStatus: ausente
            ? CursosEstagioFrequenciaStatus.AUSENTE
            : CursosEstagioFrequenciaStatus.PRESENTE,
        },
        select: { id: true },
      });

      if (!historicoExiste) {
        await client.cursosEstagiosProgramasFrequenciasHistorico.create({
          data: {
            estagioId: estagio.id,
            frequenciaId: freqEstagio.id,
            fromStatus: null,
            toStatus: ausente
              ? CursosEstagioFrequenciaStatus.AUSENTE
              : CursosEstagioFrequenciaStatus.PRESENTE,
            motivo: ausente ? 'Ausência registrada para testes de estágio.' : null,
            actorId: lancador?.id ?? instrutor.id,
            metadata: {
              source: 'seed-cursos-operacional',
            },
          },
        });
      }
    }
  }

  console.log('✨ Seed operacional concluído:', result);
  return result;
}

if (require.main === module) {
  const datasourceUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
  const prisma = new PrismaClient({ datasourceUrl });
  seedCursosOperacional(prisma)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Erro no seed operacional de cursos:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
