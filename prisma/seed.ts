import { PrismaClient } from '@prisma/client';
import { HashUtil } from '../src/utils/hash.util';
import { ValidationUtil } from '../src/utils/validation.util';

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function main() {
  console.log('🌱 Iniciando seed do banco MySQL...');

  try {
    await prisma.$connect();
    console.log('✅ Conectado ao MySQL com sucesso!');

    // 1. Criar usuário admin
    await criarUsuarioAdmin();

    // 2. Criar dados iniciais do site
    await criarDadosSite();

    console.log('🎉 Seed concluído com sucesso!');
  } catch (error) {
    console.error('❌ Erro durante o seed:', error);
    throw error;
  }
}

async function criarUsuarioAdmin() {
  console.log('👤 Configurando usuário admin...');

  const adminExistente = await prisma.usuario.findUnique({
    where: { email: 'admin@advancedmais.com' },
  });

  if (adminExistente) {
    console.log('⚠️ Usuário admin já existe, atualizando...');

    const senhaHash = await HashUtil.gerarHash('Admin@123');

    await prisma.usuario.update({
      where: { id: adminExistente.id },
      data: {
        senha: senhaHash,
        ultimoLogin: new Date(),
      },
    });

    console.log('✅ Usuário admin atualizado!');
    return;
  }

  const senhaHash = await HashUtil.gerarHash('Admin@123');
  const matricula = ValidationUtil.gerarMatricula();

  const usuario = await prisma.usuario.create({
    data: {
      email: 'admin@advancedmais.com',
      senha: senhaHash,
      matricula: matricula,
      tipoUsuario: 'PESSOA_FISICA',
      nome: 'Administrador do Sistema',
      status: 'ATIVO',
    },
  });

  console.log('✅ Usuário admin criado!');
  console.log(`   📧 Email: ${usuario.email}`);
  console.log(`   🆔 Matrícula: ${usuario.matricula}`);
  console.log(`   🔑 Senha: Admin@123`);

  // Criar log de auditoria
  await prisma.logAuditoria.create({
    data: {
      usuarioId: usuario.id,
      acao: 'CRIACAO',
      descricao: 'Usuário administrador criado via seed',
      ipAddress: '127.0.0.1',
      userAgent: 'Prisma Seed Script',
    },
  });
}

async function criarDadosSite() {
  console.log('🌐 Criando dados iniciais do site...');

  // 1. Seção Sobre da página inicial
  const sobreExistente = await prisma.sobre.count();

  if (sobreExistente === 0) {
    await prisma.sobre.create({
      data: {
        titulo: 'Acelere o crescimento do seu negócio',
        descricao:
          'Na Advance+, fornecemos soluções estratégicas em gestão de pessoas e recrutamento, focadas em elevar o desempenho e a competitividade da sua empresa. Nosso trabalho envolve identificar e desenvolver talentos, otimizar processos e fortalecer a cultura organizacional, reduzindo custos de rotatividade e aumentando a produtividade da equipe. Conte conosco para potencializar resultados e alcançar novos patamares de sucesso.',
        imagemUrl: 'https://advancerh.com.br/images/imagem_1_home.png',
      },
    });
    console.log('✅ Seção Sobre criada');
  } else {
    console.log('⚠️ Seção Sobre já existe');
  }

  // 2. Serviços (exemplos)
  const servicosExistentes = await prisma.servico.count();

  if (servicosExistentes === 0) {
    await prisma.servico.createMany({
      data: [
        {
          tipo: 'CONSULTORIA',
          titulo: 'Consultoria em RH',
          descricao:
            'Consultoria especializada em gestão de pessoas e recursos humanos para otimizar sua empresa.',
          imagemUrl: 'https://advancerh.com.br/images/consultoria.png',
          titleButton: 'Saiba Mais',
          urlButton: '/consultoria',
        },
        {
          tipo: 'RECRUTAMENTO',
          titulo: 'Recrutamento e Seleção',
          descricao:
            'Encontramos os melhores talentos para sua empresa com nosso processo seletivo especializado.',
          imagemUrl: 'https://advancerh.com.br/images/recrutamento.png',
          titleButton: 'Contratar',
          urlButton: '/recrutamento',
        },
      ],
    });
    console.log('✅ Serviços criados');
  } else {
    console.log('⚠️ Serviços já existem');
  }

  // 3. Banner (exemplo)
  const bannersExistentes = await prisma.banner.count();

  if (bannersExistentes === 0) {
    await prisma.banner.create({
      data: {
        imagemUrl: 'https://advancerh.com.br/images/banner_principal.png',
        linkUrl: '/sobre',
        position: 1,
      },
    });
    console.log('✅ Banner criado');
  } else {
    console.log('⚠️ Banner já existe');
  }

  console.log('🌐 Dados do site configurados!');
}

main()
  .catch((error) => {
    console.error('💥 Erro fatal no seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('🔌 Conexão com MySQL encerrada');
  });
