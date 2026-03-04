/**
 * Seed de Usuários - Cria usuários de teste para todas as roles
 */

import { PrismaClient, Status, TiposDeUsuarios, Roles } from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

interface UsuarioSeed {
  nomeCompleto: string;
  email: string;
  senha: string;
  role: keyof typeof Roles;
  tipoUsuario: TiposDeUsuarios;
  cpf?: string;
  cnpj?: string;
  telefone: string;
  genero?: string;
  dataNasc?: Date;
  descricao?: string;
  cidade?: string;
  estado?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cep?: string;
}

const usuarios: UsuarioSeed[] = [
  // ADMIN
  {
    nomeCompleto: 'Filipe Admin',
    email: 'filipe@advancemais.com.br',
    senha: 'Fili25061995*',
    role: Roles.ADMIN,
    tipoUsuario: TiposDeUsuarios.PESSOA_FISICA,
    cpf: '08705420440',
    telefone: '11999990001',
    descricao: 'Administrador do sistema',
    cidade: 'São Paulo',
    estado: 'SP',
  },
  // ADMIN TESTE
  {
    nomeCompleto: 'Admin Teste Sistema',
    email: 'admin.teste@advancemais.com.br',
    senha: 'AdminTeste@123',
    role: Roles.ADMIN,
    tipoUsuario: TiposDeUsuarios.PESSOA_FISICA,
    cpf: '11111111111',
    telefone: '11999990000',
    descricao: 'Administrador para testes do sistema',
    cidade: 'São Paulo',
    estado: 'SP',
  },

  // MODERADOR
  {
    nomeCompleto: 'Moderador Sistema',
    email: 'moderador@advancemais.com.br',
    senha: 'Moderador@123',
    role: Roles.MODERADOR,
    tipoUsuario: TiposDeUsuarios.PESSOA_FISICA,
    cpf: '22222222222',
    telefone: '11999990002',
    descricao: 'Moderador da plataforma',
    cidade: 'São Paulo',
    estado: 'SP',
  },

  // SETOR_DE_VAGAS
  {
    nomeCompleto: 'Ana Setor de Vagas',
    email: 'setor.vagas@advancemais.com.br',
    senha: 'SetorVagas@123',
    role: Roles.SETOR_DE_VAGAS,
    tipoUsuario: TiposDeUsuarios.PESSOA_FISICA,
    cpf: '33333333333',
    telefone: '11999990003',
    genero: 'FEMININO',
    descricao: 'Especialista do setor de vagas',
    cidade: 'São Paulo',
    estado: 'SP',
  },

  // RECRUTADOR
  {
    nomeCompleto: 'Carlos Recrutador',
    email: 'recrutador@advancemais.com.br',
    senha: 'Recrutador@123',
    role: Roles.RECRUTADOR,
    tipoUsuario: TiposDeUsuarios.PESSOA_FISICA,
    cpf: '44444444444',
    telefone: '11999990004',
    genero: 'MASCULINO',
    descricao: 'Recrutador especializado em seleção',
    cidade: 'São Paulo',
    estado: 'SP',
  },

  // INSTRUTOR
  {
    nomeCompleto: 'Instrutor Maria Silva',
    email: 'instrutor@advancemais.com.br',
    senha: 'Instrutor@123',
    role: Roles.INSTRUTOR,
    tipoUsuario: TiposDeUsuarios.PESSOA_FISICA,
    cpf: '55555555555',
    telefone: '11999990005',
    genero: 'FEMININO',
    descricao: 'Instrutora de Desenvolvimento Web',
    cidade: 'São Paulo',
    estado: 'SP',
  },

  // PEDAGOGICO
  {
    nomeCompleto: 'Pedagogo João',
    email: 'pedagogico@advancemais.com.br',
    senha: 'Pedagogico@123',
    role: Roles.PEDAGOGICO,
    tipoUsuario: TiposDeUsuarios.PESSOA_FISICA,
    cpf: '66666666666',
    telefone: '11999990006',
    genero: 'MASCULINO',
    descricao: 'Pedagogo responsável pela coordenação',
    cidade: 'São Paulo',
    estado: 'SP',
  },

  // FINANCEIRO
  {
    nomeCompleto: 'Gerente Financeiro',
    email: 'financeiro@advancemais.com.br',
    senha: 'Financeiro@123',
    role: Roles.FINANCEIRO,
    tipoUsuario: TiposDeUsuarios.PESSOA_FISICA,
    cpf: '77777777777',
    telefone: '11999990007',
    descricao: 'Gerente financeiro',
    cidade: 'São Paulo',
    estado: 'SP',
  },

  // EMPRESAS
  {
    nomeCompleto: 'Tech Innovations LTDA',
    email: 'empresa1@example.com',
    senha: 'Empresa@123',
    role: Roles.EMPRESA,
    tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
    cnpj: '12345678000190',
    telefone: '11987654321',
    descricao: 'Empresa de tecnologia e inovação',
    cidade: 'São Paulo',
    estado: 'SP',
    logradouro: 'Avenida Paulista',
    numero: '1000',
    bairro: 'Bela Vista',
    cep: '01310-100',
  },
  {
    nomeCompleto: 'Consultoria RH Plus',
    email: 'empresa2@example.com',
    senha: 'Empresa@123',
    role: Roles.EMPRESA,
    tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
    cnpj: '98765432000110',
    telefone: '11987654322',
    descricao: 'Consultoria em recursos humanos',
    cidade: 'Rio de Janeiro',
    estado: 'RJ',
    logradouro: 'Rua Manoel Pedro de Oliveira',
    numero: '245',
    bairro: 'Benedito Bentes',
    cep: '57084-028',
  },

  // ALUNOS/CANDIDATOS
  {
    nomeCompleto: 'João da Silva',
    email: 'joao.silva@example.com',
    senha: 'Candidato@123',
    role: Roles.ALUNO_CANDIDATO,
    tipoUsuario: TiposDeUsuarios.PESSOA_FISICA,
    cpf: '12312312312',
    telefone: '11988881111',
    genero: 'MASCULINO',
    dataNasc: new Date('1995-05-15'),
    descricao: 'Desenvolvedor Full Stack em busca de novas oportunidades',
    cidade: 'São Paulo',
    estado: 'SP',
  },
  {
    nomeCompleto: 'Maria Santos',
    email: 'maria.santos@example.com',
    senha: 'Candidato@123',
    role: Roles.ALUNO_CANDIDATO,
    tipoUsuario: TiposDeUsuarios.PESSOA_FISICA,
    cpf: '32132132132',
    telefone: '11988882222',
    genero: 'FEMININO',
    dataNasc: new Date('1998-08-20'),
    descricao: 'Designer UX/UI com experiência em produtos digitais',
    cidade: 'São Paulo',
    estado: 'SP',
  },
  {
    nomeCompleto: 'Pedro Oliveira',
    email: 'pedro.oliveira@example.com',
    senha: 'Candidato@123',
    role: Roles.ALUNO_CANDIDATO,
    tipoUsuario: TiposDeUsuarios.PESSOA_FISICA,
    cpf: '45645645645',
    telefone: '11988883333',
    genero: 'MASCULINO',
    dataNasc: new Date('1997-03-10'),
    descricao: 'Analista de dados especializado em BI',
    cidade: 'Campinas',
    estado: 'SP',
  },
  {
    nomeCompleto: 'Ana Costa',
    email: 'ana.costa@example.com',
    senha: 'Candidato@123',
    role: Roles.ALUNO_CANDIDATO,
    tipoUsuario: TiposDeUsuarios.PESSOA_FISICA,
    cpf: '78978978978',
    telefone: '11988884444',
    genero: 'FEMININO',
    dataNasc: new Date('1999-11-25'),
    descricao: 'Gerente de projetos certificada PMP',
    cidade: 'São Paulo',
    estado: 'SP',
  },
  {
    nomeCompleto: 'Lucas Ferreira',
    email: 'lucas.ferreira@example.com',
    senha: 'Candidato@123',
    role: Roles.ALUNO_CANDIDATO,
    tipoUsuario: TiposDeUsuarios.PESSOA_FISICA,
    cpf: '15915915915',
    telefone: '11988885555',
    genero: 'MASCULINO',
    dataNasc: new Date('1996-07-30'),
    descricao: 'DevOps Engineer com foco em AWS e Kubernetes',
    cidade: 'São Paulo',
    estado: 'SP',
  },
];

export async function seedUsuarios(prisma?: PrismaClient) {
  const client = prisma || new PrismaClient();
  console.log('🌱 Iniciando seed de usuários...');

  const usuariosCriados: any[] = [];

  const syncUsuarioEndereco = async (usuarioId: string, usuario: UsuarioSeed) => {
    const hasEndereco =
      Boolean(usuario.cidade) ||
      Boolean(usuario.estado) ||
      Boolean(usuario.cep) ||
      Boolean(usuario.logradouro) ||
      Boolean(usuario.numero) ||
      Boolean(usuario.bairro);

    if (!hasEndereco) {
      return;
    }

    const enderecoExistente = await client.usuariosEnderecos.findFirst({
      where: { usuarioId },
      orderBy: { criadoEm: 'asc' },
      select: { id: true },
    });

    const enderecoData = {
      cidade: usuario.cidade ?? null,
      estado: usuario.estado ?? null,
      cep: usuario.cep ?? null,
      logradouro: usuario.logradouro ?? null,
      numero: usuario.numero ?? null,
      bairro: usuario.bairro ?? null,
      atualizadoEm: new Date(),
    };

    if (enderecoExistente) {
      await client.usuariosEnderecos.update({
        where: { id: enderecoExistente.id },
        data: enderecoData,
      });
      return;
    }

    await client.usuariosEnderecos.create({
      data: {
        id: randomUUID(),
        usuarioId,
        ...enderecoData,
      },
    });
  };

  for (const usuario of usuarios) {
    try {
      console.log(`  📝 Criando usuário: ${usuario.email}`);

      // Verificar se já existe no banco
      const existingDbUser = await client.usuarios.findUnique({
        where: { email: usuario.email },
      });

      if (existingDbUser) {
        await syncUsuarioEndereco(existingDbUser.id, usuario);
        console.log(`  ✅ Usuário já existe no banco: ${usuario.email}`);
        usuariosCriados.push(existingDbUser);
        continue;
      }

      // Criar usuário no banco de dados
      let codUsuario: string;

      if (usuario.role === 'ALUNO_CANDIDATO') {
        // Para alunos, gerar código único e sequencial (MAT0001, MAT0002, etc.)
        // Buscar o último código
        const ultimoCodigo = await client.usuarios.findFirst({
          where: {
            codUsuario: {
              startsWith: 'MAT',
            },
          },
          orderBy: {
            codUsuario: 'desc',
          },
          select: {
            codUsuario: true,
          },
        });

        let numeroCodigo = 1;
        if (ultimoCodigo) {
          // Extrair o número do código (ex: MAT0001 -> 1)
          const match = ultimoCodigo.codUsuario.match(/MAT(\d+)/);
          if (match) {
            numeroCodigo = parseInt(match[1], 10) + 1;
          }
        }

        // Gerar código com 4 dígitos (ex: MAT0001, MAT0002)
        codUsuario = `MAT${numeroCodigo.toString().padStart(4, '0')}`;
      } else {
        // Para outros tipos de usuário, usar código curto
        const shortCode = Math.floor(10000 + Math.random() * 90000);
        codUsuario = `${usuario.role.substring(0, 3).toUpperCase()}-${shortCode}`;
      }

      const authId = `seed-${usuario.role.toLowerCase()}-${Date.now()}`;

      // Hash da senha usando bcrypt
      const senhaHash = await bcrypt.hash(usuario.senha, 10);

      const userId = randomUUID();

      const dbUser = await client.usuarios.create({
        data: {
          id: userId,
          authId,
          nomeCompleto: usuario.nomeCompleto,
          email: usuario.email,
          senha: senhaHash,
          codUsuario,
          tipoUsuario: usuario.tipoUsuario,
          role: usuario.role,
          status: Status.ATIVO,
          cpf: usuario.cpf,
          cnpj: usuario.cnpj,
          UsuariosInformation: {
            create: {
              telefone: usuario.telefone,
              genero: usuario.genero,
              dataNasc: usuario.dataNasc,
              descricao: usuario.descricao,
              aceitarTermos: true,
            },
          },
          atualizadoEm: new Date(),
        },
      });

      await syncUsuarioEndereco(dbUser.id, usuario);

      // Criar registro de verificação de email como VERIFICADO
      await client.usuariosVerificacaoEmail.create({
        data: {
          usuarioId: dbUser.id,
          emailVerificado: true,
          emailVerificadoEm: new Date(),
          emailVerificationAttempts: 0,
        },
      });

      usuariosCriados.push(dbUser);
      console.log(`  ✅ Usuário criado: ${usuario.email} (Email verificado)`);
    } catch (error: any) {
      console.error(`  ❌ Erro ao criar usuário ${usuario.email}:`, error.message);
    }
  }

  console.log(`\n✨ ${usuariosCriados.length} usuários criados/verificados com sucesso!\n`);

  return usuariosCriados;
}

// Se executado diretamente
if (require.main === module) {
  const prisma = new PrismaClient();
  seedUsuarios(prisma)
    .then(() => {
      console.log('✅ Seed de usuários concluído');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro no seed de usuários:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
