import 'dotenv/config';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient, AuditoriaCategoria, ScriptStatus, ScriptTipo } from '@prisma/client';

type Mode = 'dry-run' | 'execute';

type Args = {
  mode: Mode;
  expectedHost: string;
  expectedCount: number;
  confirm?: string;
  actorId?: string;
  envFile?: string;
};

type RefCount = {
  tableName: string;
  columnName: string;
  deleteRule: string;
  count: number;
  willCleanupManually: boolean;
};

type CleanupReport = {
  id: string;
  mode: Mode;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  host: string;
  expectedHost: string;
  expectedCount: number;
  eligibleCount: number;
  guardInvalidCount: number;
  blockers: RefCount[];
  refCounts: RefCount[];
  stats: Record<string, number>;
  samples: Record<string, unknown>[];
  deletion?: Record<string, number>;
  remainingAfterExecution?: number;
  status: 'DRY_RUN' | 'EXECUTED' | 'BLOCKED' | 'ERROR';
  error?: string;
};

const TARGET_NAME = 'Test User';
const CONFIRM_TOKEN = 'REMOVER_TEST_USER';
const MANUAL_CLEANUP_REFS = new Set([
  'EmpresasCandidatos.empresaUsuarioId',
  'UsuariosEnderecos.usuarioId',
]);

function parseArgs(argv: string[]): Args {
  const parsed = new Map<string, string>();

  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const [key, ...valueParts] = raw.slice(2).split('=');
    parsed.set(key, valueParts.join('=') || 'true');
  }

  const mode = parsed.get('mode') as Mode | undefined;
  const expectedHost = parsed.get('expected-host');
  const expectedCountRaw = parsed.get('expected-count');

  if (mode !== 'dry-run' && mode !== 'execute') {
    throw new Error('Informe --mode=dry-run ou --mode=execute');
  }

  if (!expectedHost) {
    throw new Error('Informe --expected-host=<hostname> para impedir execução no banco errado');
  }

  if (!expectedCountRaw || !/^\d+$/.test(expectedCountRaw)) {
    throw new Error('Informe --expected-count=<numero>');
  }

  return {
    mode,
    expectedHost,
    expectedCount: Number(expectedCountRaw),
    confirm: parsed.get('confirm'),
    actorId: parsed.get('actor-id'),
    envFile: parsed.get('env-file'),
  };
}

function loadEnvFile(envFile?: string) {
  if (!envFile) return;
  dotenv.config({ path: envFile, override: true });
}

function getDatasourceUrl() {
  const datasourceUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!datasourceUrl) {
    throw new Error('DATABASE_URL/DIRECT_URL não configurada');
  }
  return datasourceUrl;
}

function getHost(datasourceUrl: string) {
  return new URL(datasourceUrl).hostname;
}

function assertSafeIdentifier(value: string) {
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(`Identificador inseguro: ${value}`);
  }
  return `"${value}"`;
}

function maskEmail(email: string) {
  const [name, domain] = email.split('@');
  if (!domain) return `${email.slice(0, 4)}***`;
  return `${name.slice(0, 4)}***@${domain}`;
}

function isTestFingerprint(user: { codUsuario: string; email: string }) {
  return user.codUsuario.startsWith('TEST') || /^test-.+@test\.com$/i.test(user.email);
}

async function getForeignKeysToUsuarios(prisma: PrismaClient) {
  return prisma.$queryRawUnsafe<
    { table_name: string; column_name: string; delete_rule: string }[]
  >(`
    select tc.table_name, kcu.column_name, rc.delete_rule
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
      and tc.table_schema = kcu.table_schema
    join information_schema.referential_constraints rc
      on tc.constraint_name = rc.constraint_name
      and tc.table_schema = rc.constraint_schema
    join information_schema.constraint_column_usage ccu
      on rc.unique_constraint_name = ccu.constraint_name
      and rc.unique_constraint_schema = ccu.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and ccu.table_name = 'Usuarios'
    order by tc.table_name, kcu.column_name
  `);
}

async function countReference(
  prisma: PrismaClient,
  tableName: string,
  columnName: string,
  ids: string[],
) {
  if (ids.length === 0) return 0;
  const table = assertSafeIdentifier(tableName);
  const column = assertSafeIdentifier(columnName);
  const rows = await prisma.$queryRawUnsafe<{ count: number }[]>(
    `select count(*)::int as count from ${table} where ${column}::text = any($1::text[])`,
    ids,
  );
  return rows[0]?.count ?? 0;
}

async function collectReferenceCounts(prisma: PrismaClient, ids: string[]): Promise<RefCount[]> {
  const foreignKeys = await getForeignKeysToUsuarios(prisma);
  const refCounts: RefCount[] = [];

  for (const fk of foreignKeys) {
    const key = `${fk.table_name}.${fk.column_name}`;
    refCounts.push({
      tableName: fk.table_name,
      columnName: fk.column_name,
      deleteRule: fk.delete_rule,
      count: await countReference(prisma, fk.table_name, fk.column_name, ids),
      willCleanupManually: MANUAL_CLEANUP_REFS.has(key),
    });
  }

  return refCounts;
}

async function collectStats(prisma: PrismaClient, ids: string[]) {
  if (ids.length === 0) {
    return {
      usuarios: 0,
      empresasVagas: 0,
      empresasCandidatos: 0,
      usuariosCurriculos: 0,
      usuariosSessoes: 0,
      usuariosInformation: 0,
      usuariosVerificacaoEmail: 0,
      notificacoes: 0,
    };
  }

  const vagas = await prisma.empresasVagas.findMany({
    where: { usuarioId: { in: ids } },
    select: { id: true },
  });
  const vagaIds = vagas.map((vaga) => vaga.id);

  return {
    usuarios: ids.length,
    empresasVagas: vagaIds.length,
    empresasCandidatos: await prisma.empresasCandidatos.count({
      where: {
        OR: [
          { candidatoId: { in: ids } },
          { empresaUsuarioId: { in: ids } },
          ...(vagaIds.length > 0 ? [{ vagaId: { in: vagaIds } }] : []),
        ],
      },
    }),
    usuariosCurriculos: await prisma.usuariosCurriculos.count({
      where: { usuarioId: { in: ids } },
    }),
    usuariosSessoes: await prisma.usuariosSessoes.count({ where: { usuarioId: { in: ids } } }),
    usuariosInformation: await prisma.usuariosInformation.count({
      where: { usuarioId: { in: ids } },
    }),
    usuariosVerificacaoEmail: await prisma.usuariosVerificacaoEmail.count({
      where: { usuarioId: { in: ids } },
    }),
    notificacoes: await prisma.notificacoes.count({ where: { usuarioId: { in: ids } } }),
  };
}

function getBlockers(refCounts: RefCount[]) {
  return refCounts.filter((ref) => {
    if (ref.count === 0) return false;
    if (ref.willCleanupManually) return false;
    return ref.deleteRule === 'RESTRICT' || ref.deleteRule === 'NO ACTION';
  });
}

async function writeReport(report: CleanupReport) {
  const reportsDir = path.resolve(process.cwd(), 'scripts/reports');
  await fs.promises.mkdir(reportsDir, { recursive: true });
  const filename = `cleanup-test-users-${report.id}-${report.mode}.json`;
  const filepath = path.join(reportsDir, filename);
  await fs.promises.writeFile(filepath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return filepath;
}

async function deleteTargetUsers(
  prisma: PrismaClient,
  ids: string[],
  actorId: string,
  report: CleanupReport,
) {
  return prisma.$transaction(async (tx) => {
    const actor = await tx.usuarios.findUnique({
      where: { id: actorId },
      select: { id: true, role: true },
    });
    if (!actor) {
      throw new Error('actor-id não encontrado');
    }
    if (ids.includes(actor.id)) {
      throw new Error('actor-id não pode fazer parte dos usuários removidos');
    }

    const vagas = await tx.empresasVagas.findMany({
      where: { usuarioId: { in: ids } },
      select: { id: true },
    });
    const vagaIds = vagas.map((vaga) => vaga.id);
    const deletion: Record<string, number> = {};

    deletion.empresasVagasEntrevistas = (
      await tx.empresasVagasEntrevistas.deleteMany({
        where: {
          OR: [
            { candidatoId: { in: ids } },
            { empresaUsuarioId: { in: ids } },
            { recrutadorId: { in: ids } },
            ...(vagaIds.length > 0 ? [{ vagaId: { in: vagaIds } }] : []),
          ],
        },
      })
    ).count;

    deletion.empresasVagasProcesso = (
      await tx.empresasVagasProcesso.deleteMany({
        where: {
          OR: [
            { candidatoId: { in: ids } },
            ...(vagaIds.length > 0 ? [{ vagaId: { in: vagaIds } }] : []),
          ],
        },
      })
    ).count;

    deletion.empresasCandidatos = (
      await tx.empresasCandidatos.deleteMany({
        where: {
          OR: [
            { candidatoId: { in: ids } },
            { empresaUsuarioId: { in: ids } },
            ...(vagaIds.length > 0 ? [{ vagaId: { in: vagaIds } }] : []),
          ],
        },
      })
    ).count;

    deletion.usuariosEnderecos = (
      await tx.usuariosEnderecos.deleteMany({ where: { usuarioId: { in: ids } } })
    ).count;

    deletion.usuarios = (await tx.usuarios.deleteMany({ where: { id: { in: ids } } })).count;

    const auditoriaScript = await tx.auditoriaScripts.create({
      data: {
        nome: 'cleanup-test-users',
        descricao: 'Remoção controlada de usuários Test User criados por testes automatizados.',
        tipo: ScriptTipo.LIMPEZA,
        status: ScriptStatus.CONCLUIDO,
        executadoPor: actor.id,
        parametros: {
          targetName: TARGET_NAME,
          host: report.host,
          expectedHost: report.expectedHost,
          expectedCount: report.expectedCount,
          confirm: CONFIRM_TOKEN,
        },
        resultado: {
          reportId: report.id,
          removedUserIds: ids,
          deletion,
        },
        duracaoMs: report.durationMs,
        executadoEm: new Date(),
      },
    });

    await tx.auditoriaLogs.create({
      data: {
        categoria: AuditoriaCategoria.SCRIPT,
        tipo: 'TEST_USER_CLEANUP',
        acao: 'REMOVER_TEST_USERS',
        usuarioId: actor.id,
        entidadeId: auditoriaScript.id,
        entidadeTipo: 'AuditoriaScripts',
        descricao: `Removidos ${deletion.usuarios} usuários Test User por limpeza administrativa.`,
        dadosAnteriores: {
          eligibleCount: report.eligibleCount,
          stats: report.stats,
        },
        dadosNovos: {
          deletion,
          reportId: report.id,
        },
        metadata: {
          host: report.host,
          expectedHost: report.expectedHost,
          targetName: TARGET_NAME,
          removedUserIds: ids,
        },
      },
    });

    return deletion;
  });
}

async function main() {
  const startedAtMs = Date.now();
  const args = parseArgs(process.argv.slice(2));
  loadEnvFile(args.envFile);

  const datasourceUrl = getDatasourceUrl();
  const host = getHost(datasourceUrl);
  const prisma = new PrismaClient({ datasourceUrl });
  const report: CleanupReport = {
    id: randomUUID(),
    mode: args.mode,
    startedAt: new Date(startedAtMs).toISOString(),
    host,
    expectedHost: args.expectedHost,
    expectedCount: args.expectedCount,
    eligibleCount: 0,
    guardInvalidCount: 0,
    blockers: [],
    refCounts: [],
    stats: {},
    samples: [],
    status: 'DRY_RUN',
  };

  try {
    if (host !== args.expectedHost) {
      throw new Error(`Host atual ${host} não bate com --expected-host=${args.expectedHost}`);
    }

    if (args.mode === 'execute') {
      if (args.confirm !== CONFIRM_TOKEN) {
        throw new Error(`Para executar informe --confirm=${CONFIRM_TOKEN}`);
      }
      if (!args.actorId) {
        throw new Error('Para executar informe --actor-id=<uuid admin>');
      }
    }

    const users = await prisma.usuarios.findMany({
      where: { nomeCompleto: TARGET_NAME },
      select: {
        id: true,
        nomeCompleto: true,
        codUsuario: true,
        email: true,
        role: true,
        status: true,
        criadoEm: true,
      },
      orderBy: { criadoEm: 'desc' },
    });
    const ids = users.map((user) => user.id);
    const invalidGuardUsers = users.filter((user) => !isTestFingerprint(user));

    report.eligibleCount = users.length;
    report.guardInvalidCount = invalidGuardUsers.length;
    report.samples = users.slice(0, 20).map((user) => ({
      id: user.id,
      nomeCompleto: user.nomeCompleto,
      codUsuario: user.codUsuario,
      email: maskEmail(user.email),
      role: user.role,
      status: user.status,
      criadoEm: user.criadoEm,
    }));
    report.stats = await collectStats(prisma, ids);
    report.refCounts = await collectReferenceCounts(prisma, ids);
    report.blockers = getBlockers(report.refCounts);

    if (users.length !== args.expectedCount) {
      throw new Error(
        `Contagem atual ${users.length} não bate com --expected-count=${args.expectedCount}`,
      );
    }
    if (invalidGuardUsers.length > 0) {
      throw new Error(
        `${invalidGuardUsers.length} usuários Test User não possuem fingerprint TEST/test-*`,
      );
    }
    if (report.blockers.length > 0) {
      throw new Error('Existem referências restritivas não cobertas pela limpeza manual');
    }

    if (args.mode === 'execute') {
      report.deletion = await deleteTargetUsers(prisma, ids, args.actorId!, report);
      report.remainingAfterExecution = await prisma.usuarios.count({
        where: { nomeCompleto: TARGET_NAME },
      });
      report.status = 'EXECUTED';
    }
  } catch (error) {
    report.status = args.mode === 'execute' ? 'ERROR' : 'BLOCKED';
    report.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    report.finishedAt = new Date().toISOString();
    report.durationMs = Date.now() - startedAtMs;
    const reportPath = await writeReport(report);
    await prisma.$disconnect();
    console.log(
      JSON.stringify(
        {
          status: report.status,
          mode: report.mode,
          host: report.host,
          eligibleCount: report.eligibleCount,
          guardInvalidCount: report.guardInvalidCount,
          blockers: report.blockers,
          deletion: report.deletion,
          remainingAfterExecution: report.remainingAfterExecution,
          reportPath,
          error: report.error,
        },
        null,
        2,
      ),
    );
  }
}

main().catch(() => {
  process.exitCode = 1;
});
