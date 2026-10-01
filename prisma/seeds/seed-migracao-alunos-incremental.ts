/**
 * Seed de migracao INCREMENTAL de alunos e inscricoes do sistema legado.
 *
 * Fonte: migracao/grid_w_aluno - 04-05 a 30-09.xlsx, normalizada em
 * prisma/seeds/data/alunos-migracao-incremental-2026-09.json.
 *
 * Regras (banco de producao):
 * - Somente INSERT. Nenhum registro existente e atualizado ou removido.
 * - Aluno cujo CPF ja existe na base e ignorado, junto com suas inscricoes
 *   (sem migracao dupla).
 * - Cursos sao reaproveitados da migracao de maio (codigo MIGC...); nenhum curso e criado.
 * - Turmas seguem o codigo da migracao de maio (MIGT...) e sao criadas como CONCLUIDO,
 *   igual as turmas "Turma legado" de maio: sao registro do legado, sem aulas, e o
 *   turmas-status-watcher nao processa turmas concluidas (evita notificacoes em massa).
 * - Inscricoes entram como INSCRITO com statusPagamento CONCLUIDO (pago no legado,
 *   mesmo marcador da migracao de maio).
 * - Cada aluno e criado em transacao propria junto com suas inscricoes.
 *
 * Uso:
 *   ts-node prisma/seeds/seed-migracao-alunos-incremental.ts                        (dry-run)
 *   ts-node prisma/seeds/seed-migracao-alunos-incremental.ts --execute              (grava)
 *   ts-node prisma/seeds/seed-migracao-alunos-incremental.ts --execute --limit=1    (grava so N alunos)
 */

import 'dotenv/config';
import {
  CursoStatus,
  CursosMetodos,
  CursosTurmaEstruturaTipo,
  CursosTurnos,
  Prisma,
  PrismaClient,
  Roles,
  Status,
  StatusInscricao,
  TiposDeUsuarios,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

import {
  buildCodigoInscricaoMigracao,
  buildCodigoTurmaMigracao,
  parseLegacyDateToUtcNoon,
} from './seed-migracao-legado';

interface AlunoIncrementalSeed {
  cpf: string;
  nome: string;
  telefone: string;
  cidade: string | null;
  estado: string | null;
  cadastro: string;
  linhasOrigem: number[];
}

interface InscricaoIncrementalSeed {
  linhaOrigem: number;
  cpf: string;
  cursoNome: string;
  dataInicio: string;
  dataFim: string;
  horario: string;
  valorCurso: number | null;
  cargaHoraria: number | null;
  cadastro: string;
}

interface DadosMigracao {
  metadata: { source: string };
  alunos: AlunoIncrementalSeed[];
  inscricoes: InscricaoIncrementalSeed[];
}

type MotivoIgnorado =
  | 'CPF_INVALIDO'
  | 'CPF_JA_EXISTE'
  | 'EMAIL_JA_EXISTE'
  | 'AUTH_ID_JA_EXISTE'
  | 'COD_USUARIO_JA_EXISTE'
  | 'CURSO_NAO_ENCONTRADO'
  | 'TURMA_CODIGO_EM_OUTRO_CURSO'
  | 'PERIODO_INVALIDO'
  | 'INSCRICAO_JA_EXISTE';

interface InscricaoPlanejada extends InscricaoIncrementalSeed {
  cursoId: string;
  turmaCodigo: string;
  inscricaoCodigo: string;
}

interface AlunoPlanejado extends AlunoIncrementalSeed {
  inscricoes: InscricaoPlanejada[];
}

const datasourceUrl =
  process.env.MIGRACAO_DATABASE_URL || process.env.DATABASE_URL || process.env.DIRECT_URL || '';
const DATA_PATH = path.resolve(__dirname, 'data', 'alunos-migracao-incremental-2026-09.json');
const REPORTS_DIR = path.resolve(__dirname, 'reports');
const SENHA_PADRAO_MIGRACAO = 'BemVindo@2026';
const EXECUTE = process.argv.includes('--execute');
const LIMIT = Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 0);

const normalizeSpaces = (value: string | null | undefined) =>
  (value ?? '').replace(/\s+/g, ' ').trim();

function isCpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const size of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < size; i += 1) sum += Number(cpf[i]) * (size + 1 - i);
    let digit = (sum * 10) % 11;
    if (digit === 10) digit = 0;
    if (digit !== Number(cpf[size])) return false;
  }
  return true;
}

const inferTurno = (horario: string) => {
  const normalized = normalizeSpaces(horario).toUpperCase();
  if (normalized === 'M') return CursosTurnos.MANHA;
  if (normalized === 'T') return CursosTurnos.TARDE;
  if (normalized === 'N') return CursosTurnos.NOITE;
  return CursosTurnos.INTEGRAL;
};

const inferMetodo = (cursoNome: string) => {
  const normalized = cursoNome.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  return normalized.includes('ONLINE') || normalized.includes('ON-LINE')
    ? CursosMetodos.ONLINE
    : CursosMetodos.PRESENCIAL;
};

const formatDatePtBr = (date: Date) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date);

const alunoEmail = (cpf: string) => `aluno.migracao.${cpf}@sem-email.local`;
const alunoAuthId = (cpf: string) => `migracao-aluno-${cpf}`;
const alunoCodUsuario = (cpf: string) => `ALU${cpf}`;

async function findConflitoAluno(
  client: PrismaClient | Prisma.TransactionClient,
  cpf: string,
): Promise<{ motivo: MotivoIgnorado; existenteId: string; role?: string } | null> {
  const [porCpf] = await client.$queryRaw<{ id: string; role: string }[]>`
    SELECT id, role::text AS role FROM "Usuarios"
    WHERE regexp_replace(coalesce(cpf, ''), '\\D', '', 'g') = ${cpf}
    LIMIT 1`;
  if (porCpf) return { motivo: 'CPF_JA_EXISTE', existenteId: porCpf.id, role: porCpf.role };

  const [porEmail] = await client.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Usuarios" WHERE lower(email) = lower(${alunoEmail(cpf)}) LIMIT 1`;
  if (porEmail) return { motivo: 'EMAIL_JA_EXISTE', existenteId: porEmail.id };

  const porAuthId = await client.usuarios.findUnique({
    where: { authId: alunoAuthId(cpf) },
    select: { id: true },
  });
  if (porAuthId) return { motivo: 'AUTH_ID_JA_EXISTE', existenteId: porAuthId.id };

  const porCodigo = await client.usuarios.findUnique({
    where: { codUsuario: alunoCodUsuario(cpf) },
    select: { id: true },
  });
  if (porCodigo) return { motivo: 'COD_USUARIO_JA_EXISTE', existenteId: porCodigo.id };

  return null;
}

async function main() {
  const client = new PrismaClient({ datasourceUrl });
  const dados = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')) as DadosMigracao;
  const inicio = new Date();
  const ignorados: Record<string, unknown>[] = [];
  const erros: Record<string, unknown>[] = [];
  const alunosCriados: Record<string, unknown>[] = [];
  const inscricoesCriadas: Record<string, unknown>[] = [];
  const turmasCriadas: Record<string, unknown>[] = [];

  console.log(`🌱 Migracao incremental de alunos (${EXECUTE ? 'EXECUCAO' : 'DRY-RUN'})`);
  console.log(`  📄 Fonte: ${DATA_PATH}`);
  console.log(`  👤 Alunos no arquivo: ${dados.alunos.length}`);
  console.log(`  📝 Inscricoes no arquivo: ${dados.inscricoes.length}`);

  try {
    const contar = async () => ({
      usuarios: await client.usuarios.count(),
      alunos: await client.usuarios.count({ where: { role: Roles.ALUNO_CANDIDATO } }),
      turmas: await client.cursosTurmas.count(),
      inscricoes: await client.cursosTurmasInscricoes.count(),
      cursos: await client.cursos.count(),
    });
    const totaisAntes = await contar();

    // Cursos da migracao de maio, indexados pelo nome normalizado
    const cursos = await client.cursos.findMany({
      where: { deletedAt: null },
      select: { id: true, nome: true, criadoEm: true },
      orderBy: { criadoEm: 'asc' },
    });
    const cursoPorNome = new Map<string, string>();
    for (const curso of cursos) {
      const key = normalizeSpaces(curso.nome);
      if (!cursoPorNome.has(key)) cursoPorNome.set(key, curso.id);
    }

    // Preflight somente leitura
    const planejados: AlunoPlanejado[] = [];
    for (const aluno of dados.alunos) {
      const base = { cpf: aluno.cpf, nome: aluno.nome, linhasOrigem: aluno.linhasOrigem };
      const inscricoesAluno = dados.inscricoes.filter((i) => i.cpf === aluno.cpf);

      if (!isCpfValido(aluno.cpf)) {
        ignorados.push({ ...base, motivo: 'CPF_INVALIDO' });
        continue;
      }

      const conflito = await findConflitoAluno(client, aluno.cpf);
      if (conflito) {
        ignorados.push({
          ...base,
          ...conflito,
          inscricoesIgnoradas: inscricoesAluno.map((i) => ({
            linhaOrigem: i.linhaOrigem,
            curso: i.cursoNome,
            periodo: `${i.dataInicio} a ${i.dataFim}`,
          })),
        });
        continue;
      }

      const inscricoes: InscricaoPlanejada[] = [];
      for (const inscricao of inscricoesAluno) {
        const baseInscricao = {
          ...base,
          linhaOrigem: inscricao.linhaOrigem,
          curso: inscricao.cursoNome,
        };
        const cursoId = cursoPorNome.get(normalizeSpaces(inscricao.cursoNome));
        if (!cursoId) {
          ignorados.push({ ...baseInscricao, motivo: 'CURSO_NAO_ENCONTRADO' });
          continue;
        }
        const dataInicio = parseLegacyDateToUtcNoon(inscricao.dataInicio);
        const dataFim = parseLegacyDateToUtcNoon(inscricao.dataFim);
        if (!dataInicio || !dataFim || dataFim < dataInicio) {
          ignorados.push({ ...baseInscricao, motivo: 'PERIODO_INVALIDO' });
          continue;
        }

        const turmaCodigo = buildCodigoTurmaMigracao(inscricao);
        const turmaExistente = await client.cursosTurmas.findUnique({
          where: { codigo: turmaCodigo },
          select: { id: true, cursoId: true },
        });
        if (turmaExistente && turmaExistente.cursoId !== cursoId) {
          ignorados.push({ ...baseInscricao, motivo: 'TURMA_CODIGO_EM_OUTRO_CURSO', turmaCodigo });
          continue;
        }

        const inscricaoCodigo = buildCodigoInscricaoMigracao(aluno.cpf, turmaCodigo);
        const inscricaoExistente = await client.cursosTurmasInscricoes.findUnique({
          where: { codigo: inscricaoCodigo },
          select: { id: true },
        });
        if (inscricaoExistente) {
          ignorados.push({ ...baseInscricao, motivo: 'INSCRICAO_JA_EXISTE', inscricaoCodigo });
          continue;
        }

        inscricoes.push({ ...inscricao, cursoId, turmaCodigo, inscricaoCodigo });
      }

      planejados.push({ ...aluno, inscricoes });
    }

    const turmasPlanejadas = new Set(
      planejados.flatMap((a) => a.inscricoes.map((i) => i.turmaCodigo)),
    );
    console.log(`  ✅ Alunos a criar: ${planejados.length}`);
    console.log(
      `  ✅ Inscricoes a criar: ${planejados.reduce((t, a) => t + a.inscricoes.length, 0)}`,
    );
    console.log(`  ✅ Turmas envolvidas: ${turmasPlanejadas.size}`);
    console.log(`  ⏭️  Ignorados: ${ignorados.length}`);
    for (const item of ignorados) {
      console.log(`     - ${item.cpf} ${item.nome}: ${item.motivo}`);
    }

    // Data de abertura de inscricao de cada turma = cadastro mais antigo entre seus alunos
    const cadastroMaisAntigoPorTurma = new Map<string, Date>();
    for (const inscricao of planejados.flatMap((a) => a.inscricoes)) {
      const cadastro = parseLegacyDateToUtcNoon(inscricao.cadastro);
      if (!cadastro) continue;
      const atual = cadastroMaisAntigoPorTurma.get(inscricao.turmaCodigo);
      if (!atual || cadastro < atual)
        cadastroMaisAntigoPorTurma.set(inscricao.turmaCodigo, cadastro);
    }

    if (EXECUTE && planejados.length > 0) {
      const senhaHash = await bcrypt.hash(SENHA_PADRAO_MIGRACAO, 12);
      const lote = LIMIT > 0 ? planejados.slice(0, LIMIT) : planejados;
      console.log(`  🚚 Lote desta execucao: ${lote.length} aluno(s)`);

      for (const aluno of lote) {
        try {
          const resultado = await client.$transaction(
            async (tx) => {
              // Rechecagem dentro da transacao: nunca sobrescreve registro existente
              const conflito = await findConflitoAluno(tx, aluno.cpf);
              if (conflito) {
                ignorados.push({
                  cpf: aluno.cpf,
                  nome: aluno.nome,
                  linhasOrigem: aluno.linhasOrigem,
                  ...conflito,
                });
                return null;
              }

              const agora = new Date();
              const usuarioId = randomUUID();
              const criadoEm = parseLegacyDateToUtcNoon(aluno.cadastro) ?? agora;
              const usuario = await tx.usuarios.create({
                data: {
                  id: usuarioId,
                  authId: alunoAuthId(aluno.cpf),
                  nomeCompleto: aluno.nome,
                  email: alunoEmail(aluno.cpf),
                  senha: senhaHash,
                  codUsuario: alunoCodUsuario(aluno.cpf),
                  tipoUsuario: TiposDeUsuarios.PESSOA_FISICA,
                  role: Roles.ALUNO_CANDIDATO,
                  status: Status.ATIVO,
                  cpf: aluno.cpf,
                  criadoEm,
                  atualizadoEm: agora,
                  UsuariosInformation: {
                    create: {
                      telefone: aluno.telefone,
                      inscricao: `MIG${usuarioId.slice(0, 8).toUpperCase()}`,
                      descricao:
                        `Origem: ${path.basename(dados.metadata.source)} | Linha(s): ${aluno.linhasOrigem.join(', ')}`.slice(
                          0,
                          500,
                        ),
                      aceitarTermos: false,
                    },
                  },
                  ...(aluno.cidade || aluno.estado
                    ? {
                        UsuariosEnderecos: {
                          create: { id: randomUUID(), cidade: aluno.cidade, estado: aluno.estado },
                        },
                      }
                    : {}),
                  UsuariosVerificacaoEmail: {
                    create: {
                      emailVerificado: true,
                      emailVerificadoEm: agora,
                      emailVerificationAttempts: 0,
                    },
                  },
                },
                select: { id: true, codUsuario: true },
              });

              const inscricoes: Record<string, unknown>[] = [];
              const turmasNovas: Record<string, unknown>[] = [];
              for (const inscricao of aluno.inscricoes) {
                const dataInicio = parseLegacyDateToUtcNoon(inscricao.dataInicio) as Date;
                const dataFim = parseLegacyDateToUtcNoon(inscricao.dataFim) as Date;
                let turma = await tx.cursosTurmas.findUnique({
                  where: { codigo: inscricao.turmaCodigo },
                  select: { id: true, cursoId: true },
                });
                if (turma && turma.cursoId !== inscricao.cursoId) {
                  throw new Error(`Turma ${inscricao.turmaCodigo} pertence a outro curso`);
                }
                if (!turma) {
                  const abertura =
                    cadastroMaisAntigoPorTurma.get(inscricao.turmaCodigo) ?? dataInicio;
                  turma = await tx.cursosTurmas.create({
                    data: {
                      id: randomUUID(),
                      codigo: inscricao.turmaCodigo,
                      cursoId: inscricao.cursoId,
                      estruturaTipo: CursosTurmaEstruturaTipo.PADRAO,
                      nome: `Turma legado - ${formatDatePtBr(dataInicio)} a ${formatDatePtBr(dataFim)}`,
                      turno: inferTurno(inscricao.horario),
                      metodo: inferMetodo(inscricao.cursoNome),
                      dataInicio,
                      dataFim,
                      dataInscricaoInicio: abertura,
                      dataInscricaoFim: dataInicio,
                      vagasIlimitadas: true,
                      vagasTotais: 0,
                      vagasDisponiveis: 0,
                      status: CursoStatus.CONCLUIDO,
                      criadoEm: abertura,
                      atualizadoEm: agora,
                    },
                    select: { id: true, cursoId: true },
                  });
                  turmasNovas.push({
                    turmaId: turma.id,
                    codigo: inscricao.turmaCodigo,
                    curso: inscricao.cursoNome,
                    periodo: `${inscricao.dataInicio} a ${inscricao.dataFim}`,
                  });
                }

                const valor =
                  typeof inscricao.valorCurso === 'number' && Number.isFinite(inscricao.valorCurso)
                    ? new Prisma.Decimal(inscricao.valorCurso)
                    : null;
                const criada = await tx.cursosTurmasInscricoes.create({
                  data: {
                    id: randomUUID(),
                    turmaId: turma.id,
                    alunoId: usuario.id,
                    codigo: inscricao.inscricaoCodigo,
                    criadoEm: parseLegacyDateToUtcNoon(inscricao.cadastro) ?? agora,
                    status: StatusInscricao.INSCRITO,
                    statusPagamento: 'CONCLUIDO',
                    valorPago: valor,
                    valorOriginal: valor,
                    valorFinal: valor,
                    aceitouTermos: false,
                  },
                  select: { id: true },
                });
                inscricoes.push({
                  inscricaoId: criada.id,
                  codigo: inscricao.inscricaoCodigo,
                  turmaCodigo: inscricao.turmaCodigo,
                  linhaOrigem: inscricao.linhaOrigem,
                  curso: inscricao.cursoNome,
                });
              }

              return { usuario, inscricoes, turmasNovas };
            },
            { timeout: 60000, maxWait: 20000 },
          );

          if (resultado) {
            alunosCriados.push({
              usuarioId: resultado.usuario.id,
              codUsuario: resultado.usuario.codUsuario,
              cpf: aluno.cpf,
              nome: aluno.nome,
              linhasOrigem: aluno.linhasOrigem,
            });
            inscricoesCriadas.push(
              ...resultado.inscricoes.map((i) => ({
                ...i,
                cpf: aluno.cpf,
                alunoId: resultado.usuario.id,
              })),
            );
            turmasCriadas.push(...resultado.turmasNovas);
            console.log(
              `  ➕ ${resultado.usuario.codUsuario} ${aluno.nome} (${resultado.inscricoes.length} inscricao(oes))`,
            );
          }
        } catch (error: any) {
          const codigo = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : '';
          erros.push({
            cpf: aluno.cpf,
            nome: aluno.nome,
            erro: `${codigo} ${error.message}`.trim(),
          });
          console.error(`  ❌ ${aluno.cpf} ${aluno.nome}: ${error.message}`);
        }
      }
    }

    const totaisDepois = await contar();
    const relatorio = {
      modo: EXECUTE ? 'EXECUCAO' : 'DRY_RUN',
      fonte: DATA_PATH,
      inicio: inicio.toISOString(),
      fim: new Date().toISOString(),
      totais: {
        alunosArquivo: dados.alunos.length,
        inscricoesArquivo: dados.inscricoes.length,
        alunosPlanejados: planejados.length,
        inscricoesPlanejadas: planejados.reduce((t, a) => t + a.inscricoes.length, 0),
        turmasPlanejadas: turmasPlanejadas.size,
        alunosCriados: alunosCriados.length,
        inscricoesCriadas: inscricoesCriadas.length,
        turmasCriadas: turmasCriadas.length,
        ignorados: ignorados.length,
        erros: erros.length,
        antes: totaisAntes,
        depois: totaisDepois,
      },
      alunosCriados,
      turmasCriadas,
      inscricoesCriadas,
      ignorados,
      erros,
    };

    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    const reportPath = path.join(
      REPORTS_DIR,
      `migracao-alunos-incremental-${EXECUTE ? 'execucao' : 'dryrun'}-${inicio
        .toISOString()
        .replace(/[:.]/g, '-')}.json`,
    );
    fs.writeFileSync(reportPath, JSON.stringify(relatorio, null, 2));

    console.log('\n✨ Finalizado');
    console.log(
      `  Alunos criados: ${alunosCriados.length} | Inscricoes: ${inscricoesCriadas.length} | Turmas: ${turmasCriadas.length} | Ignorados: ${ignorados.length} | Erros: ${erros.length}`,
    );
    console.log(`  Antes:  ${JSON.stringify(totaisAntes)}`);
    console.log(`  Depois: ${JSON.stringify(totaisDepois)}`);
    console.log(`  Relatorio: ${reportPath}`);
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
