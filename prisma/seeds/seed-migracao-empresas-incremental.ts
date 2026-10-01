/**
 * Seed de migracao INCREMENTAL de empresas do sistema legado.
 *
 * Fonte: migracao/grid_empresas - 29-04 a 25-09.xlsx, normalizada em
 * prisma/seeds/data/empresas-migracao-incremental-2026-09.json.
 *
 * Regras (banco de producao):
 * - Somente INSERT. Nenhum registro existente e atualizado ou removido.
 * - Empresa cujo CNPJ ja existe na base e ignorada (sem migracao dupla).
 * - Conflito de e-mail, authId ou codUsuario tambem ignora o registro.
 * - Cada empresa e criada em transacao propria (Usuarios + Information +
 *   Enderecos + VerificacaoEmail), seguindo o padrao da migracao de maio.
 *
 * Uso:
 *   ts-node prisma/seeds/seed-migracao-empresas-incremental.ts            (dry-run)
 *   ts-node prisma/seeds/seed-migracao-empresas-incremental.ts --execute  (grava)
 *   ts-node prisma/seeds/seed-migracao-empresas-incremental.ts --execute --limit=1  (grava so N)
 */

import 'dotenv/config';
import { Prisma, PrismaClient, Roles, Status, TiposDeUsuarios } from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

interface EnderecoMigracao {
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
}

interface EmpresaIncrementalSeed {
  codigo: string;
  linhaOrigem: number;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  email: string;
  emailGerado: boolean;
  telefone: string;
  endereco: EnderecoMigracao | null;
  descricao: string;
}

type MotivoIgnorado =
  | 'CNPJ_INVALIDO'
  | 'CNPJ_JA_EXISTE'
  | 'EMAIL_JA_EXISTE'
  | 'AUTH_ID_JA_EXISTE'
  | 'COD_USUARIO_JA_EXISTE'
  | 'DUPLICADO_NO_ARQUIVO';

interface RegistroIgnorado {
  linhaOrigem: number;
  cnpj: string;
  razaoSocial: string;
  motivo: MotivoIgnorado;
  existenteId?: string;
}

interface RegistroCriado {
  linhaOrigem: number;
  cnpj: string;
  razaoSocial: string;
  usuarioId: string;
  codUsuario: string;
  email: string;
}

const datasourceUrl =
  process.env.MIGRACAO_DATABASE_URL || process.env.DATABASE_URL || process.env.DIRECT_URL || '';
const DATA_PATH = path.resolve(__dirname, 'data', 'empresas-migracao-incremental-2026-09.json');
const REPORTS_DIR = path.resolve(__dirname, 'reports');
const SENHA_PADRAO_MIGRACAO = 'BemVindo@2026';
const EXECUTE = process.argv.includes('--execute');
const LIMIT = Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 0);

const digitsOnly = (value: string | null | undefined) => value?.replace(/\D/g, '') ?? '';

function isCnpjValido(cnpj: string): boolean {
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (base: string, pesos: number[]) => {
    const soma = pesos.reduce((acc, peso, i) => acc + Number(base[i]) * peso, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, ...pesos1];
  return calc(cnpj, pesos1) === Number(cnpj[12]) && calc(cnpj, pesos2) === Number(cnpj[13]);
}

function loadEmpresas(): EmpresaIncrementalSeed[] {
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')) as EmpresaIncrementalSeed[];
}

async function findConflito(
  client: PrismaClient | Prisma.TransactionClient,
  empresa: EmpresaIncrementalSeed,
): Promise<{ motivo: MotivoIgnorado; existenteId: string } | null> {
  const authId = `migracao-empresa-${empresa.cnpj}`;
  const [porCnpj] = await client.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Usuarios"
    WHERE regexp_replace(coalesce(cnpj, ''), '\\D', '', 'g') = ${empresa.cnpj}
       OR regexp_replace(coalesce(cpf, ''), '\\D', '', 'g') = ${empresa.cnpj}
    LIMIT 1`;
  if (porCnpj) return { motivo: 'CNPJ_JA_EXISTE', existenteId: porCnpj.id };

  const [porEmail] = await client.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Usuarios" WHERE lower(email) = lower(${empresa.email}) LIMIT 1`;
  if (porEmail) return { motivo: 'EMAIL_JA_EXISTE', existenteId: porEmail.id };

  const porAuthId = await client.usuarios.findUnique({ where: { authId }, select: { id: true } });
  if (porAuthId) return { motivo: 'AUTH_ID_JA_EXISTE', existenteId: porAuthId.id };

  const porCodigo = await client.usuarios.findUnique({
    where: { codUsuario: empresa.codigo },
    select: { id: true },
  });
  if (porCodigo) return { motivo: 'COD_USUARIO_JA_EXISTE', existenteId: porCodigo.id };

  return null;
}

async function main() {
  const client = new PrismaClient({ datasourceUrl });
  const empresas = loadEmpresas();
  const inicio = new Date();
  const ignorados: RegistroIgnorado[] = [];
  const criados: RegistroCriado[] = [];
  const erros: { linhaOrigem: number; cnpj: string; erro: string }[] = [];
  const planejados: EmpresaIncrementalSeed[] = [];

  console.log(`🌱 Migracao incremental de empresas (${EXECUTE ? 'EXECUCAO' : 'DRY-RUN'})`);
  console.log(`  📄 Fonte: ${DATA_PATH}`);
  console.log(`  🏢 Registros no arquivo: ${empresas.length}`);

  try {
    const totalEmpresasAntes = await client.usuarios.count({ where: { role: Roles.EMPRESA } });
    const totalUsuariosAntes = await client.usuarios.count();

    // Preflight somente leitura
    const vistos = new Set<string>();
    for (const empresa of empresas) {
      const cnpj = digitsOnly(empresa.cnpj);
      const base = { linhaOrigem: empresa.linhaOrigem, cnpj, razaoSocial: empresa.razaoSocial };
      if (!isCnpjValido(cnpj)) {
        ignorados.push({ ...base, motivo: 'CNPJ_INVALIDO' });
        continue;
      }
      if (vistos.has(cnpj)) {
        ignorados.push({ ...base, motivo: 'DUPLICADO_NO_ARQUIVO' });
        continue;
      }
      vistos.add(cnpj);
      const conflito = await findConflito(client, { ...empresa, cnpj });
      if (conflito) {
        ignorados.push({ ...base, ...conflito });
        continue;
      }
      planejados.push({ ...empresa, cnpj });
    }

    console.log(`  ✅ A criar: ${planejados.length}`);
    console.log(`  ⏭️  Ignorados: ${ignorados.length}`);
    for (const item of ignorados) {
      console.log(
        `     - linha ${item.linhaOrigem} ${item.cnpj} ${item.razaoSocial}: ${item.motivo}`,
      );
    }

    if (EXECUTE && planejados.length > 0) {
      const senhaHash = await bcrypt.hash(SENHA_PADRAO_MIGRACAO, 12);
      const lote = LIMIT > 0 ? planejados.slice(0, LIMIT) : planejados;
      console.log(`  🚚 Lote desta execucao: ${lote.length}`);

      for (const empresa of lote) {
        try {
          const criado = await client.$transaction(
            async (tx) => {
              // Rechecagem dentro da transacao: nunca sobrescreve registro existente
              const conflito = await findConflito(tx, empresa);
              if (conflito) {
                ignorados.push({
                  linhaOrigem: empresa.linhaOrigem,
                  cnpj: empresa.cnpj,
                  razaoSocial: empresa.razaoSocial,
                  ...conflito,
                });
                return null;
              }

              const agora = new Date();
              return tx.usuarios.create({
                data: {
                  id: randomUUID(),
                  authId: `migracao-empresa-${empresa.cnpj}`,
                  nomeCompleto: empresa.razaoSocial,
                  email: empresa.email.toLowerCase(),
                  senha: senhaHash,
                  codUsuario: empresa.codigo,
                  tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
                  role: Roles.EMPRESA,
                  status: Status.ATIVO,
                  cnpj: empresa.cnpj,
                  atualizadoEm: agora,
                  UsuariosInformation: {
                    create: {
                      telefone: empresa.telefone,
                      descricao: empresa.descricao.slice(0, 500),
                      aceitarTermos: false,
                    },
                  },
                  ...(empresa.endereco
                    ? {
                        UsuariosEnderecos: {
                          create: { id: randomUUID(), ...empresa.endereco },
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
                select: { id: true, codUsuario: true, email: true },
              });
            },
            { timeout: 30000, maxWait: 20000 },
          );

          if (criado) {
            criados.push({
              linhaOrigem: empresa.linhaOrigem,
              cnpj: empresa.cnpj,
              razaoSocial: empresa.razaoSocial,
              usuarioId: criado.id,
              codUsuario: criado.codUsuario,
              email: criado.email,
            });
            console.log(`  ➕ ${criado.codUsuario} ${empresa.cnpj} ${empresa.razaoSocial}`);
          }
        } catch (error: any) {
          const codigo = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : '';
          erros.push({
            linhaOrigem: empresa.linhaOrigem,
            cnpj: empresa.cnpj,
            erro: `${codigo} ${error.message}`.trim(),
          });
          console.error(`  ❌ linha ${empresa.linhaOrigem} ${empresa.cnpj}: ${error.message}`);
        }
      }
    }

    const totalEmpresasDepois = await client.usuarios.count({ where: { role: Roles.EMPRESA } });
    const totalUsuariosDepois = await client.usuarios.count();
    const verificados = criados.length
      ? await client.usuarios.count({
          where: {
            id: { in: criados.map((c) => c.usuarioId) },
            UsuariosInformation: { isNot: null },
            UsuariosVerificacaoEmail: { is: { emailVerificado: true } },
          },
        })
      : 0;

    const relatorio = {
      modo: EXECUTE ? 'EXECUCAO' : 'DRY_RUN',
      fonte: DATA_PATH,
      inicio: inicio.toISOString(),
      fim: new Date().toISOString(),
      totais: {
        registrosArquivo: empresas.length,
        planejados: planejados.length,
        criados: criados.length,
        ignorados: ignorados.length,
        erros: erros.length,
        criadosVerificadosPosExecucao: verificados,
        empresasAntes: totalEmpresasAntes,
        empresasDepois: totalEmpresasDepois,
        usuariosAntes: totalUsuariosAntes,
        usuariosDepois: totalUsuariosDepois,
      },
      criados,
      ignorados,
      erros,
      planejados: EXECUTE
        ? undefined
        : planejados.map((p) => ({
            codigo: p.codigo,
            linhaOrigem: p.linhaOrigem,
            cnpj: p.cnpj,
            razaoSocial: p.razaoSocial,
            email: p.email,
          })),
    };

    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    const reportPath = path.join(
      REPORTS_DIR,
      `migracao-empresas-incremental-${EXECUTE ? 'execucao' : 'dryrun'}-${inicio
        .toISOString()
        .replace(/[:.]/g, '-')}.json`,
    );
    fs.writeFileSync(reportPath, JSON.stringify(relatorio, null, 2));

    console.log('\n✨ Finalizado');
    console.log(
      `  Criados: ${criados.length} | Ignorados: ${ignorados.length} | Erros: ${erros.length}`,
    );
    console.log(`  Empresas: ${totalEmpresasAntes} -> ${totalEmpresasDepois}`);
    console.log(`  Usuarios: ${totalUsuariosAntes} -> ${totalUsuariosDepois}`);
    console.log(`  Relatorio: ${reportPath}`);
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
