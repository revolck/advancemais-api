/**
 * Seed de Vagas - Cria vagas de teste para empresas
 */

import {
  PrismaClient,
  Roles,
  StatusDeVagas,
  ModalidadesDeVagas,
  RegimesDeTrabalhos,
  Senioridade,
  Jornadas,
  EmpresasVagas,
} from '@prisma/client';
import { randomUUID } from 'crypto';

export async function seedVagas(prisma?: PrismaClient) {
  const client = prisma || new PrismaClient();
  console.log('🌱 Iniciando seed de vagas...');

  // Buscar empresas
  const empresas = await client.usuarios.findMany({
    where: { role: Roles.EMPRESA },
    take: 2,
  });

  if (empresas.length === 0) {
    console.log('  ⚠️  Nenhuma empresa encontrada. Execute seed-usuarios.ts primeiro.');
    return [];
  }

  // Buscar áreas de interesse
  const areas = await client.candidatosAreasInteresse.findMany({
    include: { CandidatosSubareasInteresse: true },
  });

  if (areas.length === 0) {
    console.log(
      '  ⚠️  Nenhuma área de interesse encontrada. Execute seed-areas-interesse.ts primeiro.',
    );
    return [];
  }

  const vagasCriadas: EmpresasVagas[] = [];
  const empresa1 = empresas[0];
  const empresa2 = empresas.length > 1 ? empresas[1] : empresas[0];

  const areaTI = areas.find((a) => a.categoria.includes('Tecnologia'));
  const areaRH = areas.find((a) => a.categoria.includes('Recursos'));
  const areaMarketing = areas.find((a) => a.categoria.includes('Marketing'));

  const vagas = [
    {
      empresaId: empresa1.id,
      titulo: 'Desenvolvedor Full Stack Pleno',
      descricao:
        'Buscamos desenvolvedor Full Stack com experiência em React e Node.js para atuar em projetos inovadores.',
      requisitos: {
        obrigatorios: [
          'Experiência mínima de 3 anos com desenvolvimento web',
          'Domínio de JavaScript/TypeScript',
          'Conhecimento em React e Node.js',
          'Experiência com bancos de dados SQL e NoSQL',
        ],
        desejaveis: [
          'Conhecimento em Docker e Kubernetes',
          'Experiência com AWS ou Azure',
          'Conhecimento em metodologias ágeis',
        ],
      },
      atividades: {
        principais: [
          'Desenvolver e manter aplicações web',
          'Participar de code reviews',
          'Trabalhar em equipe ágil',
          'Documentar código e processos',
        ],
      },
      beneficios: {
        lista: [
          'Vale alimentação ou refeição',
          'Plano de saúde e odontológico',
          'Vale transporte',
          'Home office flexível',
          'Day off de aniversário',
        ],
      },
      areaInteresseId: areaTI?.id || areas[0].id,
      subareaInteresseId: areaTI?.CandidatosSubareasInteresse.find((s) =>
        s.nome.includes('Full Stack'),
      )?.id,
      modalidade: ModalidadesDeVagas.HIBRIDO,
      regimeDeTrabalho: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.PLENO,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 2,
      salarioMin: '6000.00',
      salarioMax: '9000.00',
      status: StatusDeVagas.PUBLICADO,
      localizacao: {
        cidade: 'São Paulo',
        estado: 'SP',
      },
    },
    {
      empresaId: empresa1.id,
      titulo: 'Designer UX/UI Sênior',
      descricao:
        'Procuramos designer criativo e estratégico para liderar projetos de experiência do usuário.',
      requisitos: {
        obrigatorios: [
          'Portfolio robusto demonstrando experiência em UX/UI',
          'Domínio de Figma e Adobe XD',
          'Experiência em Design System',
          'Conhecimento em pesquisa com usuários',
        ],
        desejaveis: [
          'Experiência com prototipação',
          'Conhecimento básico de HTML/CSS',
          'Inglês avançado',
        ],
      },
      atividades: {
        principais: [
          'Criar interfaces intuitivas e atrativas',
          'Conduzir pesquisas com usuários',
          'Desenvolver e manter Design System',
          'Colaborar com equipe de desenvolvimento',
        ],
      },
      beneficios: {
        lista: [
          'Vale alimentação',
          'Plano de saúde',
          'Auxílio home office',
          'Cursos e certificações',
        ],
      },
      areaInteresseId: areaMarketing?.id || areas[0].id,
      subareaInteresseId: areaMarketing?.CandidatosSubareasInteresse.find((s) =>
        s.nome.includes('Design'),
      )?.id,
      modalidade: ModalidadesDeVagas.REMOTO,
      regimeDeTrabalho: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.SENIOR,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 1,
      salarioMin: '8000.00',
      salarioMax: '12000.00',
      status: StatusDeVagas.PUBLICADO,
      localizacao: {
        cidade: 'São Paulo',
        estado: 'SP',
      },
    },
    {
      empresaId: empresa2.id,
      titulo: 'Analista de Recrutamento e Seleção',
      descricao:
        'Empresa de consultoria em RH busca profissional para conduzir processos seletivos.',
      requisitos: {
        obrigatorios: [
          'Experiência mínima de 2 anos em R&S',
          'Graduação em Psicologia, RH ou áreas afins',
          'Conhecimento em técnicas de entrevista',
        ],
        desejaveis: [
          'Experiência com recrutamento de TI',
          'Conhecimento em Assessment',
          'Excel avançado',
        ],
      },
      atividades: {
        principais: [
          'Conduzir processos seletivos completos',
          'Realizar entrevistas comportamentais',
          'Aplicar testes e dinâmicas',
          'Elaborar laudos técnicos',
        ],
      },
      beneficios: {
        lista: ['Vale refeição', 'Plano de saúde', 'Vale transporte', 'PLR'],
      },
      areaInteresseId: areaRH?.id || areas[0].id,
      subareaInteresseId: areaRH?.CandidatosSubareasInteresse.find((s) =>
        s.nome.includes('Recrutamento'),
      )?.id,
      modalidade: ModalidadesDeVagas.PRESENCIAL,
      regimeDeTrabalho: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.PLENO,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 1,
      salarioMin: '4000.00',
      salarioMax: '6000.00',
      status: StatusDeVagas.PUBLICADO,
      localizacao: {
        cidade: 'Rio de Janeiro',
        estado: 'RJ',
      },
    },
    {
      empresaId: empresa1.id,
      titulo: 'DevOps Engineer',
      descricao:
        'Estamos em busca de um DevOps Engineer para otimizar nossos processos de desenvolvimento e deployment.',
      requisitos: {
        obrigatorios: [
          'Experiência com AWS ou Azure',
          'Conhecimento em Docker e Kubernetes',
          'Experiência com CI/CD (Jenkins, GitLab CI, GitHub Actions)',
          'Linux avançado',
        ],
        desejaveis: [
          'Certificações AWS ou Azure',
          'Experiência com Terraform',
          'Conhecimento em monitoramento (Prometheus, Grafana)',
        ],
      },
      atividades: {
        principais: [
          'Gerenciar infraestrutura em cloud',
          'Automatizar processos de deploy',
          'Monitorar e otimizar performance',
          'Implementar práticas de DevSecOps',
        ],
      },
      beneficios: {
        lista: [
          'Vale alimentação',
          'Plano de saúde e odontológico',
          'Trabalho 100% remoto',
          'Budget para cursos e certificações',
          'Equipamento fornecido',
        ],
      },
      areaInteresseId: areaTI?.id || areas[0].id,
      subareaInteresseId: areaTI?.CandidatosSubareasInteresse.find((s) => s.nome.includes('DevOps'))
        ?.id,
      modalidade: ModalidadesDeVagas.REMOTO,
      regimeDeTrabalho: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.PLENO,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 1,
      salarioMin: '8000.00',
      salarioMax: '12000.00',
      status: StatusDeVagas.PUBLICADO,
      localizacao: {
        cidade: 'São Paulo',
        estado: 'SP',
      },
    },
    {
      empresaId: empresa2.id,
      titulo: 'Estagiário de Recursos Humanos',
      descricao:
        'Oportunidade de estágio para estudantes de Psicologia ou RH com interesse em desenvolvimento de carreira.',
      requisitos: {
        obrigatorios: [
          'Cursando Psicologia, RH ou áreas relacionadas',
          'A partir do 3º semestre',
          'Disponibilidade de 6 horas diárias',
        ],
        desejaveis: ['Conhecimento em pacote Office', 'Boa comunicação', 'Proatividade'],
      },
      atividades: {
        principais: [
          'Apoiar processos de recrutamento',
          'Auxiliar em treinamentos',
          'Organizar documentos e relatórios',
          'Dar suporte administrativo à área de RH',
        ],
      },
      beneficios: {
        lista: [
          'Bolsa-auxílio compatível com mercado',
          'Vale transporte',
          'Vale refeição',
          'Seguro de vida',
        ],
      },
      areaInteresseId: areaRH?.id || areas[0].id,
      subareaInteresseId: areaRH?.CandidatosSubareasInteresse.find((s) => s.nome.includes('Gestão'))
        ?.id,
      modalidade: ModalidadesDeVagas.PRESENCIAL,
      regimeDeTrabalho: RegimesDeTrabalhos.ESTAGIO,
      senioridade: Senioridade.ESTAGIARIO,
      jornada: Jornadas.MEIO_PERIODO,
      numeroVagas: 2,
      salarioMin: '1200.00',
      salarioMax: '1500.00',
      status: StatusDeVagas.PUBLICADO,
      localizacao: {
        cidade: 'Rio de Janeiro',
        estado: 'RJ',
      },
    },
  ];

  for (const vaga of vagas) {
    try {
      console.log(`  💼 Criando vaga: ${vaga.titulo}`);

      const codigo = `V${Date.now().toString().slice(-5)}`; // 6 caracteres máximo
      const slug = vaga.titulo
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .substring(0, 50); // Limitar a 50 caracteres

      const vagaDb = await client.empresasVagas.create({
        data: {
          id: randomUUID(),
          codigo,
          slug: `${slug}-${codigo.toLowerCase()}`,
          usuarioId: vaga.empresaId,
          titulo: vaga.titulo,
          descricao: vaga.descricao,
          requisitos: vaga.requisitos,
          atividades: vaga.atividades,
          beneficios: vaga.beneficios,
          areaInteresseId: vaga.areaInteresseId,
          subareaInteresseId: vaga.subareaInteresseId,
          modalidade: vaga.modalidade,
          regimeDeTrabalho: vaga.regimeDeTrabalho,
          senioridade: vaga.senioridade,
          jornada: vaga.jornada,
          numeroVagas: vaga.numeroVagas,
          salarioMin: vaga.salarioMin,
          salarioMax: vaga.salarioMax,
          salarioConfidencial: false,
          status: vaga.status,
          localizacao: vaga.localizacao,
          inscricoesAte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
          atualizadoEm: new Date(),
        },
      });

      vagasCriadas.push(vagaDb);
      console.log(`  ✅ Vaga criada: ${vaga.titulo}`);
    } catch (error: any) {
      console.error(`  ❌ Erro ao criar vaga ${vaga.titulo}:`, error.message);
    }
  }

  console.log(`\n✨ ${vagasCriadas.length} vagas criadas com sucesso!\n`);

  return vagasCriadas;
}

// Se executado diretamente
if (require.main === module) {
  const prisma = new PrismaClient();
  seedVagas(prisma)
    .then(() => {
      console.log('✅ Seed de vagas concluído');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro no seed de vagas:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
