import {
  AuditoriaCategoria,
  CursosAulaStatus,
  CursosTipoQuestao,
  Prisma,
  PrismaClient,
  StatusInscricao,
} from '@prisma/client';

const prisma = new PrismaClient();

const toScore = (value: number) => Number(value.toFixed(1));

const hashText = (text: string) => {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

const pickByHash = <T>(items: T[], seed: string) => {
  if (items.length === 0) return null;
  const index = hashText(seed) % items.length;
  return items[index] ?? null;
};

async function ensureDiscursiveQuestion(provaId: string, titulo: string) {
  const existing = await prisma.cursosTurmasProvasQuestoes.findFirst({
    where: { provaId },
    select: { id: true },
  });

  if (existing) return existing.id;

  const created = await prisma.cursosTurmasProvasQuestoes.create({
    data: {
      provaId,
      enunciado: `Descreva sua resposta para: ${titulo}`,
      tipo: CursosTipoQuestao.TEXTO,
      ordem: 1,
      peso: new Prisma.Decimal(1),
      obrigatoria: true,
    },
    select: { id: true },
  });

  return created.id;
}

async function main() {
  const provas = await prisma.cursosTurmasProvas.findMany({
    where: { turmaId: { not: null } },
    select: {
      id: true,
      titulo: true,
      tipo: true,
      tipoAtividade: true,
      turmaId: true,
      status: true,
      valePonto: true,
      peso: true,
      CursosTurmasProvasQuestoes: {
        select: {
          id: true,
          tipo: true,
          ordem: true,
          peso: true,
          CursosTurmasProvasQuestoesAlternativas: {
            select: { id: true, correta: true, texto: true, ordem: true },
            orderBy: { ordem: 'asc' },
          },
        },
        orderBy: { ordem: 'asc' },
      },
    },
    orderBy: { criadoEm: 'desc' },
  });

  const turmaIds = Array.from(
    new Set(provas.map((prova) => prova.turmaId).filter(Boolean)),
  ) as string[];
  const inscricoesPorTurma = new Map<string, { alunoId: string }[]>();

  for (const turmaId of turmaIds) {
    const inscricoes = await prisma.cursosTurmasInscricoes.findMany({
      where: {
        turmaId,
        status: { notIn: [StatusInscricao.CANCELADO, StatusInscricao.TRANCADO] },
      },
      select: { alunoId: true },
      orderBy: { criadoEm: 'asc' },
    });
    inscricoesPorTurma.set(turmaId, inscricoes);
  }

  const turmaDoadora = Array.from(inscricoesPorTurma.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .find(([, inscricoes]) => inscricoes.length > 0);

  let totalInscricoesCriadas = 0;

  if (turmaDoadora) {
    const [turmaDoadoraId, baseInscricoes] = turmaDoadora;
    for (const turmaId of turmaIds) {
      const atuais = inscricoesPorTurma.get(turmaId) ?? [];
      if (atuais.length > 0) continue;

      let ordem = 1;
      for (const base of baseInscricoes) {
        const codigo = `AT-${turmaId.slice(0, 4)}-${String(ordem).padStart(3, '0')}`;
        ordem += 1;

        await prisma.cursosTurmasInscricoes.upsert({
          where: { turmaId_alunoId: { turmaId, alunoId: base.alunoId } },
          update: {
            status: StatusInscricao.INSCRITO,
            statusPagamento: 'APROVADO',
          },
          create: {
            turmaId,
            alunoId: base.alunoId,
            codigo,
            status: StatusInscricao.INSCRITO,
            statusPagamento: 'APROVADO',
          },
        });
        totalInscricoesCriadas += 1;
      }

      const recarregadas = await prisma.cursosTurmasInscricoes.findMany({
        where: {
          turmaId,
          status: { notIn: [StatusInscricao.CANCELADO, StatusInscricao.TRANCADO] },
        },
        select: { alunoId: true },
      });
      inscricoesPorTurma.set(turmaId, recarregadas);
      console.log(
        `Turma ${turmaId} estava sem inscrições; copiado ${recarregadas.length} aluno(s) da turma ${turmaDoadoraId}.`,
      );
    }
  }

  let totalEnvios = 0;
  let totalRespostas = 0;
  let totalPublicadas = 0;
  let totalQuestoesCriadas = 0;

  for (const prova of provas) {
    if (!prova.turmaId) continue;

    if (
      prova.tipo === 'ATIVIDADE' &&
      prova.tipoAtividade === 'PERGUNTA_RESPOSTA' &&
      prova.CursosTurmasProvasQuestoes.length === 0
    ) {
      await ensureDiscursiveQuestion(prova.id, prova.titulo);
      totalQuestoesCriadas += 1;
    }

    const questoes = await prisma.cursosTurmasProvasQuestoes.findMany({
      where: { provaId: prova.id },
      select: {
        id: true,
        tipo: true,
        peso: true,
        CursosTurmasProvasQuestoesAlternativas: {
          select: { id: true, correta: true, texto: true, ordem: true },
          orderBy: { ordem: 'asc' },
        },
      },
      orderBy: { ordem: 'asc' },
    });

    const inscricoes = await prisma.cursosTurmasInscricoes.findMany({
      where: {
        turmaId: prova.turmaId,
        status: { notIn: [StatusInscricao.CANCELADO, StatusInscricao.TRANCADO] },
      },
      select: { id: true, alunoId: true },
    });

    for (const inscricao of inscricoes) {
      const seed = `${prova.id}:${inscricao.id}`;
      const autoCorrecaoProva = prova.tipo === 'PROVA';
      const markAsCorrected = autoCorrecaoProva || hashText(seed) % 2 === 0;

      const envio = await prisma.cursosTurmasProvasEnvios.upsert({
        where: {
          provaId_inscricaoId: {
            provaId: prova.id,
            inscricaoId: inscricao.id,
          },
        },
        update: {
          nota: null,
          realizadoEm: new Date(),
        },
        create: {
          provaId: prova.id,
          inscricaoId: inscricao.id,
          nota: null,
          realizadoEm: new Date(),
        },
        select: { id: true },
      });
      totalEnvios += 1;

      const envioIp = `177.12.${(hashText(`${seed}:ip`) % 200) + 1}.${(hashText(`${seed}:host`) % 200) + 1}`;
      const hasSubmissionLog = await prisma.auditoriaLogs.findFirst({
        where: {
          entidadeTipo: 'PROVA_RESPOSTA',
          entidadeId: envio.id,
          acao: 'RESPOSTA_REGISTRADA',
        },
        select: { id: true },
      });

      if (!hasSubmissionLog) {
        await prisma.auditoriaLogs.create({
          data: {
            categoria: AuditoriaCategoria.CURSO,
            tipo: 'PROVA_RESPOSTA',
            acao: 'RESPOSTA_REGISTRADA',
            usuarioId: inscricao.alunoId,
            entidadeId: envio.id,
            entidadeTipo: 'PROVA_RESPOSTA',
            descricao: `Envio de resposta na avaliação ${prova.id}`,
            dadosNovos: {
              avaliacaoId: prova.id,
              inscricaoId: inscricao.id,
              envioId: envio.id,
            },
            ip: envioIp,
            userAgent: 'Mozilla/5.0 (Automated Seed)',
          },
        });
      }

      let somaNotaAutomaticaProva = 0;

      for (const questao of questoes) {
        const alternativaCorreta =
          questao.CursosTurmasProvasQuestoesAlternativas.find((alt) => alt.correta) ?? null;
        const alternativaEscolhida =
          questao.tipo === CursosTipoQuestao.MULTIPLA_ESCOLHA
            ? pickByHash(questao.CursosTurmasProvasQuestoesAlternativas, `${seed}:${questao.id}`)
            : null;

        const acertou =
          !!alternativaCorreta &&
          !!alternativaEscolhida &&
          alternativaCorreta.id === alternativaEscolhida.id;
        const notaQuestaoNumber =
          markAsCorrected && prova.valePonto ? (acertou ? Number(questao.peso ?? 1) : 0) : null;
        if (autoCorrecaoProva && notaQuestaoNumber !== null) {
          somaNotaAutomaticaProva += notaQuestaoNumber;
        }
        const notaQuestao =
          notaQuestaoNumber !== null ? new Prisma.Decimal(notaQuestaoNumber) : null;

        const respostaTexto =
          questao.tipo === CursosTipoQuestao.TEXTO
            ? `Resposta automática de teste (${inscricao.id.slice(0, 8)})`
            : null;
        const anexoUrl =
          questao.tipo === CursosTipoQuestao.ANEXO
            ? `https://example.com/anexos/${inscricao.id.slice(0, 8)}-${questao.id.slice(0, 8)}.pdf`
            : null;

        await prisma.cursosTurmasProvasRespostas.upsert({
          where: {
            questaoId_inscricaoId: {
              questaoId: questao.id,
              inscricaoId: inscricao.id,
            },
          },
          update: {
            envioId: envio.id,
            alternativaId: alternativaEscolhida?.id ?? null,
            respostaTexto,
            anexoUrl,
            anexoNome: anexoUrl ? 'resposta-teste.pdf' : null,
            corrigida: markAsCorrected,
            nota: notaQuestao,
          },
          create: {
            questaoId: questao.id,
            inscricaoId: inscricao.id,
            envioId: envio.id,
            alternativaId: alternativaEscolhida?.id ?? null,
            respostaTexto,
            anexoUrl,
            anexoNome: anexoUrl ? 'resposta-teste.pdf' : null,
            corrigida: markAsCorrected,
            nota: notaQuestao,
          },
        });
        totalRespostas += 1;
      }

      const notaEnvio = autoCorrecaoProva
        ? prova.valePonto
          ? new Prisma.Decimal(toScore(somaNotaAutomaticaProva))
          : null
        : markAsCorrected && prova.valePonto
          ? new Prisma.Decimal(toScore(6 + (hashText(seed) % 5)))
          : null;

      await prisma.cursosTurmasProvasEnvios.update({
        where: { id: envio.id },
        data: { nota: notaEnvio },
      });
    }

    if (prova.status !== CursosAulaStatus.PUBLICADA) {
      await prisma.cursosTurmasProvas.update({
        where: { id: prova.id },
        data: { status: CursosAulaStatus.PUBLICADA },
      });
      totalPublicadas += 1;
    }
  }

  console.log('Seed de submissões concluído com sucesso');
  console.log({
    avaliacoesComTurma: provas.length,
    totalInscricoesCriadas,
    totalEnvios,
    totalRespostas,
    totalQuestoesCriadas,
    totalPublicadas,
  });
}

main()
  .catch((error) => {
    console.error('Erro ao semear submissões de avaliações:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
