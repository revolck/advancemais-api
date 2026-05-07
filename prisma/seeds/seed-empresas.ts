/**
 * Seed de empresas migradas do sistema legado.
 *
 * Este seed cria/atualiza somente cadastros de empresas em Usuarios.
 * Nao cria vagas, candidaturas, certificados ou vinculos.
 */

import { PrismaClient, Roles, Status, TiposDeUsuarios } from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
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
  erros: number;
  emailsGerados: number;
  emailsAjustadosPorConflito: number;
  cnpjsInvalidos: number;
  linhasDuplicadasConsolidadas: number;
}

const datasourceUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
const DATA_PATH = path.resolve(__dirname, 'data', 'empresas-migracao.json');
const TELEFONE_NAO_INFORMADO = 'NAO_INFORMADO';
const SENHA_PADRAO_EMPRESAS = 'BemVIndo@2026';

function loadEmpresas(): EmpresaMigracaoSeed[] {
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')) as EmpresaMigracaoSeed[];
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

async function resolveUniqueAuthId(client: PrismaClient, cnpj: string): Promise<string> {
  const desiredAuthId = `migracao-empresa-${cnpj}`;
  const existing = await client.usuarios.findUnique({
    where: { authId: desiredAuthId },
    select: { id: true },
  });

  if (!existing) {
    return desiredAuthId;
  }

  for (let tentativa = 1; tentativa <= 100; tentativa += 1) {
    const fallbackAuthId = `${desiredAuthId}-${tentativa}`;
    const fallbackOwner = await client.usuarios.findUnique({
      where: { authId: fallbackAuthId },
      select: { id: true },
    });

    if (!fallbackOwner) {
      return fallbackAuthId;
    }
  }

  throw new Error(`Nao foi possivel gerar authId unico para o CNPJ ${cnpj}`);
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

export async function seedEmpresas(prisma?: PrismaClient): Promise<SeedEmpresasResult> {
  const client = prisma || new PrismaClient({ datasourceUrl });
  const shouldDisconnect = !prisma;
  const empresas = loadEmpresas();
  const senhaPadraoHash = await bcrypt.hash(SENHA_PADRAO_EMPRESAS, 10);
  const duplicatedSourceRows = empresas.reduce(
    (total, empresa) => total + Math.max(empresa.linhasOrigem.length - 1, 0),
    0,
  );
  const result: SeedEmpresasResult = {
    total: empresas.length,
    criadas: 0,
    atualizadas: 0,
    erros: 0,
    emailsGerados: empresas.filter((empresa) => empresa.emailGerado).length,
    emailsAjustadosPorConflito: 0,
    cnpjsInvalidos: empresas.filter((empresa) => !empresa.cnpjValido).length,
    linhasDuplicadasConsolidadas: duplicatedSourceRows,
  };

  console.log('🌱 Iniciando seed de empresas migradas...');
  console.log(`  📄 Fonte: ${DATA_PATH}`);
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
              senha: senhaPadraoHash,
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
            resolveUniqueAuthId(client, empresa.cnpj),
          ]);

          const created = await client.usuarios.create({
            data: {
              id: randomUUID(),
              authId,
              nomeCompleto: empresa.razaoSocial,
              email: resolvedEmail.email,
              senha: senhaPadraoHash,
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

    console.log('\n✨ Seed de empresas migradas finalizado!');
    console.log(`  Criadas: ${result.criadas}`);
    console.log(`  Atualizadas: ${result.atualizadas}`);
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

if (require.main === module) {
  seedEmpresas().catch((error) => {
    console.error('❌ Erro no seed de empresas migradas:', error);
    process.exit(1);
  });
}
