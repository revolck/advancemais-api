/**
 * Seed de migracao do sistema legado.
 *
 * Cria/atualiza empresas, alunos, cursos historicos, turmas historicas,
 * inscricoes concluidas e certificados emitidos a partir dos arquivos
 * normalizados em prisma/seeds/data.
 */

import 'dotenv/config';
import {
  CursoStatus,
  CursosCertificados,
  CursosCertificadosLogAcao,
  CursosCertificadosTipos,
  CursosMetodos,
  CursosStatusPadrao,
  CursosTurnos,
  CursosTurmaEstruturaTipo,
  Prisma,
  PrismaClient,
  Roles,
  Status,
  StatusInscricao,
  TiposDeUsuarios,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

interface EmpresaMigracaoSeed {
  codigo: string;
  linhaOrigem: number;
  linhasOrigem: number[];
  cnpj: string;
  cnpjValido: boolean;
  razaoSocial: string;
  razoesSociaisOriginais: string[];
  nomeFantasia: string;
  nomesFantasiaOriginais: string[];
  emailsOriginais: string[];
  emailsInvalidosOriginais: string[];
  telefone: string;
  telefones: string[];
  cidade: string;
  cidadesOriginais: string[];
  contato: string;
  contatosOriginais: string[];
  cadastroLegado: string;
  cadastrosLegadoOriginais: string[];
  statusLegado: string;
  statusLegadoOriginais: string[];
  email: string;
  emailGerado: boolean;
}

interface SeedEmpresasResult {
  total: number;
  criadas: number;
  atualizadas: number;
  senhasEmpresasRoleAtualizadas: number;
  erros: number;
  emailsGerados: number;
  emailsAjustadosPorConflito: number;
  cnpjsInvalidos: number;
  linhasDuplicadasConsolidadas: number;
}

interface AlunoCursoCertificadoMigracaoRecord {
  linhaOrigem: number;
  linhaBloco?: number | null;
  cursoNome: string;
  cpf: string;
  cpfOriginal: string;
  nomeAluno: string;
  nomeAlunoCabecalho: string;
  cidade: string;
  estado: string;
  celular: string;
  whatsapp: string;
  whatsappCabecalho: string;
  cadastro: string;
  cadastroCabecalho: string;
  dataInicio: string;
  dataFim: string;
  valorCurso: number | null;
  valorPresencial: number | null;
  cargaHoraria: number | null;
  horario: string;
}

interface AlunosCursosCertificadosMigracaoData {
  metadata: {
    source: string;
    sheet: string;
    generatedAt: string;
    blocks: number;
    headers: number;
    records: number;
  };
  records: AlunoCursoCertificadoMigracaoRecord[];
}

interface RegistroConsolidado extends AlunoCursoCertificadoMigracaoRecord {
  linhasOrigem: number[];
}

interface IssuePreflight {
  code:
    | 'CPF_AUSENTE_OU_INVALIDO'
    | 'DATA_CADASTRO_AUSENTE_OU_INVALIDA'
    | 'PERIODO_AUSENTE_OU_INVALIDO'
    | 'CPF_COM_NOMES_DIVERGENTES';
  message: string;
  linhasOrigem: number[];
  cpf?: string;
  detalhes?: Record<string, unknown>;
}

interface PreflightResult {
  issues: IssuePreflight[];
  registrosConsolidados: RegistroConsolidado[];
  stats: {
    registrosOriginais: number;
    registrosConsolidados: number;
    duplicatasConsolidadas: number;
    alunosUnicos: number;
    cursosUnicos: number;
    turmasHistoricasUnicas: number;
  };
}

interface SeedAlunosCursosCertificadosResult {
  totalRegistros: number;
  alunosCriados: number;
  alunosAtualizados: number;
  cursosCriados: number;
  cursosReutilizados: number;
  turmasCriadas: number;
  turmasAtualizadas: number;
  inscricoesCriadas: number;
  inscricoesAtualizadas: number;
  certificadosCriados: number;
  certificadosAtualizados: number;
  erros: number;
}

interface SeedMigracaoLegadoOptions {
  dryRun?: boolean;
  strict?: boolean;
  skipEmpresas?: boolean;
}

interface SeedMigracaoLegadoResult {
  dryRun: boolean;
  preflight: PreflightResult;
  quarentena?: QuarantinePlan;
  empresas?: SeedEmpresasResult;
  alunosCursosCertificados?: SeedAlunosCursosCertificadosResult;
}

interface QuarantinePlan {
  registrosImportaveis: RegistroConsolidado[];
  registrosQuarentenados: RegistroConsolidado[];
  cpfsQuarentenados: string[];
  linhasQuarentenadas: number[];
}

const datasourceUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
const EMPRESAS_DATA_PATH = path.resolve(__dirname, 'data', 'empresas-migracao.json');
const ALUNOS_CURSOS_CERTIFICADOS_DATA_PATH = path.resolve(
  __dirname,
  'data',
  'alunos-cursos-certificados-migracao.json',
);
const REPORTS_DIR = path.resolve(__dirname, 'reports');
const TELEFONE_NAO_INFORMADO = 'NAO_INFORMADO';
const SENHA_PADRAO_MIGRACAO = 'BemVindo@2026';
const CPF_LENGTH = 11;
const MAX_HASH_ATTEMPTS = 100;
const MIGRACAO_LEGADO_CONCURRENCY = Number(process.env.MIGRACAO_LEGADO_CONCURRENCY || 16);

function loadEmpresas(): EmpresaMigracaoSeed[] {
  return JSON.parse(fs.readFileSync(EMPRESAS_DATA_PATH, 'utf8')) as EmpresaMigracaoSeed[];
}

function loadAlunosCursosCertificados(): AlunosCursosCertificadosMigracaoData {
  return JSON.parse(
    fs.readFileSync(ALUNOS_CURSOS_CERTIFICADOS_DATA_PATH, 'utf8'),
  ) as AlunosCursosCertificadosMigracaoData;
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength - 3).trimEnd() + '...' : value;
}

function buildDescricao(empresa: EmpresaMigracaoSeed): string {
  const parts = [
    'Origem: grid_empresas.xlsx',
    `Linha(s): ${empresa.linhasOrigem.join(', ')}`,
    empresa.nomeFantasia ? `Nome fantasia: ${empresa.nomeFantasia}` : '',
    empresa.contato ? `Contato: ${empresa.contato}` : '',
    empresa.telefones.length > 1 ? `Telefones: ${empresa.telefones.join(', ')}` : '',
    empresa.emailsOriginais.length ? `E-mails origem: ${empresa.emailsOriginais.join(', ')}` : '',
    empresa.emailsInvalidosOriginais.length
      ? `E-mails invalidos no legado: ${empresa.emailsInvalidosOriginais.join(', ')}`
      : '',
    empresa.cadastroLegado ? `Cadastro legado: ${empresa.cadastroLegado}` : '',
    empresa.statusLegado ? `Status legado: ${empresa.statusLegado}` : '',
    empresa.cnpjValido ? '' : 'CNPJ com digito verificador invalido no legado',
    empresa.emailGerado ? 'E-mail sintetico gerado para atender unicidade do cadastro' : '',
  ];

  return truncate(parts.filter(Boolean).join(' | '), 500);
}

function buildFallbackEmail(cnpj: string, tentativa = 1): string {
  const suffix = tentativa === 1 ? '' : `.${tentativa}`;
  return `empresa.migracao.${cnpj}${suffix}@sem-email.local`;
}

async function resolveUniqueEmail(
  client: PrismaClient,
  desiredEmail: string,
  cnpj: string,
  currentUserId?: string,
): Promise<{ email: string; adjusted: boolean }> {
  const desiredOwner = await client.usuarios.findUnique({
    where: { email: desiredEmail },
    select: { id: true },
  });

  if (!desiredOwner || desiredOwner.id === currentUserId) {
    return { email: desiredEmail, adjusted: false };
  }

  for (let tentativa = 1; tentativa <= 100; tentativa += 1) {
    const fallbackEmail = buildFallbackEmail(cnpj, tentativa);
    const fallbackOwner = await client.usuarios.findUnique({
      where: { email: fallbackEmail },
      select: { id: true },
    });

    if (!fallbackOwner || fallbackOwner.id === currentUserId) {
      return { email: fallbackEmail, adjusted: true };
    }
  }

  throw new Error(`Nao foi possivel gerar e-mail unico para o CNPJ ${cnpj}`);
}

async function resolveUniqueCodUsuario(client: PrismaClient, desiredCode: string): Promise<string> {
  const existing = await client.usuarios.findUnique({
    where: { codUsuario: desiredCode },
    select: { id: true },
  });

  if (!existing) {
    return desiredCode;
  }

  for (let tentativa = 1; tentativa <= 100; tentativa += 1) {
    const fallbackCode = `${desiredCode}-${tentativa}`;
    const fallbackOwner = await client.usuarios.findUnique({
      where: { codUsuario: fallbackCode },
      select: { id: true },
    });

    if (!fallbackOwner) {
      return fallbackCode;
    }
  }

  throw new Error(`Nao foi possivel gerar codigo unico para ${desiredCode}`);
}

async function resolveUniqueAuthId(
  client: PrismaClient,
  prefix: 'empresa' | 'aluno',
  documento: string,
  currentUserId?: string,
): Promise<string> {
  const desiredAuthId = `migracao-${prefix}-${documento}`;
  const existing = await client.usuarios.findUnique({
    where: { authId: desiredAuthId },
    select: { id: true },
  });

  if (!existing || existing.id === currentUserId) {
    return desiredAuthId;
  }

  for (let tentativa = 1; tentativa <= MAX_HASH_ATTEMPTS; tentativa += 1) {
    const fallbackAuthId = `${desiredAuthId}-${tentativa}`;
    const fallbackOwner = await client.usuarios.findUnique({
      where: { authId: fallbackAuthId },
      select: { id: true },
    });

    if (!fallbackOwner || fallbackOwner.id === currentUserId) {
      return fallbackAuthId;
    }
  }

  throw new Error(`Nao foi possivel gerar authId unico para ${prefix} ${documento}`);
}

async function findExistingEmpresa(client: PrismaClient, empresa: EmpresaMigracaoSeed) {
  const [byCnpj, byCodigo, byAuthId] = await Promise.all([
    client.usuarios.findUnique({
      where: { cnpj: empresa.cnpj },
      select: { id: true },
    }),
    client.usuarios.findUnique({
      where: { codUsuario: empresa.codigo },
      select: { id: true, cnpj: true, authId: true },
    }),
    client.usuarios.findUnique({
      where: { authId: `migracao-empresa-${empresa.cnpj}` },
      select: { id: true },
    }),
  ]);

  if (byCnpj || byAuthId) {
    return byCnpj || byAuthId;
  }

  if (byCodigo?.cnpj === empresa.cnpj || byCodigo?.authId.startsWith('migracao-empresa-')) {
    return { id: byCodigo.id };
  }

  return null;
}

async function syncInformacoes(
  client: PrismaClient,
  usuarioId: string,
  empresa: EmpresaMigracaoSeed,
) {
  await client.usuariosInformation.upsert({
    where: { usuarioId },
    create: {
      usuarioId,
      telefone: empresa.telefone || TELEFONE_NAO_INFORMADO,
      descricao: buildDescricao(empresa),
      aceitarTermos: false,
    },
    update: {
      telefone: empresa.telefone || TELEFONE_NAO_INFORMADO,
      descricao: buildDescricao(empresa),
    },
  });
}

async function syncEndereco(client: PrismaClient, usuarioId: string, cidade: string) {
  if (!cidade) {
    return;
  }

  const enderecoExistente = await client.usuariosEnderecos.findFirst({
    where: { usuarioId },
    orderBy: { criadoEm: 'asc' },
    select: { id: true },
  });

  if (enderecoExistente) {
    await client.usuariosEnderecos.update({
      where: { id: enderecoExistente.id },
      data: {
        cidade,
        atualizadoEm: new Date(),
      },
    });
    return;
  }

  await client.usuariosEnderecos.create({
    data: {
      id: randomUUID(),
      usuarioId,
      cidade,
    },
  });
}

async function syncVerificacaoEmail(client: PrismaClient, usuarioId: string) {
  const existing = await client.usuariosVerificacaoEmail.findUnique({
    where: { usuarioId },
    select: { usuarioId: true },
  });

  if (existing) {
    return;
  }

  await client.usuariosVerificacaoEmail.create({
    data: {
      usuarioId,
      emailVerificado: false,
      emailVerificationAttempts: 0,
    },
  });
}

const digitsOnly = (value: string | null | undefined) => value?.replace(/\D/g, '') ?? '';

const normalizeSpaces = (value: string | null | undefined) =>
  (value ?? '').replace(/\s+/g, ' ').trim();

export const normalizePersonNameKey = (value: string) =>
  normalizeSpaces(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

export const parseLegacyDateToUtcNoon = (value: string): Date | null => {
  const normalized = normalizeSpaces(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  const [year, month, day] = normalized.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
};

const formatDatePtBr = (value: string) => {
  const date = parseLegacyDateToUtcNoon(value);
  if (!date) return value || 'sem data';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date);
};

const isValidCpf = (cpf: string) => {
  const digits = digitsOnly(cpf);
  if (digits.length !== CPF_LENGTH || /^(\d)\1{10}$/.test(digits)) {
    return false;
  }

  for (const size of [9, 10]) {
    let sum = 0;
    for (let index = 0; index < size; index += 1) {
      sum += Number(digits[index]) * (size + 1 - index);
    }
    let digit = (sum * 10) % 11;
    if (digit === 10) digit = 0;
    if (digit !== Number(digits[size])) {
      return false;
    }
  }

  return true;
};

const stableHash = (parts: (string | number | null | undefined)[], length: number) =>
  createHash('sha256')
    .update(parts.map((part) => String(part ?? '')).join('|'))
    .digest('hex')
    .slice(0, length)
    .toUpperCase();

export const buildCodigoCursoMigracao = (cursoNome: string) => `MIGC${stableHash([cursoNome], 8)}`;

export const buildCodigoTurmaMigracao = (
  record: Pick<RegistroConsolidado, 'cursoNome' | 'dataInicio' | 'dataFim' | 'horario'>,
) => `MIGT${stableHash([record.cursoNome, record.dataInicio, record.dataFim, record.horario], 8)}`;

export const buildCodigoInscricaoMigracao = (cpf: string, turmaCodigo: string) =>
  `MIGI${stableHash([cpf, turmaCodigo], 12)}`;

export const buildCodigoCertificadoMigracao = (inscricaoCodigo: string) =>
  `CERT${stableHash([inscricaoCodigo], 12)}`;

const buildEmailAlunoMigracao = (cpf: string, tentativa = 1) => {
  const suffix = tentativa === 1 ? '' : `.${tentativa}`;
  return `aluno.migracao.${cpf}${suffix}@sem-email.local`;
};

const inferTurno = (horario: string) => {
  const normalized = normalizeSpaces(horario).toUpperCase();
  if (normalized === 'M') return CursosTurnos.MANHA;
  if (normalized === 'T') return CursosTurnos.TARDE;
  if (normalized === 'N') return CursosTurnos.NOITE;
  return CursosTurnos.INTEGRAL;
};

const inferMetodo = (cursoNome: string) => {
  const normalized = cursoNome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (normalized.includes('ONLINE') || normalized.includes('ON-LINE')) {
    return CursosMetodos.ONLINE;
  }

  return CursosMetodos.PRESENCIAL;
};

const toPositiveInt = (value: number | null | undefined, fallback: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.trunc(value);
};

const dateTimeValue = (value: string, fallback: Date) =>
  parseLegacyDateToUtcNoon(value) ?? fallback;

export function consolidateMigrationRecords(
  records: AlunoCursoCertificadoMigracaoRecord[],
): RegistroConsolidado[] {
  const grouped = new Map<string, RegistroConsolidado>();

  for (const record of records) {
    const key = [
      digitsOnly(record.cpf),
      normalizeSpaces(record.cursoNome),
      normalizeSpaces(record.dataInicio),
      normalizeSpaces(record.dataFim),
    ].join('|');
    const existing = grouped.get(key);

    if (existing) {
      existing.linhasOrigem.push(record.linhaOrigem);
      continue;
    }

    grouped.set(key, {
      ...record,
      cpf: digitsOnly(record.cpf),
      cursoNome: normalizeSpaces(record.cursoNome),
      nomeAluno: normalizeSpaces(record.nomeAluno),
      cidade: normalizeSpaces(record.cidade),
      estado: normalizeSpaces(record.estado).toUpperCase(),
      celular: digitsOnly(record.celular),
      whatsapp: normalizeSpaces(record.whatsapp),
      cadastro: normalizeSpaces(record.cadastro),
      dataInicio: normalizeSpaces(record.dataInicio),
      dataFim: normalizeSpaces(record.dataFim),
      horario: normalizeSpaces(record.horario).toUpperCase(),
      linhasOrigem: [record.linhaOrigem],
    });
  }

  return Array.from(grouped.values()).sort((a, b) => a.linhaOrigem - b.linhaOrigem);
}

export function buildMigrationPreflight(
  records: AlunoCursoCertificadoMigracaoRecord[],
): PreflightResult {
  const issues: IssuePreflight[] = [];
  const registrosConsolidados = consolidateMigrationRecords(records);

  for (const record of registrosConsolidados) {
    if (!isValidCpf(record.cpf)) {
      issues.push({
        code: 'CPF_AUSENTE_OU_INVALIDO',
        message: `CPF ausente ou invalido na linha ${record.linhaOrigem}`,
        linhasOrigem: record.linhasOrigem,
        cpf: record.cpf || undefined,
        detalhes: {
          aluno: record.nomeAluno || record.nomeAlunoCabecalho,
          curso: record.cursoNome,
          cpfOriginal: record.cpfOriginal,
        },
      });
    }

    if (!parseLegacyDateToUtcNoon(record.cadastro)) {
      issues.push({
        code: 'DATA_CADASTRO_AUSENTE_OU_INVALIDA',
        message: `Data de cadastro ausente ou invalida na linha ${record.linhaOrigem}`,
        linhasOrigem: record.linhasOrigem,
        cpf: record.cpf || undefined,
        detalhes: { cadastro: record.cadastro },
      });
    }

    const dataInicio = parseLegacyDateToUtcNoon(record.dataInicio);
    const dataFim = parseLegacyDateToUtcNoon(record.dataFim);
    if (!dataInicio || !dataFim || dataFim < dataInicio) {
      issues.push({
        code: 'PERIODO_AUSENTE_OU_INVALIDO',
        message: `Periodo da turma ausente ou invalido na linha ${record.linhaOrigem}`,
        linhasOrigem: record.linhasOrigem,
        cpf: record.cpf || undefined,
        detalhes: {
          dataInicio: record.dataInicio,
          dataFim: record.dataFim,
          aluno: record.nomeAluno,
          curso: record.cursoNome,
        },
      });
    }
  }

  const nomesPorCpf = new Map<string, Map<string, { nome: string; linhas: number[] }>>();
  for (const record of registrosConsolidados) {
    if (!isValidCpf(record.cpf)) continue;
    const nomeKey = normalizePersonNameKey(record.nomeAluno || record.nomeAlunoCabecalho);
    if (!nomeKey) continue;
    const names =
      nomesPorCpf.get(record.cpf) ?? new Map<string, { nome: string; linhas: number[] }>();
    const nameEntry = names.get(nomeKey) ?? {
      nome: record.nomeAluno || record.nomeAlunoCabecalho,
      linhas: [],
    };
    nameEntry.linhas.push(...record.linhasOrigem);
    names.set(nomeKey, nameEntry);
    nomesPorCpf.set(record.cpf, names);
  }

  for (const [cpf, names] of nomesPorCpf.entries()) {
    if (names.size <= 1) continue;
    issues.push({
      code: 'CPF_COM_NOMES_DIVERGENTES',
      message: `CPF ${cpf} possui nomes divergentes no arquivo legado`,
      cpf,
      linhasOrigem: Array.from(names.values()).flatMap((entry) => entry.linhas),
      detalhes: {
        nomes: Array.from(names.values()).map((entry) => entry.nome),
      },
    });
  }

  const alunoCpfs = new Set(
    registrosConsolidados.filter((record) => isValidCpf(record.cpf)).map((record) => record.cpf),
  );
  const cursos = new Set(registrosConsolidados.map((record) => record.cursoNome));
  const turmas = new Set(
    registrosConsolidados.map((record) =>
      [record.cursoNome, record.dataInicio, record.dataFim, record.horario].join('|'),
    ),
  );

  return {
    issues,
    registrosConsolidados,
    stats: {
      registrosOriginais: records.length,
      registrosConsolidados: registrosConsolidados.length,
      duplicatasConsolidadas: records.length - registrosConsolidados.length,
      alunosUnicos: alunoCpfs.size,
      cursosUnicos: cursos.size,
      turmasHistoricasUnicas: turmas.size,
    },
  };
}

const printPreflight = (preflight: PreflightResult) => {
  console.log('🔎 Preflight de alunos, cursos e certificados');
  console.log(`  Registros originais: ${preflight.stats.registrosOriginais}`);
  console.log(`  Registros consolidados: ${preflight.stats.registrosConsolidados}`);
  console.log(`  Duplicatas consolidadas: ${preflight.stats.duplicatasConsolidadas}`);
  console.log(`  Alunos unicos por CPF: ${preflight.stats.alunosUnicos}`);
  console.log(`  Cursos unicos: ${preflight.stats.cursosUnicos}`);
  console.log(`  Turmas historicas unicas: ${preflight.stats.turmasHistoricasUnicas}`);

  if (preflight.issues.length === 0) {
    console.log('  ✅ Nenhum bloqueio encontrado.');
    return;
  }

  console.log(`  ⚠️  Bloqueios encontrados: ${preflight.issues.length}`);
  for (const issue of preflight.issues.slice(0, 30)) {
    console.log(
      `  - ${issue.code}: linhas ${issue.linhasOrigem.join(', ')}${issue.cpf ? ` | CPF ${issue.cpf}` : ''}`,
    );
    if (issue.detalhes) {
      console.log(`    Detalhes: ${JSON.stringify(issue.detalhes)}`);
    }
  }
  if (preflight.issues.length > 30) {
    console.log(`  ... ${preflight.issues.length - 30} bloqueios adicionais omitidos no log.`);
  }
};

const createPreflightError = (issues: IssuePreflight[]) => {
  const error = new Error(
    `Seed de migracao bloqueado por ${issues.length} pendencia(s) de qualidade nos dados.`,
  );
  (error as any).code = 'MIGRACAO_PREFLIGHT_BLOQUEADO';
  (error as any).issues = issues;
  return error;
};

export function buildQuarantinePlan(
  preflight: PreflightResult,
  extraIssues: IssuePreflight[] = [],
): QuarantinePlan {
  const issues = [...preflight.issues, ...extraIssues];
  const linhasQuarentenadas = new Set<number>();
  const cpfsQuarentenados = new Set<string>();

  for (const issue of issues) {
    for (const linha of issue.linhasOrigem) {
      linhasQuarentenadas.add(linha);
    }

    if (issue.code === 'CPF_COM_NOMES_DIVERGENTES' && issue.cpf) {
      cpfsQuarentenados.add(issue.cpf);
    }
  }

  const registrosImportaveis: RegistroConsolidado[] = [];
  const registrosQuarentenados: RegistroConsolidado[] = [];

  for (const record of preflight.registrosConsolidados) {
    const hasLinhaQuarentenada = record.linhasOrigem.some((linha) =>
      linhasQuarentenadas.has(linha),
    );
    const hasCpfQuarentenado = cpfsQuarentenados.has(record.cpf);

    if (hasLinhaQuarentenada || hasCpfQuarentenado) {
      registrosQuarentenados.push(record);
    } else {
      registrosImportaveis.push(record);
    }
  }

  return {
    registrosImportaveis,
    registrosQuarentenados,
    cpfsQuarentenados: Array.from(cpfsQuarentenados).sort(),
    linhasQuarentenadas: Array.from(linhasQuarentenadas).sort((a, b) => a - b),
  };
}

function writeQuarantineReport(
  preflight: PreflightResult,
  quarentena: QuarantinePlan,
  extraIssues: IssuePreflight[] = [],
) {
  const issues = [...preflight.issues, ...extraIssues];
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(REPORTS_DIR, `migracao-legado-quarentena-${timestamp}.json`);
  const payload = {
    generatedAt: new Date().toISOString(),
    summary: {
      issues: issues.length,
      registrosOriginais: preflight.stats.registrosOriginais,
      registrosConsolidados: preflight.stats.registrosConsolidados,
      registrosImportaveis: quarentena.registrosImportaveis.length,
      registrosQuarentenados: quarentena.registrosQuarentenados.length,
      linhasQuarentenadas: quarentena.linhasQuarentenadas.length,
      cpfsQuarentenados: quarentena.cpfsQuarentenados.length,
    },
    issues,
    registrosQuarentenados: quarentena.registrosQuarentenados,
  };

  fs.writeFileSync(reportPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return reportPath;
}

const chunk = <T>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
  onProgress?: (completed: number) => void,
) {
  let nextIndex = 0;
  let completed = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;

        if (index >= items.length) {
          break;
        }

        await worker(items[index], index);
        completed += 1;
        onProgress?.(completed);
      }
    }),
  );
}

const buildAlunoMigrationMetadata = (records: RegistroConsolidado[]) => {
  const byCpf = new Map<string, RegistroConsolidado[]>();
  for (const record of records) {
    byCpf.set(record.cpf, [...(byCpf.get(record.cpf) ?? []), record]);
  }

  return new Map(
    Array.from(byCpf.entries()).map(([cpf, alunoRecords]) => {
      const sorted = [...alunoRecords].sort((a, b) => {
        const dateA = parseLegacyDateToUtcNoon(a.cadastro)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const dateB = parseLegacyDateToUtcNoon(b.cadastro)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return dateA - dateB || a.linhaOrigem - b.linhaOrigem;
      });
      const preferred = sorted[0];
      const telefone =
        sorted.find((record) => record.celular)?.celular ||
        digitsOnly(sorted.find((record) => record.whatsapp)?.whatsapp) ||
        TELEFONE_NAO_INFORMADO;

      return [
        cpf,
        {
          nome: preferred.nomeAluno || preferred.nomeAlunoCabecalho,
          telefone,
          cidade: sorted.find((record) => record.cidade)?.cidade ?? '',
          estado: sorted.find((record) => record.estado)?.estado ?? '',
          criadoEm: dateTimeValue(preferred.cadastro, new Date()),
          linhasOrigem: sorted.flatMap((record) => record.linhasOrigem),
        },
      ];
    }),
  );
};

const buildCursoMigrationMetadata = (records: RegistroConsolidado[]) => {
  const byCurso = new Map<string, RegistroConsolidado[]>();
  for (const record of records) {
    byCurso.set(record.cursoNome, [...(byCurso.get(record.cursoNome) ?? []), record]);
  }

  return new Map(
    Array.from(byCurso.entries()).map(([cursoNome, cursoRecords]) => {
      const cargaHoraria = Math.max(
        ...cursoRecords.map((record) => toPositiveInt(record.cargaHoraria, 0)),
        1,
      );
      const earliestCadastro = [...cursoRecords].sort((a, b) => {
        const dateA = parseLegacyDateToUtcNoon(a.cadastro)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const dateB = parseLegacyDateToUtcNoon(b.cadastro)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return dateA - dateB || a.linhaOrigem - b.linhaOrigem;
      })[0]?.cadastro;

      return [
        cursoNome,
        {
          cargaHoraria,
          criadoEm: earliestCadastro ? dateTimeValue(earliestCadastro, new Date()) : new Date(),
          valor: Math.max(...cursoRecords.map((record) => Number(record.valorCurso ?? 0)), 0),
        },
      ];
    }),
  );
};

async function findDatabaseConflicts(
  client: PrismaClient,
  records: RegistroConsolidado[],
): Promise<IssuePreflight[]> {
  const cpfs = Array.from(new Set(records.map((record) => record.cpf).filter(Boolean)));
  const conflicts: IssuePreflight[] = [];

  for (const cpfChunk of chunk(cpfs, 1000)) {
    const existingUsers = await client.usuarios.findMany({
      where: {
        cpf: { in: cpfChunk },
        role: { not: Roles.ALUNO_CANDIDATO },
      },
      select: { cpf: true, nomeCompleto: true, role: true },
    });

    for (const user of existingUsers) {
      conflicts.push({
        code: 'CPF_COM_NOMES_DIVERGENTES',
        message: `CPF ${user.cpf} ja pertence a um usuario com role ${user.role}`,
        cpf: user.cpf ?? undefined,
        linhasOrigem: records
          .filter((record) => record.cpf === user.cpf)
          .flatMap((record) => record.linhasOrigem),
        detalhes: { nomeBanco: user.nomeCompleto, roleBanco: user.role },
      });
    }
  }

  return conflicts;
}

async function resolveUniqueAlunoEmail(
  client: PrismaClient,
  cpf: string,
  currentUserId?: string,
): Promise<{ email: string; adjusted: boolean }> {
  for (let tentativa = 1; tentativa <= MAX_HASH_ATTEMPTS; tentativa += 1) {
    const email = buildEmailAlunoMigracao(cpf, tentativa);
    const owner = await client.usuarios.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!owner || owner.id === currentUserId) {
      return { email, adjusted: tentativa > 1 };
    }
  }

  throw new Error(`Nao foi possivel gerar e-mail unico para o CPF ${cpf}`);
}

async function findOrCreateAluno(
  client: PrismaClient,
  cpf: string,
  metadata: ReturnType<typeof buildAlunoMigrationMetadata> extends Map<string, infer T> ? T : never,
  senhaPadraoHash: string,
) {
  const existing = await client.usuarios.findUnique({
    where: { cpf },
    select: { id: true, role: true },
  });
  const codUsuario = existing ? undefined : await resolveUniqueCodUsuario(client, `ALU${cpf}`);

  if (existing) {
    if (existing.role !== Roles.ALUNO_CANDIDATO) {
      throw new Error(`CPF ${cpf} pertence a usuario com role ${existing.role}`);
    }

    await client.usuarios.update({
      where: { id: existing.id },
      data: {
        nomeCompleto: metadata.nome,
        senha: senhaPadraoHash,
        tipoUsuario: TiposDeUsuarios.PESSOA_FISICA,
        role: Roles.ALUNO_CANDIDATO,
        status: Status.ATIVO,
        criadoEm: metadata.criadoEm,
        atualizadoEm: new Date(),
      },
    });

    await syncAlunoInformacoes(client, existing.id, metadata);
    await syncAlunoEndereco(client, existing.id, metadata);
    await syncVerificacaoEmail(client, existing.id);
    return { id: existing.id, created: false };
  }

  const resolvedEmail = await resolveUniqueAlunoEmail(client, cpf);
  const authId = await resolveUniqueAuthId(client, 'aluno', cpf);

  const created = await client.usuarios.create({
    data: {
      id: randomUUID(),
      authId,
      nomeCompleto: metadata.nome,
      email: resolvedEmail.email,
      senha: senhaPadraoHash,
      codUsuario: codUsuario as string,
      tipoUsuario: TiposDeUsuarios.PESSOA_FISICA,
      role: Roles.ALUNO_CANDIDATO,
      status: Status.ATIVO,
      cpf,
      criadoEm: metadata.criadoEm,
      atualizadoEm: new Date(),
    },
    select: { id: true },
  });

  await syncAlunoInformacoes(client, created.id, metadata);
  await syncAlunoEndereco(client, created.id, metadata);
  await syncVerificacaoEmail(client, created.id);
  return { id: created.id, created: true };
}

async function syncAlunoInformacoes(
  client: PrismaClient,
  usuarioId: string,
  metadata: ReturnType<typeof buildAlunoMigrationMetadata> extends Map<string, infer T> ? T : never,
) {
  await client.usuariosInformation.upsert({
    where: { usuarioId },
    create: {
      usuarioId,
      telefone: metadata.telefone || TELEFONE_NAO_INFORMADO,
      inscricao: `MIG${usuarioId.slice(0, 8).toUpperCase()}`,
      descricao: truncate(
        `Origem: grid_w_alunoCursos.xlsx | Linha(s): ${metadata.linhasOrigem.join(', ')}`,
        500,
      ),
      aceitarTermos: false,
    },
    update: {
      telefone: metadata.telefone || TELEFONE_NAO_INFORMADO,
      descricao: truncate(
        `Origem: grid_w_alunoCursos.xlsx | Linha(s): ${metadata.linhasOrigem.join(', ')}`,
        500,
      ),
    },
  });
}

async function syncAlunoEndereco(
  client: PrismaClient,
  usuarioId: string,
  metadata: ReturnType<typeof buildAlunoMigrationMetadata> extends Map<string, infer T> ? T : never,
) {
  if (!metadata.cidade && !metadata.estado) {
    return;
  }

  const enderecoExistente = await client.usuariosEnderecos.findFirst({
    where: { usuarioId },
    orderBy: { criadoEm: 'asc' },
    select: { id: true },
  });

  const data = {
    cidade: metadata.cidade || null,
    estado: metadata.estado || null,
    atualizadoEm: new Date(),
  };

  if (enderecoExistente) {
    await client.usuariosEnderecos.update({
      where: { id: enderecoExistente.id },
      data,
    });
    return;
  }

  await client.usuariosEnderecos.create({
    data: {
      id: randomUUID(),
      usuarioId,
      cidade: metadata.cidade || null,
      estado: metadata.estado || null,
    },
  });
}

async function ensureCodigoCursoDisponivel(
  client: PrismaClient,
  codigo: string,
  cursoNome: string,
) {
  const existing = await client.cursos.findUnique({
    where: { codigo },
    select: { id: true, nome: true },
  });

  if (existing && existing.nome !== cursoNome) {
    throw new Error(`Codigo de curso migrado ${codigo} ja pertence ao curso ${existing.nome}`);
  }
}

async function findOrCreateCurso(
  client: PrismaClient,
  cursoNome: string,
  metadata: ReturnType<typeof buildCursoMigrationMetadata> extends Map<string, infer T> ? T : never,
) {
  const existingByName = await client.cursos.findFirst({
    where: { nome: cursoNome, deletedAt: null },
    select: { id: true },
    orderBy: { criadoEm: 'asc' },
  });

  if (existingByName) {
    return { id: existingByName.id, created: false };
  }

  const codigo = buildCodigoCursoMigracao(cursoNome);
  await ensureCodigoCursoDisponivel(client, codigo, cursoNome);

  const created = await client.cursos.create({
    data: {
      id: randomUUID(),
      codigo,
      nome: cursoNome,
      descricao: truncate(`Curso historico importado de grid_w_alunoCursos.xlsx`, 255),
      cargaHoraria: metadata.cargaHoraria,
      statusPadrao: CursosStatusPadrao.RASCUNHO,
      estagioObrigatorio: false,
      valor: new Prisma.Decimal(metadata.valor),
      gratuito: metadata.valor <= 0,
      criadoEm: metadata.criadoEm,
      atualizadoEm: new Date(),
    },
    select: { id: true },
  });

  return { id: created.id, created: true };
}

async function findOrCreateTurmaHistorica(
  client: PrismaClient,
  cursoId: string,
  record: RegistroConsolidado,
) {
  const codigo = buildCodigoTurmaMigracao(record);
  const existing = await client.cursosTurmas.findUnique({
    where: { codigo },
    select: { id: true, cursoId: true },
  });
  const dataInicio = dateTimeValue(record.dataInicio, new Date());
  const dataFim = dateTimeValue(record.dataFim, dataInicio);
  const nome = truncate(
    `Turma legado - ${formatDatePtBr(record.dataInicio)} a ${formatDatePtBr(record.dataFim)}`,
    255,
  );

  if (existing) {
    if (existing.cursoId !== cursoId) {
      throw new Error(`Turma migrada ${codigo} pertence a outro curso`);
    }

    await client.cursosTurmas.update({
      where: { id: existing.id },
      data: {
        nome,
        dataInicio,
        dataFim,
        turno: inferTurno(record.horario),
        metodo: inferMetodo(record.cursoNome),
        status: CursoStatus.CONCLUIDO,
        atualizadoEm: new Date(),
      },
    });

    return { id: existing.id, codigo, created: false };
  }

  const created = await client.cursosTurmas.create({
    data: {
      id: randomUUID(),
      codigo,
      cursoId,
      estruturaTipo: CursosTurmaEstruturaTipo.PADRAO,
      nome,
      turno: inferTurno(record.horario),
      metodo: inferMetodo(record.cursoNome),
      dataInicio,
      dataFim,
      dataInscricaoInicio: dateTimeValue(record.cadastro, dataInicio),
      dataInscricaoFim: dataInicio,
      vagasIlimitadas: true,
      vagasTotais: 0,
      vagasDisponiveis: 0,
      status: CursoStatus.CONCLUIDO,
      criadoEm: dateTimeValue(record.cadastro, new Date()),
      atualizadoEm: new Date(),
    },
    select: { id: true },
  });

  return { id: created.id, codigo, created: true };
}

async function upsertInscricaoHistorica(
  client: PrismaClient,
  turmaId: string,
  alunoId: string,
  record: RegistroConsolidado,
  turmaCodigo: string,
) {
  const codigo = buildCodigoInscricaoMigracao(record.cpf, turmaCodigo);
  const existingCodigo = await client.cursosTurmasInscricoes.findUnique({
    where: { codigo },
    select: { id: true, turmaId: true, alunoId: true },
  });

  if (
    existingCodigo &&
    (existingCodigo.turmaId !== turmaId || existingCodigo.alunoId !== alunoId)
  ) {
    throw new Error(`Codigo de inscricao migrada ${codigo} ja pertence a outro vinculo`);
  }

  const existing = await client.cursosTurmasInscricoes.findUnique({
    where: { turmaId_alunoId: { turmaId, alunoId } },
    select: { id: true },
  });
  const criadoEm = dateTimeValue(record.cadastro, new Date());
  const valorPago =
    typeof record.valorCurso === 'number' && Number.isFinite(record.valorCurso)
      ? new Prisma.Decimal(record.valorCurso)
      : null;

  if (existing) {
    await client.cursosTurmasInscricoes.update({
      where: { id: existing.id },
      data: {
        codigo,
        criadoEm,
        status: StatusInscricao.CONCLUIDO,
        statusPagamento: 'CONCLUIDO',
        valorPago,
        valorOriginal: valorPago,
        valorFinal: valorPago,
      },
    });
    return { id: existing.id, codigo, created: false };
  }

  const created = await client.cursosTurmasInscricoes.create({
    data: {
      id: randomUUID(),
      turmaId,
      alunoId,
      codigo,
      criadoEm,
      status: StatusInscricao.CONCLUIDO,
      statusPagamento: 'CONCLUIDO',
      valorPago,
      valorOriginal: valorPago,
      valorFinal: valorPago,
      aceitouTermos: false,
    },
    select: { id: true },
  });

  return { id: created.id, codigo, created: true };
}

async function upsertCertificadoHistorico(
  client: PrismaClient,
  inscricaoId: string,
  inscricaoCodigo: string,
  record: RegistroConsolidado,
  alunoNome: string,
) {
  const codigo = buildCodigoCertificadoMigracao(inscricaoCodigo);
  const existing = await client.cursosCertificadosEmitidos.findUnique({
    where: { codigo },
    select: { id: true, inscricaoId: true },
  });
  const emitidoEm = dateTimeValue(record.dataFim, new Date());
  const certificadoData = {
    tipo: CursosCertificados.CONCLUSAO,
    formato: CursosCertificadosTipos.DIGITAL,
    cargaHoraria: toPositiveInt(record.cargaHoraria, 1),
    alunoNome,
    alunoCpf: record.cpf,
    cursoNome: record.cursoNome,
    turmaNome: `Turma legado - ${formatDatePtBr(record.dataInicio)} a ${formatDatePtBr(record.dataFim)}`,
    emitidoEm,
    observacoes: truncate(
      `Certificado historico importado de grid_w_alunoCursos.xlsx | Linha(s): ${record.linhasOrigem.join(', ')}`,
      500,
    ),
  };

  if (existing) {
    if (existing.inscricaoId !== inscricaoId) {
      throw new Error(`Certificado migrado ${codigo} pertence a outra inscricao`);
    }

    await client.cursosCertificadosEmitidos.update({
      where: { id: existing.id },
      data: certificadoData,
    });
    await syncCertificadoLogMigracao(client, existing.id, emitidoEm);
    return { id: existing.id, created: false };
  }

  const created = await client.cursosCertificadosEmitidos.create({
    data: {
      id: randomUUID(),
      codigo,
      inscricaoId,
      ...certificadoData,
      CursosCertificadosLogs: {
        create: {
          acao: CursosCertificadosLogAcao.EMISSAO,
          formato: CursosCertificadosTipos.DIGITAL,
          detalhes: 'Certificado historico criado via seed de migracao legado',
          criadoEm: emitidoEm,
        },
      },
    },
    select: { id: true },
  });

  return { id: created.id, created: true };
}

async function syncCertificadoLogMigracao(
  client: PrismaClient,
  certificadoId: string,
  criadoEm: Date,
) {
  const existing = await client.cursosCertificadosLogs.findFirst({
    where: {
      certificadoId,
      acao: CursosCertificadosLogAcao.EMISSAO,
      detalhes: 'Certificado historico criado via seed de migracao legado',
    },
    select: { id: true },
  });

  if (existing) {
    await client.cursosCertificadosLogs.update({
      where: { id: existing.id },
      data: {
        formato: CursosCertificadosTipos.DIGITAL,
        criadoEm,
      },
    });
    return;
  }

  await client.cursosCertificadosLogs.create({
    data: {
      id: randomUUID(),
      certificadoId,
      acao: CursosCertificadosLogAcao.EMISSAO,
      formato: CursosCertificadosTipos.DIGITAL,
      detalhes: 'Certificado historico criado via seed de migracao legado',
      criadoEm,
    },
  });
}

async function seedEmpresasMigracao(
  prisma?: PrismaClient,
  senhaPadraoHash?: string,
): Promise<SeedEmpresasResult> {
  const client = prisma || new PrismaClient({ datasourceUrl });
  const shouldDisconnect = !prisma;
  const empresas = loadEmpresas();
  const senhaHash = senhaPadraoHash ?? (await bcrypt.hash(SENHA_PADRAO_MIGRACAO, 12));
  const duplicatedSourceRows = empresas.reduce(
    (total, empresa) => total + Math.max(empresa.linhasOrigem.length - 1, 0),
    0,
  );
  const result: SeedEmpresasResult = {
    total: empresas.length,
    criadas: 0,
    atualizadas: 0,
    senhasEmpresasRoleAtualizadas: 0,
    erros: 0,
    emailsGerados: empresas.filter((empresa) => empresa.emailGerado).length,
    emailsAjustadosPorConflito: 0,
    cnpjsInvalidos: empresas.filter((empresa) => !empresa.cnpjValido).length,
    linhasDuplicadasConsolidadas: duplicatedSourceRows,
  };

  console.log('🌱 Iniciando seed de empresas migradas...');
  console.log(`  📄 Fonte: ${EMPRESAS_DATA_PATH}`);
  console.log(`  🏢 Empresas deduplicadas por CNPJ: ${empresas.length}`);
  console.log(`  🧹 Linhas duplicadas consolidadas: ${duplicatedSourceRows}`);

  try {
    for (const [index, empresa] of empresas.entries()) {
      try {
        const existing = await findExistingEmpresa(client, empresa);
        const resolvedEmail = await resolveUniqueEmail(
          client,
          empresa.email,
          empresa.cnpj,
          existing?.id,
        );

        if (resolvedEmail.adjusted) {
          result.emailsAjustadosPorConflito += 1;
        }

        if (existing) {
          await client.usuarios.update({
            where: { id: existing.id },
            data: {
              nomeCompleto: empresa.razaoSocial,
              email: resolvedEmail.email,
              senha: senhaHash,
              cnpj: empresa.cnpj,
              tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
              role: Roles.EMPRESA,
              status: Status.ATIVO,
              atualizadoEm: new Date(),
            },
          });

          await syncInformacoes(client, existing.id, empresa);
          await syncEndereco(client, existing.id, empresa.cidade);
          await syncVerificacaoEmail(client, existing.id);
          result.atualizadas += 1;
        } else {
          const [codUsuario, authId] = await Promise.all([
            resolveUniqueCodUsuario(client, empresa.codigo),
            resolveUniqueAuthId(client, 'empresa', empresa.cnpj),
          ]);

          const created = await client.usuarios.create({
            data: {
              id: randomUUID(),
              authId,
              nomeCompleto: empresa.razaoSocial,
              email: resolvedEmail.email,
              senha: senhaHash,
              codUsuario,
              tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
              role: Roles.EMPRESA,
              status: Status.ATIVO,
              cnpj: empresa.cnpj,
              atualizadoEm: new Date(),
            },
            select: { id: true },
          });

          await syncInformacoes(client, created.id, empresa);
          await syncEndereco(client, created.id, empresa.cidade);
          await syncVerificacaoEmail(client, created.id);
          result.criadas += 1;
        }

        if ((index + 1) % 250 === 0 || index + 1 === empresas.length) {
          console.log(`  Progresso: ${index + 1}/${empresas.length}`);
        }
      } catch (error: any) {
        result.erros += 1;
        console.error(
          `  ❌ Erro ao processar ${empresa.codigo} (${empresa.cnpj} - ${empresa.razaoSocial}): ${error.message}`,
        );
      }
    }

    const empresasSenhaAtualizadas = await client.usuarios.updateMany({
      where: { role: Roles.EMPRESA },
      data: {
        senha: senhaHash,
        atualizadoEm: new Date(),
      },
    });
    result.senhasEmpresasRoleAtualizadas = empresasSenhaAtualizadas.count;

    console.log('\n✨ Seed de empresas migradas finalizado!');
    console.log(`  Criadas: ${result.criadas}`);
    console.log(`  Atualizadas: ${result.atualizadas}`);
    console.log(`  Senhas atualizadas para role=EMPRESA: ${result.senhasEmpresasRoleAtualizadas}`);
    console.log(`  Erros: ${result.erros}`);
    console.log(`  E-mails sinteticos no arquivo: ${result.emailsGerados}`);
    console.log(`  E-mails ajustados por conflito no banco: ${result.emailsAjustadosPorConflito}`);
    console.log(`  CNPJs com DV invalido no legado: ${result.cnpjsInvalidos}`);

    return result;
  } finally {
    if (shouldDisconnect) {
      await client.$disconnect();
    }
  }
}

async function seedAlunosCursosCertificadosMigracao(
  client: PrismaClient,
  registrosConsolidados: RegistroConsolidado[],
  senhaPadraoHash: string,
): Promise<SeedAlunosCursosCertificadosResult> {
  const result: SeedAlunosCursosCertificadosResult = {
    totalRegistros: registrosConsolidados.length,
    alunosCriados: 0,
    alunosAtualizados: 0,
    cursosCriados: 0,
    cursosReutilizados: 0,
    turmasCriadas: 0,
    turmasAtualizadas: 0,
    inscricoesCriadas: 0,
    inscricoesAtualizadas: 0,
    certificadosCriados: 0,
    certificadosAtualizados: 0,
    erros: 0,
  };

  const alunoMetadata = buildAlunoMigrationMetadata(registrosConsolidados);
  const cursoMetadata = buildCursoMigrationMetadata(registrosConsolidados);
  const alunosCache = new Map<string, { id: string; nome: string }>();
  const cursosCache = new Map<string, string>();
  const turmasCache = new Map<string, { id: string; codigo: string }>();

  console.log('\n🌱 Iniciando seed de alunos, cursos, turmas e certificados...');
  console.log(`  📄 Fonte: ${ALUNOS_CURSOS_CERTIFICADOS_DATA_PATH}`);
  console.log(`  👤 Alunos unicos: ${alunoMetadata.size}`);
  console.log(`  📚 Cursos unicos: ${cursoMetadata.size}`);
  console.log(`  🧾 Registros consolidados: ${registrosConsolidados.length}`);
  console.log(`  ⚙️ Concorrencia controlada: ${MIGRACAO_LEGADO_CONCURRENCY}`);

  const logProgress = (label: string, total: number) => (completed: number) => {
    if (completed % 250 === 0 || completed === total) {
      console.log(`  Progresso ${label}: ${completed}/${total}`);
    }
  };

  const alunoEntries = Array.from(alunoMetadata.entries());
  await runWithConcurrency(
    alunoEntries,
    MIGRACAO_LEGADO_CONCURRENCY,
    async ([cpf, metadata]) => {
      try {
        const alunoResult = await findOrCreateAluno(client, cpf, metadata, senhaPadraoHash);
        if (alunoResult.created) {
          result.alunosCriados += 1;
        } else {
          result.alunosAtualizados += 1;
        }
        alunosCache.set(cpf, { id: alunoResult.id, nome: metadata.nome });
      } catch (error: any) {
        result.erros += 1;
        console.error(`  ❌ Erro ao processar aluno ${cpf}: ${error.message}`);
      }
    },
    logProgress('alunos', alunoEntries.length),
  );

  const cursoEntries = Array.from(cursoMetadata.entries());
  await runWithConcurrency(
    cursoEntries,
    Math.min(MIGRACAO_LEGADO_CONCURRENCY, 8),
    async ([cursoNome, metadata]) => {
      try {
        const curso = await findOrCreateCurso(client, cursoNome, metadata);
        if (curso.created) {
          result.cursosCriados += 1;
        } else {
          result.cursosReutilizados += 1;
        }
        cursosCache.set(cursoNome, curso.id);
      } catch (error: any) {
        result.erros += 1;
        console.error(`  ❌ Erro ao processar curso ${cursoNome}: ${error.message}`);
      }
    },
    logProgress('cursos', cursoEntries.length),
  );

  const turmaRecords = Array.from(
    new Map(
      registrosConsolidados.map((record) => [buildCodigoTurmaMigracao(record), record]),
    ).values(),
  );
  await runWithConcurrency(
    turmaRecords,
    Math.min(MIGRACAO_LEGADO_CONCURRENCY, 8),
    async (record) => {
      try {
        const cursoId = cursosCache.get(record.cursoNome);
        if (!cursoId) {
          throw new Error(`Curso ${record.cursoNome} nao foi importado`);
        }
        const turmaKey = buildCodigoTurmaMigracao(record);
        const turmaResult = await findOrCreateTurmaHistorica(client, cursoId, record);
        if (turmaResult.created) {
          result.turmasCriadas += 1;
        } else {
          result.turmasAtualizadas += 1;
        }
        turmasCache.set(turmaKey, { id: turmaResult.id, codigo: turmaResult.codigo });
      } catch (error: any) {
        result.erros += 1;
        console.error(
          `  ❌ Erro ao processar turma ${buildCodigoTurmaMigracao(record)} (${record.cursoNome}): ${error.message}`,
        );
      }
    },
    logProgress('turmas', turmaRecords.length),
  );

  await runWithConcurrency(
    registrosConsolidados,
    MIGRACAO_LEGADO_CONCURRENCY,
    async (record) => {
      try {
        const aluno = alunosCache.get(record.cpf);
        if (!aluno) {
          throw new Error(`Aluno ${record.cpf} nao foi importado`);
        }

        const turma = turmasCache.get(buildCodigoTurmaMigracao(record));
        if (!turma) {
          throw new Error(`Turma ${buildCodigoTurmaMigracao(record)} nao foi importada`);
        }

        const inscricao = await upsertInscricaoHistorica(
          client,
          turma.id,
          aluno.id,
          record,
          turma.codigo,
        );
        if (inscricao.created) {
          result.inscricoesCriadas += 1;
        } else {
          result.inscricoesAtualizadas += 1;
        }

        const certificado = await upsertCertificadoHistorico(
          client,
          inscricao.id,
          inscricao.codigo,
          record,
          aluno.nome,
        );
        if (certificado.created) {
          result.certificadosCriados += 1;
        } else {
          result.certificadosAtualizados += 1;
        }
      } catch (error: any) {
        result.erros += 1;
        console.error(
          `  ❌ Erro ao processar linha(s) ${record.linhasOrigem.join(', ')} (${record.cpf} - ${record.nomeAluno}): ${error.message}`,
        );
      }
    },
    logProgress('inscricoes/certificados', registrosConsolidados.length),
  );

  console.log('\n✨ Seed de alunos, cursos e certificados finalizado!');
  console.log(`  Alunos criados: ${result.alunosCriados}`);
  console.log(`  Alunos atualizados: ${result.alunosAtualizados}`);
  console.log(`  Cursos criados: ${result.cursosCriados}`);
  console.log(`  Cursos reutilizados: ${result.cursosReutilizados}`);
  console.log(`  Turmas criadas: ${result.turmasCriadas}`);
  console.log(`  Turmas atualizadas: ${result.turmasAtualizadas}`);
  console.log(`  Inscricoes criadas: ${result.inscricoesCriadas}`);
  console.log(`  Inscricoes atualizadas: ${result.inscricoesAtualizadas}`);
  console.log(`  Certificados criados: ${result.certificadosCriados}`);
  console.log(`  Certificados atualizados: ${result.certificadosAtualizados}`);
  console.log(`  Erros: ${result.erros}`);

  return result;
}

export async function seedMigracaoLegado(
  prisma?: PrismaClient,
  options: SeedMigracaoLegadoOptions = {},
): Promise<SeedMigracaoLegadoResult> {
  const alunosCursosCertificados = loadAlunosCursosCertificados();
  const preflight = buildMigrationPreflight(alunosCursosCertificados.records);
  const quarentena = buildQuarantinePlan(preflight);

  printPreflight(preflight);

  if (preflight.issues.length > 0) {
    console.log(
      `  🧺 Quarentena: ${quarentena.registrosQuarentenados.length} registro(s) ficarao fora da importacao agora.`,
    );
    console.log(
      `  ✅ Importaveis: ${quarentena.registrosImportaveis.length} registro(s) consolidado(s).`,
    );
  }

  if (options.dryRun) {
    console.log('\n🧪 Dry-run habilitado: nenhuma escrita sera executada.');
    return { dryRun: true, preflight, quarentena };
  }

  if (options.strict && preflight.issues.length > 0) {
    throw createPreflightError(preflight.issues);
  }

  const client = prisma || new PrismaClient({ datasourceUrl });
  const shouldDisconnect = !prisma;

  try {
    const databaseIssues = await findDatabaseConflicts(client, quarentena.registrosImportaveis);
    const quarentenaFinal =
      databaseIssues.length > 0 ? buildQuarantinePlan(preflight, databaseIssues) : quarentena;
    const totalIssues = preflight.issues.length + databaseIssues.length;

    if (databaseIssues.length > 0) {
      console.log(
        `  🧺 Conflitos no banco: ${databaseIssues.length} CPF(s) ja pertencem a usuarios administrativos e ficarao em quarentena.`,
      );
      console.log(
        `  ✅ Importaveis apos banco: ${quarentenaFinal.registrosImportaveis.length} registro(s) consolidado(s).`,
      );
    }

    if (options.strict && totalIssues > 0) {
      throw createPreflightError([...preflight.issues, ...databaseIssues]);
    }

    const reportPath =
      totalIssues > 0 ? writeQuarantineReport(preflight, quarentenaFinal, databaseIssues) : null;
    if (reportPath) {
      console.log(`  🧾 Relatorio de quarentena gerado em: ${reportPath}`);
    }

    const senhaPadraoHash = await bcrypt.hash(SENHA_PADRAO_MIGRACAO, 12);
    const empresas = options.skipEmpresas
      ? undefined
      : await seedEmpresasMigracao(client, senhaPadraoHash);
    if (options.skipEmpresas) {
      console.log('  ⏭️  Etapa de empresas ignorada por --skip-empresas.');
    }
    const alunosCursosCertificadosResult = await seedAlunosCursosCertificadosMigracao(
      client,
      quarentenaFinal.registrosImportaveis,
      senhaPadraoHash,
    );

    return {
      dryRun: false,
      preflight,
      quarentena: quarentenaFinal,
      empresas,
      alunosCursosCertificados: alunosCursosCertificadosResult,
    };
  } finally {
    if (shouldDisconnect) {
      await client.$disconnect();
    }
  }
}

export const seedEmpresas = seedEmpresasMigracao;

const cliOptions = (): SeedMigracaoLegadoOptions => ({
  dryRun: process.argv.includes('--dry-run'),
  strict: process.argv.includes('--strict'),
  skipEmpresas: process.argv.includes('--skip-empresas'),
});

if (require.main === module) {
  seedMigracaoLegado(undefined, cliOptions()).catch((error) => {
    console.error('❌ Erro no seed de migracao legado:', error);
    process.exit(1);
  });
}
