import { prisma } from '@/config/prisma';
import { generateTokenPair } from '@/modules/usuarios/utils/auth';
import { Roles, TiposDeUsuarios } from '@prisma/client';
import { limparDocumento } from '@/modules/usuarios/utils';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

/**
 * Helper para autenticação em testes
 * Cria usuários de teste e gera tokens válidos
 */

export interface TestUser {
  id: string;
  email: string;
  password: string;
  nomeCompleto: string;
  role: Roles;
  token: string;
  refreshToken: string;
  cpf: string; // CPF para login
}

/**
 * Gera um CPF válido para testes (apenas formato, não valida algoritmo)
 */
function generateTestCPF(): string {
  // Gera um CPF de 11 dígitos (formato válido para testes)
  const digits = Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join('');
  return digits;
}

/**
 * Cria um usuário de teste no banco de dados
 */
export async function createTestUser(
  overrides: Partial<{
    email: string;
    password: string;
    nomeCompleto: string;
    role: Roles;
    emailVerificado: boolean;
    cpf: string;
  }> = {},
): Promise<TestUser> {
  const email = overrides.email || `test-${randomUUID()}@test.com`;
  const password = overrides.password || 'Test123!@#';
  const nomeCompleto = overrides.nomeCompleto || 'Test User';
  const role = overrides.role || Roles.ALUNO_CANDIDATO;
  const emailVerificado = overrides.emailVerificado !== false;
  const cpf = overrides.cpf || generateTestCPF();
  const cpfLimpo = limparDocumento(cpf);

  const hashedPassword = await bcrypt.hash(password, 10);
  const userId = randomUUID();
  const supabaseId = randomUUID();

  // Criar usuário usando transação para garantir consistência
  const usuario = await prisma.$transaction(async (tx) => {
    const novoUsuario = await tx.usuarios.create({
      data: {
        id: userId,
        email,
        senha: hashedPassword,
        nomeCompleto,
        role,
        codUsuario: `TEST${Date.now()}`,
        supabaseId,
        status: 'ATIVO',
        tipoUsuario: TiposDeUsuarios.PESSOA_FISICA,
        cpf: cpfLimpo,
        atualizadoEm: new Date(),
        UsuariosInformation: {
          create: {
            telefone: '11999999999',
            aceitarTermos: true,
          },
        },
      },
    });

    return novoUsuario;
  });

  // Criar verificação de email se necessário
  if (emailVerificado) {
    await prisma.usuariosVerificacaoEmail.create({
      data: {
        usuarioId: usuario.id,
        emailVerificado: true,
        emailVerificadoEm: new Date(),
      },
    });
  }

  // Gerar tokens
  const tokens = generateTokenPair(usuario.id, usuario.role, { rememberMe: false });

  // Criar sessão no banco (necessário para refresh token funcionar)
  const expiraEm = new Date();
  expiraEm.setDate(expiraEm.getDate() + 30); // 30 dias

  await prisma.usuariosSessoes.create({
    data: {
      id: randomUUID(),
      usuarioId: usuario.id,
      refreshToken: tokens.refreshToken,
      rememberMe: false,
      ip: null,
      userAgent: null,
      expiraEm,
      atualizadoEm: new Date(),
    },
  });

  // Atualizar refresh token no usuário
  await prisma.usuarios.update({
    where: { id: usuario.id },
    data: {
      refreshToken: tokens.refreshToken,
      atualizadoEm: new Date(),
    },
  });

  return {
    id: usuario.id,
    email: usuario.email,
    password,
    nomeCompleto: usuario.nomeCompleto,
    role: usuario.role as Roles,
    token: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    cpf: cpfLimpo,
  };
}

/**
 * Cria um usuário ADMIN de teste
 */
export async function createTestAdmin(): Promise<TestUser> {
  return createTestUser({
    role: Roles.ADMIN,
    email: `admin-${randomUUID()}@test.com`,
    nomeCompleto: 'Admin Test',
  });
}

/**
 * Cria um usuário MODERADOR de teste
 */
export async function createTestModerator(): Promise<TestUser> {
  return createTestUser({
    role: Roles.MODERADOR,
    email: `mod-${randomUUID()}@test.com`,
    nomeCompleto: 'Moderator Test',
  });
}

/**
 * Limpa usuários de teste do banco
 */
export async function cleanupTestUsers(userIds: string[]): Promise<void> {
  // Limpar sessões primeiro (devido à foreign key)
  await prisma.usuariosSessoes.deleteMany({
    where: {
      usuarioId: { in: userIds },
    },
  });

  // Limpar usuários
  await prisma.usuarios.deleteMany({
    where: {
      id: { in: userIds },
    },
  });
}

/**
 * Gera token de acesso para um usuário existente
 */
export function generateAccessToken(userId: string, role: string): string {
  const tokens = generateTokenPair(userId, role);
  return tokens.accessToken;
}
