/**
 * Script para criar 10 vagas de teste
 * 3 delas serão destaques
 */

import {
  PrismaClient,
  StatusDeVagas,
  ModalidadesDeVagas,
  RegimesDeTrabalhos,
  Senioridade,
  Jornadas,
} from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

function generateVagaCode(index: number): string {
  // Código de 6 caracteres: V + 5 dígitos
  const num = (Date.now() % 100000).toString().padStart(5, '0');
  const idx = (index % 10).toString();
  return `V${num.slice(0, 4)}${idx}`;
}

function generateSlug(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 80); // Limitar para deixar espaço para o código
}

async function main() {
  console.log('🌱 Criando 10 vagas de teste...\n');

  // Buscar empresa
  const empresa = await prisma.usuarios.findFirst({
    where: { role: 'EMPRESA', status: 'ATIVO' },
  });

  if (!empresa) {
    console.error('❌ Nenhuma empresa encontrada. Execute seed-usuarios.ts primeiro.');
    process.exit(1);
  }

  console.log(`✅ Empresa encontrada: ${empresa.nomeCompleto || empresa.email}\n`);

  // Buscar plano ativo para destaques
  const planoAtivo = await prisma.empresasPlano.findFirst({
    where: { usuarioId: empresa.id, status: 'ATIVO' },
  });

  if (!planoAtivo) {
    console.error('❌ Nenhum plano ativo encontrado para a empresa.');
    console.log('⚠️  Criando vagas sem destaques...\n');
  } else {
    console.log(`✅ Plano ativo encontrado: ${planoAtivo.id}\n`);
  }

  // Buscar áreas de interesse
  const areas = await prisma.candidatosAreasInteresse.findMany({
    include: { CandidatosSubareasInteresse: true },
    take: 3,
  });

  if (areas.length === 0) {
    console.error('❌ Nenhuma área de interesse encontrada.');
    process.exit(1);
  }

  const areaTI = areas.find(
    (a) => a.categoria.includes('Tecnologia') || a.categoria.includes('TI'),
  );
  const area1 = areaTI || areas[0];
  const subarea1 = area1.CandidatosSubareasInteresse[0];

  // Definir vagas para criar
  const vagas = [
    {
      titulo: 'Desenvolvedor Full Stack Sênior',
      descricao:
        'Buscamos desenvolvedor Full Stack Sênior com experiência em React, Node.js e TypeScript para liderar projetos inovadores em tecnologia.',
      requisitos: {
        obrigatorios: [
          'Experiência mínima de 5 anos com desenvolvimento web',
          'Domínio avançado de JavaScript/TypeScript',
          'Experiência com React e Node.js',
          'Conhecimento em arquitetura de microserviços',
        ],
        desejaveis: ['AWS ou Azure', 'Docker/Kubernetes', 'Metodologias ágeis'],
      },
      atividades: {
        principais: [
          'Liderar desenvolvimento de features',
          'Code review e mentoria',
          'Arquitetura de soluções',
          'Documentação técnica',
        ],
      },
      beneficios: {
        lista: [
          'Vale alimentação R$ 800',
          'Plano de saúde e odontológico',
          'Vale transporte',
          'Home office 3x por semana',
          'Auxílio educação',
        ],
      },
      modalidade: ModalidadesDeVagas.HIBRIDO,
      regime: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.SENIOR,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 2,
      salarioMin: '12000.00',
      salarioMax: '18000.00',
      destaque: true, // DESTAQUE 1
    },
    {
      titulo: 'Desenvolvedor Backend Pleno',
      descricao:
        'Vaga para desenvolvedor Backend com foco em APIs RESTful, microserviços e alta performance.',
      requisitos: {
        obrigatorios: [
          '3+ anos de experiência com Node.js ou Python',
          'Conhecimento em bancos de dados SQL e NoSQL',
          'Experiência com APIs REST e GraphQL',
        ],
        desejaveis: ['Kubernetes', 'Redis', 'Message queues'],
      },
      atividades: {
        principais: [
          'Desenvolver APIs escaláveis',
          'Otimizar performance de queries',
          'Implementar testes automatizados',
        ],
      },
      beneficios: {
        lista: ['Plano de saúde', 'Vale refeição', 'Home office'],
      },
      modalidade: ModalidadesDeVagas.REMOTO,
      regime: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.PLENO,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 1,
      salarioMin: '8000.00',
      salarioMax: '12000.00',
      destaque: false,
    },
    {
      titulo: 'Desenvolvedor Frontend Júnior',
      descricao:
        'Oportunidade para desenvolvedor Frontend iniciante que deseja crescer em projetos modernos com React.',
      requisitos: {
        obrigatorios: [
          'Conhecimento em JavaScript/TypeScript',
          'Experiência com React',
          'Conhecimento de HTML/CSS',
        ],
        desejaveis: ['Next.js', 'Styled Components', 'Jest'],
      },
      atividades: {
        principais: [
          'Desenvolver interfaces responsivas',
          'Implementar componentes reutilizáveis',
          'Trabalhar com designers',
        ],
      },
      beneficios: {
        lista: ['Plano de saúde', 'Vale transporte', 'Auxílio educação'],
      },
      modalidade: ModalidadesDeVagas.HIBRIDO,
      regime: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.JUNIOR,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 3,
      salarioMin: '4000.00',
      salarioMax: '6000.00',
      destaque: true, // DESTAQUE 2
    },
    {
      titulo: 'DevOps Engineer',
      descricao:
        'Procuramos profissional DevOps para gerenciar infraestrutura cloud e pipelines de CI/CD.',
      requisitos: {
        obrigatorios: [
          'Experiência com Docker e Kubernetes',
          'Conhecimento em AWS ou Azure',
          'CI/CD (GitHub Actions, GitLab CI)',
        ],
        desejaveis: ['Terraform', 'Ansible', 'Monitoring tools'],
      },
      atividades: {
        principais: [
          'Gerenciar infraestrutura cloud',
          'Implementar pipelines CI/CD',
          'Monitoramento e alertas',
        ],
      },
      beneficios: {
        lista: ['Plano de saúde premium', 'Vale alimentação', 'Home office'],
      },
      modalidade: ModalidadesDeVagas.REMOTO,
      regime: RegimesDeTrabalhos.PJ,
      senioridade: Senioridade.PLENO,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 1,
      salarioMin: '10000.00',
      salarioMax: '15000.00',
      destaque: false,
    },
    {
      titulo: 'Product Manager',
      descricao:
        'Vaga para Product Manager com experiência em produtos digitais e metodologias ágeis.',
      requisitos: {
        obrigatorios: [
          '5+ anos de experiência como PM',
          'Conhecimento em metodologias ágeis',
          'Experiência com roadmap e priorização',
        ],
        desejaveis: ['Certificação Scrum', 'Análise de dados', 'Inglês fluente'],
      },
      atividades: {
        principais: [
          'Definir roadmap de produto',
          'Colaborar com time de desenvolvimento',
          'Análise de métricas e KPIs',
        ],
      },
      beneficios: {
        lista: ['Plano de saúde', 'Vale refeição', 'Participação nos lucros'],
      },
      modalidade: ModalidadesDeVagas.PRESENCIAL,
      regime: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.SENIOR,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 1,
      salarioMin: '15000.00',
      salarioMax: '22000.00',
      destaque: false,
    },
    {
      titulo: 'UX Designer',
      descricao: 'Buscamos UX Designer criativo para criar experiências digitais excepcionais.',
      requisitos: {
        obrigatorios: [
          'Portfolio com casos de uso',
          'Domínio de Figma',
          'Experiência em pesquisa com usuários',
        ],
        desejaveis: ['Prototipação', 'Design System', 'UI Design'],
      },
      atividades: {
        principais: [
          'Criar wireframes e protótipos',
          'Conduzir pesquisas com usuários',
          'Colaborar com time de produto',
        ],
      },
      beneficios: {
        lista: ['Plano de saúde', 'Vale alimentação', 'Equipamento fornecido'],
      },
      modalidade: ModalidadesDeVagas.HIBRIDO,
      regime: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.PLENO,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 1,
      salarioMin: '7000.00',
      salarioMax: '10000.00',
      destaque: false,
    },
    {
      titulo: 'QA Engineer',
      descricao: 'Vaga para QA Engineer com foco em automação de testes e garantia de qualidade.',
      requisitos: {
        obrigatorios: [
          'Experiência com testes automatizados',
          'Conhecimento em Selenium ou Cypress',
          'Experiência em testes de API',
        ],
        desejaveis: ['Testes de performance', 'BDD', 'CI/CD'],
      },
      atividades: {
        principais: [
          'Criar e executar testes automatizados',
          'Reportar bugs e issues',
          'Colaborar com desenvolvedores',
        ],
      },
      beneficios: {
        lista: ['Plano de saúde', 'Vale refeição', 'Home office flexível'],
      },
      modalidade: ModalidadesDeVagas.HIBRIDO,
      regime: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.PLENO,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 2,
      salarioMin: '6000.00',
      salarioMax: '9000.00',
      destaque: false,
    },
    {
      titulo: 'Data Scientist',
      descricao:
        'Oportunidade para Data Scientist trabalhar com análise de dados e machine learning.',
      requisitos: {
        obrigatorios: [
          'Experiência com Python ou R',
          'Conhecimento em SQL',
          'Experiência com machine learning',
        ],
        desejaveis: ['Big Data', 'Cloud (AWS/GCP)', 'Deep Learning'],
      },
      atividades: {
        principais: [
          'Analisar grandes volumes de dados',
          'Desenvolver modelos de ML',
          'Criar dashboards e relatórios',
        ],
      },
      beneficios: {
        lista: ['Plano de saúde', 'Vale alimentação', 'Auxílio educação'],
      },
      modalidade: ModalidadesDeVagas.HIBRIDO,
      regime: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.PLENO,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 1,
      salarioMin: '10000.00',
      salarioMax: '15000.00',
      destaque: true, // DESTAQUE 3
    },
    {
      titulo: 'Scrum Master',
      descricao:
        'Buscamos Scrum Master certificado para facilitar processos ágeis e melhorar a produtividade dos times.',
      requisitos: {
        obrigatorios: [
          'Certificação Scrum Master',
          'Experiência facilitando cerimônias',
          'Conhecimento em metodologias ágeis',
        ],
        desejaveis: ['Certificação PMP', 'Kanban', 'SAFe'],
      },
      atividades: {
        principais: ['Facilitar cerimônias ágeis', 'Remover impedimentos', 'Mentoria de times'],
      },
      beneficios: {
        lista: ['Plano de saúde', 'Vale refeição', 'Home office'],
      },
      modalidade: ModalidadesDeVagas.HIBRIDO,
      regime: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.PLENO,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 1,
      salarioMin: '8000.00',
      salarioMax: '12000.00',
      destaque: false,
    },
    {
      titulo: 'Mobile Developer (React Native)',
      descricao: 'Vaga para desenvolvedor Mobile com React Native para criar apps iOS e Android.',
      requisitos: {
        obrigatorios: [
          'Experiência com React Native',
          'Conhecimento de JavaScript/TypeScript',
          'Experiência publicando apps',
        ],
        desejaveis: ['Native modules', 'Firebase', 'CI/CD mobile'],
      },
      atividades: {
        principais: [
          'Desenvolver apps mobile',
          'Manter e otimizar apps existentes',
          'Colaborar com designers',
        ],
      },
      beneficios: {
        lista: ['Plano de saúde', 'Vale alimentação', 'Home office', 'Equipamento'],
      },
      modalidade: ModalidadesDeVagas.REMOTO,
      regime: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.PLENO,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 1,
      salarioMin: '9000.00',
      salarioMax: '13000.00',
      destaque: false,
    },
  ];

  const vagasCriadas = [];
  const vagasDestaque = [];

  for (let i = 0; i < vagas.length; i++) {
    const vaga = vagas[i];
    try {
      const codigo = generateVagaCode(i);
      const baseSlug = generateSlug(vaga.titulo);
      const slug = `${baseSlug}-${codigo.toLowerCase()}`.substring(0, 120); // Garantir limite de 120 caracteres
      const inscricoesAte = new Date();
      inscricoesAte.setDate(inscricoesAte.getDate() + 30); // 30 dias a partir de hoje

      const vagaCriada = await prisma.empresasVagas.create({
        data: {
          id: randomUUID(),
          codigo,
          slug,
          usuarioId: empresa.id,
          titulo: vaga.titulo,
          descricao: vaga.descricao,
          requisitos: vaga.requisitos,
          atividades: vaga.atividades,
          beneficios: vaga.beneficios,
          areaInteresseId: area1.id,
          subareaInteresseId: subarea1?.id || null,
          modalidade: vaga.modalidade,
          regimeDeTrabalho: vaga.regime,
          senioridade: vaga.senioridade,
          jornada: vaga.jornada,
          numeroVagas: vaga.numeroVagas,
          salarioMin: vaga.salarioMin,
          salarioMax: vaga.salarioMax,
          salarioConfidencial: false,
          status: StatusDeVagas.PUBLICADO,
          destaque: vaga.destaque,
          localizacao: {
            cidade: 'São Paulo',
            estado: 'SP',
          },
          inscricoesAte,
        },
      });

      vagasCriadas.push(vagaCriada);

      // Se for destaque e tiver plano ativo, criar registro em EmpresasVagasDestaque
      if (vaga.destaque && planoAtivo) {
        await prisma.empresasVagasDestaque.create({
          data: {
            id: randomUUID(),
            vagaId: vagaCriada.id,
            empresasPlanoId: planoAtivo.id,
            ativo: true,
          },
        });
        vagasDestaque.push(vaga.titulo);
        console.log(`  ✅ Vaga criada com DESTAQUE: ${vaga.titulo}`);
      } else {
        console.log(`  ✅ Vaga criada: ${vaga.titulo}`);
      }
    } catch (error: any) {
      console.error(`  ❌ Erro ao criar vaga "${vaga.titulo}":`, error.message);
    }
  }

  console.log(`\n✨ ${vagasCriadas.length} vagas criadas com sucesso!`);
  console.log(`⭐ ${vagasDestaque.length} vagas em destaque:\n`);
  vagasDestaque.forEach((titulo, idx) => {
    console.log(`   ${idx + 1}. ${titulo}`);
  });
  console.log('');
}

main()
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
