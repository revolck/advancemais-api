import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { assertTestSeedEnvironment } from './assert-test-seed';

const prisma = new PrismaClient();

/**
 * Seed para criar status customizados padrão do sistema
 */
async function seedStatusProcessoCustomizado() {
  assertTestSeedEnvironment('seed-status-processo-customizado');

  console.log('🌱 Iniciando seed de status customizados...');

  try {
    // Buscar um usuário admin para ser o criador dos status
    const adminUser = await prisma.usuarios.findFirst({
      where: {
        role: 'ADMIN',
      },
    });

    if (!adminUser) {
      console.log('❌ Nenhum usuário admin encontrado. Pulando seed de status customizados.');
      return;
    }

    console.log(`👤 Usando usuário admin: ${adminUser.nomeCompleto} (${adminUser.email})`);

    // Status padrão para cada categoria
    // Nota: Campos customizados (codigo, cor, icone, ordem, categoria) não existem no modelo statusProcessosCandidatos
    // Apenas usando campos disponíveis: nome, descricao, ativo, isDefault, criadoPor
    const statusPadrao = [
      // PENDENTE
      {
        nome: 'Pendente',
        descricao: 'Candidato acabou de se candidatar',
        ativo: true,
        isDefault: true,
        criadoPor: adminUser.id,
      },

      // EM_ANALISE
      {
        nome: 'Em Análise',
        descricao: 'Candidato em análise, participando das etapas',
        ativo: true,
        isDefault: false,
        criadoPor: adminUser.id,
      },
      {
        nome: 'Entrevista Inicial',
        descricao: 'Candidato em processo de entrevista inicial',
        ativo: true,
        isDefault: false,
        criadoPor: adminUser.id,
      },
      {
        nome: 'Entrevista Técnica',
        descricao: 'Candidato em processo de entrevista técnica',
        ativo: true,
        isDefault: false,
        criadoPor: adminUser.id,
      },
      {
        nome: 'Teste Prático',
        descricao: 'Candidato realizando teste prático',
        ativo: true,
        isDefault: false,
        criadoPor: adminUser.id,
      },
      {
        nome: 'Apresentação',
        descricao: 'Candidato em processo de apresentação',
        ativo: true,
        isDefault: false,
        criadoPor: adminUser.id,
      },

      // FINALIZADO
      {
        nome: 'Aprovado',
        descricao: 'Candidato aprovado para vaga',
        ativo: true,
        isDefault: false,
        criadoPor: adminUser.id,
      },
      {
        nome: 'Pré-aprovado',
        descricao: 'Candidatos finalistas após análises internas',
        ativo: true,
        isDefault: false,
        criadoPor: adminUser.id,
      },
      {
        nome: 'Reprovado',
        descricao: 'Candidato reprovado após entrevista final',
        ativo: true,
        isDefault: false,
        criadoPor: adminUser.id,
      },
      {
        nome: 'Fora do Perfil',
        descricao: 'Perfil analisado, fora do perfil da vaga',
        ativo: true,
        isDefault: false,
        criadoPor: adminUser.id,
      },

      // CANCELADO
      {
        nome: 'Desistente',
        descricao: 'Candidato desistiu do processo',
        ativo: true,
        isDefault: false,
        criadoPor: adminUser.id,
      },
      {
        nome: 'Não Compareceu',
        descricao: 'Candidato não compareceu à entrevista',
        ativo: true,
        isDefault: false,
        criadoPor: adminUser.id,
      },
      {
        nome: 'Cancelado pela Empresa',
        descricao: 'Processo cancelado pela empresa',
        ativo: true,
        isDefault: false,
        criadoPor: adminUser.id,
      },
    ];

    // Verificar se já existem status (usando o modelo statusProcessosCandidatos)
    const existingStatus = await prisma.statusProcessosCandidatos.count();

    if (existingStatus > 0) {
      console.log(`⚠️  Já existem ${existingStatus} status. Pulando seed.`);
      return;
    }

    // Criar status customizados
    console.log('📝 Criando status...');

    for (const status of statusPadrao) {
      try {
        await prisma.statusProcessosCandidatos.create({
          data: {
            id: randomUUID(),
            ...status,
            atualizadoEm: new Date(),
          },
        });
        console.log(`✅ Status criado: ${status.nome}`);
      } catch (error: any) {
        console.error(`❌ Erro ao criar status ${status.nome}:`, error.message);
      }
    }

    console.log('🎉 Seed de status concluído com sucesso!');

    // Mostrar resumo
    const totalStatus = await prisma.statusProcessosCandidatos.count();
    console.log(`📊 Total de status criados: ${totalStatus}`);
  } catch (error) {
    console.error('❌ Erro durante o seed de status customizados:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar seed se chamado diretamente
if (require.main === module) {
  seedStatusProcessoCustomizado()
    .then(() => {
      console.log('✅ Seed concluído');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro no seed:', error);
      process.exit(1);
    });
}

export { seedStatusProcessoCustomizado };
