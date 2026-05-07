import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { assertTestSeedEnvironment } from './assert-test-seed';

export async function seedStatusProcesso(prisma?: PrismaClient) {
  assertTestSeedEnvironment('seed-status-processo');

  const client = prisma || new PrismaClient();
  console.log('🌱 Iniciando seed de Status Processo...');

  // Verificar se já existem status
  const existingStatus = await client.statusProcessosCandidatos.findFirst();
  if (existingStatus) {
    console.log('✅ Status Processo já existem, pulando seed...');
    return;
  }

  // Status padrão do sistema
  const statusPadrao = [
    {
      nome: 'Pendente',
      descricao: 'Candidato acabou de se candidatar',
      ativo: true,
      isDefault: true, // Este será o status padrão
    },
    {
      nome: 'Em Análise',
      descricao: 'Candidato em processo de análise',
      ativo: true,
      isDefault: false,
    },
    {
      nome: 'Entrevista Inicial',
      descricao: 'Candidato em processo de entrevista inicial',
      ativo: true,
      isDefault: false,
    },
    {
      nome: 'Entrevista Técnica',
      descricao: 'Candidato em processo de entrevista técnica',
      ativo: true,
      isDefault: false,
    },
    {
      nome: 'Teste Prático',
      descricao: 'Candidato realizando teste prático',
      ativo: true,
      isDefault: false,
    },
    {
      nome: 'Aprovado',
      descricao: 'Candidato aprovado para vaga',
      ativo: true,
      isDefault: false,
    },
    {
      nome: 'Reprovado',
      descricao: 'Candidato reprovado após entrevista final',
      ativo: true,
      isDefault: false,
    },
    {
      nome: 'Desistente',
      descricao: 'Candidato desistiu do processo',
      ativo: true,
      isDefault: false,
    },
  ];

  // Buscar um usuário admin para ser o criador
  const adminUser = await client.usuarios.findFirst({
    where: { role: 'ADMIN' },
  });

  if (!adminUser) {
    throw new Error('Nenhum usuário admin encontrado para criar os status padrão.');
  }

  // Criar os status
  for (const status of statusPadrao) {
    await client.statusProcessosCandidatos.create({
      data: {
        id: randomUUID(),
        ...status,
        criadoPor: adminUser.id,
        atualizadoEm: new Date(),
      },
    });
  }

  console.log(`✅ ${statusPadrao.length} status de processo criados com sucesso!`);
  console.log('📋 Status criados:');
  statusPadrao.forEach((status) => {
    console.log(`   - ${status.nome}${status.isDefault ? ' (PADRÃO)' : ''}`);
  });
}

// Executar se chamado diretamente
if (require.main === module) {
  const prisma = new PrismaClient();
  seedStatusProcesso(prisma)
    .catch((error) => {
      console.error('❌ Erro ao executar seed de Status Processo:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
