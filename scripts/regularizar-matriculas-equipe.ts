/**
 * Regularização das matrículas (PRD "Matrículas pela Equipe", fase 4).
 *
 * 1. Matrículas antigas feitas pela equipe: nasceram "inscrito" com pagamento PENDENTE e sem
 *    pagamento no Mercado Pago, o que bloqueia provas. Passam a "concedido pela equipe".
 * 2. Marca a origem das matrículas sem origem: MIGRACAO (turmas MIGT…) e CHECKOUT (pagas no site).
 *
 * Por padrão só simula. Para aplicar, informe as quantidades que a simulação mostrou:
 *   npx tsx -r tsconfig-paths/register scripts/regularizar-matriculas-equipe.ts \
 *     --aplicar --esperado-equipe=0 --esperado-migradas=8085 --esperado-checkout=2 \
 *     --backup=./regularizacao-backup.json
 * Se algum número mudou desde a simulação, nada é alterado.
 * Para desfazer: os ids alterados ficam no arquivo de backup (origem antes era nula).
 */
import fs from 'fs';
import { AuditoriaCategoria, Prisma } from '@prisma/client';

import { prisma } from '@/config/prisma';

const STATUS_COM_ACESSO = ['INSCRITO', 'EM_ANDAMENTO', 'EM_ESTAGIO', 'CONCLUIDO', 'REPROVADO'];

const arg = (nome: string) =>
  process.argv
    .find((a) => a.startsWith(`--${nome}=`))
    ?.split('=')
    .slice(1)
    .join('=');

const SQL_EQUIPE = Prisma.sql`
  from "CursosTurmasInscricoes" i
  where i.origem is null
    and i."statusPagamento" = 'PENDENTE'
    and i.status::text in (${Prisma.join(STATUS_COM_ACESSO)})
    and i."mpPaymentId" is null and i."mpOrderId" is null`;
const SQL_MIGRADAS = Prisma.sql`
  from "CursosTurmasInscricoes" i join "CursosTurmas" t on t.id = i."turmaId"
  where i.origem is null and t.codigo like 'MIGT%'`;
const SQL_CHECKOUT = Prisma.sql`
  from "CursosTurmasInscricoes" i
  where i.origem is null and (i."mpPaymentId" is not null or i."mpOrderId" is not null)`;

async function contar(trecho: Prisma.Sql) {
  const [linha] = await prisma.$queryRaw<{ qtd: number }[]>(
    Prisma.sql`select count(*)::int as qtd ${trecho}`,
  );
  return linha.qtd;
}

async function main() {
  const aplicar = process.argv.includes('--aplicar');
  const simulacao = {
    equipe: await contar(SQL_EQUIPE),
    migradas: await contar(SQL_MIGRADAS),
    checkout: await contar(SQL_CHECKOUT),
    semOrigemDepois: 0,
  };
  const [{ qtd: semOrigem }] = await prisma.$queryRaw<{ qtd: number }[]>`
    select count(*)::int as qtd from "CursosTurmasInscricoes" where origem is null`;
  simulacao.semOrigemDepois =
    semOrigem - simulacao.equipe - simulacao.migradas - simulacao.checkout;

  console.log(JSON.stringify({ modo: aplicar ? 'aplicar' : 'simulacao', ...simulacao }));
  if (!aplicar) return;

  const esperado = {
    equipe: Number(arg('esperado-equipe')),
    migradas: Number(arg('esperado-migradas')),
    checkout: Number(arg('esperado-checkout')),
  };
  const backup = arg('backup');
  if (!backup) throw new Error('Informe --backup=arquivo.json');
  for (const chave of ['equipe', 'migradas', 'checkout'] as const) {
    if (esperado[chave] !== simulacao[chave]) {
      throw new Error(
        `Quantidade de "${chave}" mudou: simulação ${simulacao[chave]}, informado ${esperado[chave]}. Nada foi alterado.`,
      );
    }
  }

  const alterados = await prisma.$transaction(
    async (tx) => {
      const equipe = await tx.$queryRaw<{ id: string; statusPagamento: string }[]>(Prisma.sql`
        update "CursosTurmasInscricoes" u
        set origem = 'EQUIPE', "statusPagamento" = 'APROVADO', "metodoPagamento" = 'ADMINISTRATIVO',
            "valorPago" = 0, "valorFinal" = 0
        where u.id in (select i.id ${SQL_EQUIPE})
        returning u.id, 'PENDENTE' as "statusPagamento"`);
      const migradas = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        update "CursosTurmasInscricoes" u set origem = 'MIGRACAO'
        where u.id in (select i.id ${SQL_MIGRADAS}) returning u.id`);
      const checkout = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        update "CursosTurmasInscricoes" u set origem = 'CHECKOUT'
        where u.id in (select i.id ${SQL_CHECKOUT}) returning u.id`);

      if (
        equipe.length !== esperado.equipe ||
        migradas.length !== esperado.migradas ||
        checkout.length !== esperado.checkout
      ) {
        throw new Error('As quantidades alteradas não batem com a simulação. Tudo foi desfeito.');
      }

      await tx.auditoriaLogs.create({
        data: {
          categoria: AuditoriaCategoria.SCRIPT,
          tipo: 'CURSO_INSCRICAO',
          acao: 'REGULARIZACAO_MATRICULAS',
          descricao: `Regularização das matrículas: ${equipe.length} da equipe (pagamento concedido), ${migradas.length} migradas e ${checkout.length} do site marcadas com a origem.`,
          metadata: {
            script: 'scripts/regularizar-matriculas-equipe.ts',
            equipe: equipe.length,
            migradas: migradas.length,
            checkout: checkout.length,
          },
        },
      });
      return { equipe, migradas, checkout };
    },
    { timeout: 120_000 },
  );

  fs.writeFileSync(
    backup,
    JSON.stringify(
      {
        aplicadoEm: new Date().toISOString(),
        desfazer:
          'origem volta a null nos ids abaixo; os de "equipe" voltam a statusPagamento PENDENTE, metodoPagamento null, valorPago null',
        equipe: alterados.equipe.map((x) => x.id),
        migradas: alterados.migradas.map((x) => x.id),
        checkout: alterados.checkout.map((x) => x.id),
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      aplicado: true,
      equipe: alterados.equipe.length,
      migradas: alterados.migradas.length,
      checkout: alterados.checkout.length,
      backup,
    }),
  );
}

main()
  .catch((erro) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
