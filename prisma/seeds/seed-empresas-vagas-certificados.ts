/**
 * Seed Completo: Empresas, Vagas e Certificados
 *
 * Cria:
 * - 5 empresas novas
 * - 20 vagas (algumas em modo anônimo)
 * - Certificados para inscrições existentes
 */

import {
  PrismaClient,
  Roles,
  StatusDeVagas,
  ModalidadesDeVagas,
  RegimesDeTrabalhos,
  Senioridade,
  Jornadas,
  TiposDeUsuarios,
  Status,
  StatusInscricao,
  CursosCertificados,
  CursosCertificadosTipos,
  CursosCertificadosLogAcao,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

export async function seedEmpresasVagasCertificados(prisma?: PrismaClient) {
  const client = prisma || new PrismaClient();
  console.log('🌱 Iniciando seed completo: Empresas, Vagas e Certificados...\n');

  // ============================================
  // 1. CRIAR EMPRESAS
  // ============================================
  console.log('📦 Criando empresas...');
  const empresasCriadas: any[] = [];

  const empresas = [
    {
      nomeCompleto: 'Inovação Digital S.A.',
      email: 'inovacao.digital@example.com',
      senha: 'Empresa@123',
      cnpj: '11111111000111',
      telefone: '11911111111',
      descricao: 'Empresa líder em soluções digitais e transformação tecnológica',
      cidade: 'São Paulo',
      estado: 'SP',
    },
    {
      nomeCompleto: 'Tech Solutions Brasil',
      email: 'tech.solutions@example.com',
      senha: 'Empresa@123',
      cnpj: '22222222000222',
      telefone: '11922222222',
      descricao: 'Especializada em desenvolvimento de software e consultoria em TI',
      cidade: 'Rio de Janeiro',
      estado: 'RJ',
    },
    {
      nomeCompleto: 'StartupHub Inovação',
      email: 'startuphub@example.com',
      senha: 'Empresa@123',
      cnpj: '33333333000333',
      telefone: '11933333333',
      descricao: 'Aceleradora de startups e inovação tecnológica',
      cidade: 'Belo Horizonte',
      estado: 'MG',
    },
    {
      nomeCompleto: 'Cloud Services LTDA',
      email: 'cloud.services@example.com',
      senha: 'Empresa@123',
      cnpj: '44444444000444',
      telefone: '11944444444',
      descricao: 'Serviços em nuvem e infraestrutura de TI',
      cidade: 'Curitiba',
      estado: 'PR',
    },
    {
      nomeCompleto: 'Data Analytics Corp',
      email: 'data.analytics@example.com',
      senha: 'Empresa@123',
      cnpj: '55555555000555',
      telefone: '11955555555',
      descricao: 'Análise de dados e business intelligence',
      cidade: 'Porto Alegre',
      estado: 'RS',
    },
  ];

  for (const empresaData of empresas) {
    try {
      // Verificar se já existe
      const existingEmpresa = await client.usuarios.findUnique({
        where: { email: empresaData.email },
      });

      if (existingEmpresa) {
        console.log(`  ✅ Empresa já existe: ${empresaData.nomeCompleto}`);
        empresasCriadas.push(existingEmpresa);
        continue;
      }

      const senhaHash = await bcrypt.hash(empresaData.senha, 10);
      const authId = `seed-empresa-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const codUsuario = `EMP-${Math.floor(10000 + Math.random() * 90000)}`;
      const userId = randomUUID();

      const empresa = await client.usuarios.create({
        data: {
          id: userId,
          authId,
          nomeCompleto: empresaData.nomeCompleto,
          email: empresaData.email,
          senha: senhaHash,
          codUsuario,
          role: Roles.EMPRESA,
          tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
          cnpj: empresaData.cnpj,
          status: Status.ATIVO,
          UsuariosInformation: {
            create: {
              telefone: empresaData.telefone,
              descricao: empresaData.descricao,
              aceitarTermos: true,
            },
          },
          UsuariosEnderecos: {
            create: {
              id: randomUUID(),
              cidade: empresaData.cidade,
              estado: empresaData.estado,
            },
          },
          atualizadoEm: new Date(),
        },
      });

      empresasCriadas.push(empresa);
      console.log(`  ✅ Empresa criada: ${empresaData.nomeCompleto}`);
    } catch (error: any) {
      console.error(`  ❌ Erro ao criar empresa ${empresaData.nomeCompleto}:`, error.message);
    }
  }

  console.log(`\n✨ ${empresasCriadas.length} empresas criadas!\n`);

  // ============================================
  // 2. BUSCAR DADOS NECESSÁRIOS PARA VAGAS
  // ============================================
  const areas = await client.candidatosAreasInteresse.findMany({
    include: { CandidatosSubareasInteresse: true },
  });

  if (areas.length === 0) {
    console.log(
      '  ⚠️  Nenhuma área de interesse encontrada. Execute seed-areas-interesse.ts primeiro.',
    );
    return;
  }

  // Categorias de vagas não são obrigatórias, então não precisamos buscar

  // ============================================
  // 3. CRIAR 20 VAGAS
  // ============================================
  console.log('💼 Criando 20 vagas...');
  const vagasCriadas: any[] = [];

  const vagas = [
    {
      empresa: empresasCriadas[0],
      titulo: 'Desenvolvedor Full Stack Sênior',
      descricao:
        'Buscamos desenvolvedor Full Stack sênior para liderar projetos de grande escala. Experiência com React, Node.js e arquitetura de microsserviços.',
      requisitos: {
        obrigatorios: [
          '5+ anos de experiência com desenvolvimento Full Stack',
          'Domínio de React, Node.js e TypeScript',
          'Experiência com arquitetura de microsserviços',
          'Conhecimento em Docker e Kubernetes',
        ],
        desejaveis: [
          'Certificações AWS',
          'Experiência com GraphQL',
          'Conhecimento em testes automatizados',
        ],
      },
      atividades: {
        principais: [
          'Desenvolver e manter aplicações web escaláveis',
          'Liderar code reviews e mentorias',
          'Arquitetar soluções técnicas',
          'Participar de decisões estratégicas de produto',
        ],
      },
      beneficios: {
        lista: [
          'Salário competitivo',
          'Plano de saúde e odontológico',
          'Vale alimentação R$ 800',
          'Home office flexível',
          'Auxílio educação R$ 1.000/mês',
          'Day off de aniversário',
        ],
      },
      modalidade: ModalidadesDeVagas.HIBRIDO,
      regimeDeTrabalho: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.SENIOR,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 2,
      salarioMin: '12000.00',
      salarioMax: '18000.00',
      modoAnonimo: false,
      destaque: true,
    },
    {
      empresa: empresasCriadas[0],
      titulo: 'Product Manager',
      descricao:
        'Oportunidade para Product Manager com experiência em produtos digitais B2B. Trabalhará com equipe multidisciplinar em produtos inovadores.',
      requisitos: {
        obrigatorios: [
          '3+ anos de experiência como Product Manager',
          'Experiência com produtos digitais',
          'Conhecimento em metodologias ágeis',
          'Excelente comunicação e liderança',
        ],
        desejaveis: [
          'MBA ou pós-graduação',
          'Experiência internacional',
          'Conhecimento em analytics',
        ],
      },
      atividades: {
        principais: [
          'Definir roadmap de produto',
          'Trabalhar com stakeholders',
          'Analisar métricas e KPIs',
          'Liderar equipe multidisciplinar',
        ],
      },
      beneficios: {
        lista: ['Plano de saúde', 'Vale refeição', 'Home office', 'Stock options'],
      },
      modalidade: ModalidadesDeVagas.REMOTO,
      regimeDeTrabalho: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.SENIOR,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 1,
      salarioMin: '15000.00',
      salarioMax: '22000.00',
      modoAnonimo: true, // MODO ANÔNIMO
      destaque: true,
    },
    {
      empresa: empresasCriadas[1],
      titulo: 'DevOps Engineer Pleno',
      descricao:
        'Procuramos DevOps Engineer para gerenciar infraestrutura em cloud e otimizar processos de CI/CD.',
      requisitos: {
        obrigatorios: [
          '3+ anos de experiência com DevOps',
          'Conhecimento em AWS ou Azure',
          'Experiência com Docker e Kubernetes',
          'Conhecimento em CI/CD',
        ],
        desejaveis: ['Certificações cloud', 'Terraform', 'Prometheus e Grafana'],
      },
      atividades: {
        principais: [
          'Gerenciar infraestrutura cloud',
          'Automatizar processos de deploy',
          'Monitorar e otimizar performance',
          'Implementar práticas de segurança',
        ],
      },
      beneficios: {
        lista: ['Plano de saúde', 'Vale alimentação', 'Home office', 'Budget para certificações'],
      },
      modalidade: ModalidadesDeVagas.REMOTO,
      regimeDeTrabalho: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.PLENO,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 1,
      salarioMin: '8000.00',
      salarioMax: '12000.00',
      modoAnonimo: false,
      destaque: false,
    },
    {
      empresa: empresasCriadas[1],
      titulo: 'UX Designer Sênior',
      descricao:
        'Buscamos UX Designer sênior para criar experiências excepcionais em produtos digitais. Portfólio robusto é essencial.',
      requisitos: {
        obrigatorios: [
          '5+ anos de experiência em UX Design',
          'Portfólio demonstrando projetos complexos',
          'Domínio de Figma e Adobe XD',
          'Experiência com pesquisa de usuários',
        ],
        desejaveis: ['Design System', 'Prototipação avançada', 'Inglês fluente'],
      },
      atividades: {
        principais: [
          'Criar interfaces intuitivas',
          'Conduzir pesquisas com usuários',
          'Desenvolver Design System',
          'Colaborar com equipe de produto',
        ],
      },
      beneficios: {
        lista: ['Plano de saúde', 'Vale refeição', 'Home office', 'Auxílio equipamento'],
      },
      modalidade: ModalidadesDeVagas.HIBRIDO,
      regimeDeTrabalho: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.SENIOR,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 1,
      salarioMin: '10000.00',
      salarioMax: '15000.00',
      modoAnonimo: true, // MODO ANÔNIMO
      destaque: false,
    },
    {
      empresa: empresasCriadas[2],
      titulo: 'Desenvolvedor React Junior',
      descricao:
        'Oportunidade para desenvolvedor React iniciante crescer em uma startup inovadora. Ambiente de aprendizado constante.',
      requisitos: {
        obrigatorios: [
          'Conhecimento em React e JavaScript',
          'Experiência com Git',
          'Vontade de aprender',
          'Boa comunicação',
        ],
        desejaveis: ['TypeScript', 'Testes', 'Conhecimento em Node.js'],
      },
      atividades: {
        principais: [
          'Desenvolver componentes React',
          'Participar de code reviews',
          'Aprender com equipe sênior',
          'Colaborar em projetos',
        ],
      },
      beneficios: {
        lista: ['Plano de saúde', 'Vale refeição', 'Home office', 'Mentoria'],
      },
      modalidade: ModalidadesDeVagas.REMOTO,
      regimeDeTrabalho: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.JUNIOR,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 3,
      salarioMin: '4000.00',
      salarioMax: '6000.00',
      modoAnonimo: false,
      destaque: false,
    },
    {
      empresa: empresasCriadas[2],
      titulo: 'Analista de Dados Pleno',
      descricao:
        'Procuramos analista de dados para trabalhar com grandes volumes de dados e criar insights estratégicos.',
      requisitos: {
        obrigatorios: [
          '2+ anos de experiência com análise de dados',
          'Conhecimento em SQL e Python',
          'Experiência com visualização de dados',
          'Conhecimento em estatística',
        ],
        desejaveis: ['Power BI ou Tableau', 'Machine Learning', 'Big Data'],
      },
      atividades: {
        principais: [
          'Analisar dados e criar relatórios',
          'Desenvolver dashboards',
          'Criar modelos preditivos',
          'Apresentar insights para stakeholders',
        ],
      },
      beneficios: {
        lista: ['Plano de saúde', 'Vale refeição', 'Home office', 'Cursos'],
      },
      modalidade: ModalidadesDeVagas.HIBRIDO,
      regimeDeTrabalho: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.PLENO,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 2,
      salarioMin: '6000.00',
      salarioMax: '9000.00',
      modoAnonimo: false,
      destaque: true,
    },
    {
      empresa: empresasCriadas[3],
      titulo: 'Cloud Architect',
      descricao:
        'Buscamos Cloud Architect para projetar e implementar soluções em nuvem escaláveis e seguras.',
      requisitos: {
        obrigatorios: [
          '5+ anos de experiência com cloud',
          'Certificações AWS ou Azure',
          'Experiência com arquitetura de sistemas',
          'Conhecimento em segurança cloud',
        ],
        desejaveis: ['Multi-cloud', 'Kubernetes', 'Terraform'],
      },
      atividades: {
        principais: [
          'Projetar arquiteturas cloud',
          'Implementar soluções escaláveis',
          'Garantir segurança e compliance',
          'Otimizar custos',
        ],
      },
      beneficios: {
        lista: ['Plano de saúde premium', 'Vale refeição', 'Home office', 'Stock options'],
      },
      modalidade: ModalidadesDeVagas.REMOTO,
      regimeDeTrabalho: RegimesDeTrabalhos.PJ,
      senioridade: Senioridade.ESPECIALISTA,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 1,
      salarioMin: '20000.00',
      salarioMax: '30000.00',
      modoAnonimo: true, // MODO ANÔNIMO
      destaque: true,
    },
    {
      empresa: empresasCriadas[3],
      titulo: 'QA Engineer Sênior',
      descricao:
        'Procuramos QA Engineer sênior para garantir qualidade de produtos digitais através de testes automatizados.',
      requisitos: {
        obrigatorios: [
          '4+ anos de experiência em QA',
          'Experiência com testes automatizados',
          'Conhecimento em Selenium ou Cypress',
          'Experiência com API testing',
        ],
        desejaveis: ['Performance testing', 'Security testing', 'CI/CD'],
      },
      atividades: {
        principais: [
          'Criar e executar testes automatizados',
          'Desenvolver estratégias de teste',
          'Trabalhar com equipe de desenvolvimento',
          'Garantir qualidade de releases',
        ],
      },
      beneficios: {
        lista: ['Plano de saúde', 'Vale refeição', 'Home office'],
      },
      modalidade: ModalidadesDeVagas.HIBRIDO,
      regimeDeTrabalho: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.SENIOR,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 1,
      salarioMin: '9000.00',
      salarioMax: '13000.00',
      modoAnonimo: false,
      destaque: false,
    },
    {
      empresa: empresasCriadas[4],
      titulo: 'Data Scientist',
      descricao:
        'Oportunidade para Data Scientist trabalhar com machine learning e análise avançada de dados.',
      requisitos: {
        obrigatorios: [
          '3+ anos de experiência como Data Scientist',
          'Conhecimento em Python e R',
          'Experiência com ML e estatística',
          'Conhecimento em SQL',
        ],
        desejaveis: ['Deep Learning', 'NLP', 'Big Data'],
      },
      atividades: {
        principais: [
          'Desenvolver modelos de ML',
          'Analisar dados complexos',
          'Criar soluções preditivas',
          'Colaborar com equipe de produto',
        ],
      },
      beneficios: {
        lista: ['Plano de saúde', 'Vale refeição', 'Home office', 'Cursos'],
      },
      modalidade: ModalidadesDeVagas.REMOTO,
      regimeDeTrabalho: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.PLENO,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 1,
      salarioMin: '10000.00',
      salarioMax: '15000.00',
      modoAnonimo: false,
      destaque: false,
    },
    {
      empresa: empresasCriadas[4],
      titulo: 'Backend Developer Pleno',
      descricao:
        'Buscamos desenvolvedor Backend com experiência em Node.js ou Python para trabalhar em APIs robustas.',
      requisitos: {
        obrigatorios: [
          '3+ anos de experiência com backend',
          'Conhecimento em Node.js ou Python',
          'Experiência com APIs REST',
          'Conhecimento em bancos de dados',
        ],
        desejaveis: ['GraphQL', 'Microserviços', 'Redis'],
      },
      atividades: {
        principais: [
          'Desenvolver APIs robustas',
          'Otimizar performance',
          'Trabalhar com banco de dados',
          'Participar de code reviews',
        ],
      },
      beneficios: {
        lista: ['Plano de saúde', 'Vale refeição', 'Home office'],
      },
      modalidade: ModalidadesDeVagas.HIBRIDO,
      regimeDeTrabalho: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.PLENO,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 2,
      salarioMin: '7000.00',
      salarioMax: '11000.00',
      modoAnonimo: true, // MODO ANÔNIMO
      destaque: false,
    },
    {
      empresa: empresasCriadas[0],
      titulo: 'Mobile Developer iOS',
      descricao:
        'Procuramos desenvolvedor iOS para criar aplicativos nativos de alta qualidade para iPhone e iPad.',
      requisitos: {
        obrigatorios: [
          '3+ anos de experiência com iOS',
          'Conhecimento em Swift',
          'Experiência com UIKit ou SwiftUI',
          'Conhecimento em Core Data',
        ],
        desejaveis: ['SwiftUI', 'Combine', 'Testes automatizados'],
      },
      atividades: {
        principais: [
          'Desenvolver apps iOS nativos',
          'Colaborar com equipe de design',
          'Otimizar performance',
          'Manter código limpo',
        ],
      },
      beneficios: {
        lista: ['Plano de saúde', 'Vale refeição', 'Home office', 'MacBook Pro'],
      },
      modalidade: ModalidadesDeVagas.HIBRIDO,
      regimeDeTrabalho: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.PLENO,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 1,
      salarioMin: '8000.00',
      salarioMax: '12000.00',
      modoAnonimo: false,
      destaque: false,
    },
    {
      empresa: empresasCriadas[1],
      titulo: 'Scrum Master',
      descricao:
        'Buscamos Scrum Master certificado para facilitar processos ágeis e melhorar entrega de valor.',
      requisitos: {
        obrigatorios: [
          'Certificação Scrum Master',
          '2+ anos de experiência como SM',
          'Conhecimento em metodologias ágeis',
          'Excelente comunicação',
        ],
        desejaveis: ['SAFe', 'Kanban', 'Coaching'],
      },
      atividades: {
        principais: [
          'Facilitar cerimônias ágeis',
          'Remover impedimentos',
          'Coaching de equipe',
          'Melhorar processos',
        ],
      },
      beneficios: {
        lista: ['Plano de saúde', 'Vale refeição', 'Home office'],
      },
      modalidade: ModalidadesDeVagas.HIBRIDO,
      regimeDeTrabalho: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.PLENO,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 1,
      salarioMin: '7000.00',
      salarioMax: '10000.00',
      modoAnonimo: false,
      destaque: false,
    },
    {
      empresa: empresasCriadas[2],
      titulo: 'Frontend Developer React',
      descricao:
        'Oportunidade para desenvolvedor Frontend React trabalhar em produtos inovadores com tecnologias modernas.',
      requisitos: {
        obrigatorios: [
          '2+ anos de experiência com React',
          'Conhecimento em TypeScript',
          'Experiência com CSS moderno',
          'Conhecimento em Git',
        ],
        desejaveis: ['Next.js', 'Testes', 'Storybook'],
      },
      atividades: {
        principais: [
          'Desenvolver interfaces React',
          'Trabalhar com Design System',
          'Otimizar performance',
          'Colaborar com equipe',
        ],
      },
      beneficios: {
        lista: ['Plano de saúde', 'Vale refeição', 'Home office'],
      },
      modalidade: ModalidadesDeVagas.REMOTO,
      regimeDeTrabalho: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.PLENO,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 2,
      salarioMin: '6000.00',
      salarioMax: '9000.00',
      modoAnonimo: false,
      destaque: false,
    },
    {
      empresa: empresasCriadas[3],
      titulo: 'Security Engineer',
      descricao:
        'Procuramos Security Engineer para garantir segurança de sistemas e infraestrutura cloud.',
      requisitos: {
        obrigatorios: [
          '4+ anos de experiência em segurança',
          'Conhecimento em segurança cloud',
          'Experiência com penetration testing',
          'Conhecimento em compliance',
        ],
        desejaveis: ['Certificações de segurança', 'SOC', 'SIEM'],
      },
      atividades: {
        principais: [
          'Implementar controles de segurança',
          'Realizar testes de segurança',
          'Monitorar ameaças',
          'Garantir compliance',
        ],
      },
      beneficios: {
        lista: ['Plano de saúde premium', 'Vale refeição', 'Home office'],
      },
      modalidade: ModalidadesDeVagas.REMOTO,
      regimeDeTrabalho: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.SENIOR,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 1,
      salarioMin: '12000.00',
      salarioMax: '18000.00',
      modoAnonimo: true, // MODO ANÔNIMO
      destaque: true,
    },
    {
      empresa: empresasCriadas[4],
      titulo: 'Business Intelligence Analyst',
      descricao:
        'Buscamos analista de BI para criar dashboards e relatórios estratégicos para tomada de decisão.',
      requisitos: {
        obrigatorios: [
          '2+ anos de experiência em BI',
          'Conhecimento em SQL',
          'Experiência com Power BI ou Tableau',
          'Conhecimento em ETL',
        ],
        desejaveis: ['Python', 'Data Warehouse', 'OLAP'],
      },
      atividades: {
        principais: [
          'Criar dashboards e relatórios',
          'Desenvolver modelos de dados',
          'Trabalhar com stakeholders',
          'Analisar métricas de negócio',
        ],
      },
      beneficios: {
        lista: ['Plano de saúde', 'Vale refeição', 'Home office'],
      },
      modalidade: ModalidadesDeVagas.HIBRIDO,
      regimeDeTrabalho: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.PLENO,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 1,
      salarioMin: '6500.00',
      salarioMax: '9500.00',
      modoAnonimo: false,
      destaque: false,
    },
    {
      empresa: empresasCriadas[0],
      titulo: 'Tech Lead Backend',
      descricao:
        'Oportunidade para Tech Lead Backend liderar equipe técnica e definir arquitetura de sistemas.',
      requisitos: {
        obrigatorios: [
          '6+ anos de experiência com backend',
          'Experiência em liderança técnica',
          'Conhecimento em arquitetura de sistemas',
          'Excelente comunicação',
        ],
        desejaveis: ['Microserviços', 'Event-driven', 'Domain-driven design'],
      },
      atividades: {
        principais: [
          'Liderar equipe técnica',
          'Definir arquitetura',
          'Code reviews e mentorias',
          'Tomar decisões técnicas',
        ],
      },
      beneficios: {
        lista: ['Plano de saúde premium', 'Vale refeição', 'Home office', 'Stock options'],
      },
      modalidade: ModalidadesDeVagas.HIBRIDO,
      regimeDeTrabalho: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.LIDER,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 1,
      salarioMin: '18000.00',
      salarioMax: '25000.00',
      modoAnonimo: false,
      destaque: true,
    },
    {
      empresa: empresasCriadas[1],
      titulo: 'Estagiário de Desenvolvimento',
      descricao:
        'Oportunidade de estágio para estudantes de TI aprenderem desenvolvimento web em ambiente real.',
      requisitos: {
        obrigatorios: [
          'Cursando Ciência da Computação ou áreas afins',
          'A partir do 3º semestre',
          'Conhecimento básico em programação',
          'Disponibilidade de 6h/dia',
        ],
        desejaveis: ['Conhecimento em JavaScript', 'Git', 'Inglês'],
      },
      atividades: {
        principais: [
          'Aprender desenvolvimento web',
          'Auxiliar em projetos',
          'Participar de code reviews',
          'Estudar tecnologias modernas',
        ],
      },
      beneficios: {
        lista: ['Bolsa-auxílio', 'Vale refeição', 'Vale transporte', 'Mentoria'],
      },
      modalidade: ModalidadesDeVagas.PRESENCIAL,
      regimeDeTrabalho: RegimesDeTrabalhos.ESTAGIO,
      senioridade: Senioridade.ESTAGIARIO,
      jornada: Jornadas.MEIO_PERIODO,
      numeroVagas: 3,
      salarioMin: '1500.00',
      salarioMax: '2000.00',
      modoAnonimo: false,
      destaque: false,
    },
    {
      empresa: empresasCriadas[2],
      titulo: 'Site Reliability Engineer (SRE)',
      descricao: 'Buscamos SRE para garantir confiabilidade e performance de sistemas em produção.',
      requisitos: {
        obrigatorios: [
          '3+ anos de experiência como SRE ou DevOps',
          'Conhecimento em monitoramento',
          'Experiência com incidentes',
          'Conhecimento em automação',
        ],
        desejaveis: ['Prometheus', 'Grafana', 'PagerDuty'],
      },
      atividades: {
        principais: [
          'Garantir confiabilidade de sistemas',
          'Responder a incidentes',
          'Automatizar operações',
          'Melhorar observabilidade',
        ],
      },
      beneficios: {
        lista: ['Plano de saúde', 'Vale refeição', 'Home office'],
      },
      modalidade: ModalidadesDeVagas.REMOTO,
      regimeDeTrabalho: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.PLENO,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 1,
      salarioMin: '9000.00',
      salarioMax: '13000.00',
      modoAnonimo: true, // MODO ANÔNIMO
      destaque: false,
    },
    {
      empresa: empresasCriadas[3],
      titulo: 'Machine Learning Engineer',
      descricao:
        'Procuramos ML Engineer para desenvolver e deployar modelos de machine learning em produção.',
      requisitos: {
        obrigatorios: [
          '3+ anos de experiência com ML',
          'Conhecimento em Python',
          'Experiência com frameworks ML',
          'Conhecimento em MLOps',
        ],
        desejaveis: ['TensorFlow', 'PyTorch', 'Kubernetes'],
      },
      atividades: {
        principais: [
          'Desenvolver modelos de ML',
          'Fazer deploy em produção',
          'Monitorar performance de modelos',
          'Otimizar pipelines',
        ],
      },
      beneficios: {
        lista: ['Plano de saúde', 'Vale refeição', 'Home office', 'Cursos'],
      },
      modalidade: ModalidadesDeVagas.REMOTO,
      regimeDeTrabalho: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.PLENO,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 1,
      salarioMin: '11000.00',
      salarioMax: '16000.00',
      modoAnonimo: false,
      destaque: false,
    },
    {
      empresa: empresasCriadas[4],
      titulo: 'Full Stack Developer Pleno',
      descricao:
        'Oportunidade para desenvolvedor Full Stack trabalhar em produtos end-to-end com tecnologias modernas.',
      requisitos: {
        obrigatorios: [
          '3+ anos de experiência Full Stack',
          'Conhecimento em React e Node.js',
          'Experiência com bancos de dados',
          'Conhecimento em APIs REST',
        ],
        desejaveis: ['TypeScript', 'GraphQL', 'Docker'],
      },
      atividades: {
        principais: [
          'Desenvolver features completas',
          'Trabalhar com frontend e backend',
          'Participar de decisões técnicas',
          'Colaborar com equipe',
        ],
      },
      beneficios: {
        lista: ['Plano de saúde', 'Vale refeição', 'Home office'],
      },
      modalidade: ModalidadesDeVagas.HIBRIDO,
      regimeDeTrabalho: RegimesDeTrabalhos.CLT,
      senioridade: Senioridade.PLENO,
      jornada: Jornadas.INTEGRAL,
      numeroVagas: 2,
      salarioMin: '7000.00',
      salarioMax: '11000.00',
      modoAnonimo: false,
      destaque: false,
    },
  ];

  // Selecionar área e subárea padrão
  const areaPadrao = areas[0];
  const subareaPadrao = areaPadrao?.CandidatosSubareasInteresse[0];

  // Criar mapeamento de empresaId -> dados da empresa (cidade, estado)
  const empresasMap = new Map();
  empresas.forEach((emp, index) => {
    if (empresasCriadas[index]) {
      empresasMap.set(empresasCriadas[index].id, { cidade: emp.cidade, estado: emp.estado });
    }
  });

  for (const vaga of vagas) {
    try {
      const timestamp = Date.now().toString();
      const codigo = `V${timestamp.slice(-5)}`;
      const slugBase = vaga.titulo
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .substring(0, 50);
      const slug = `${slugBase}-${codigo.toLowerCase()}`;

      const vagaDb = await client.empresasVagas.create({
        data: {
          id: randomUUID(),
          codigo,
          slug,
          usuarioId: vaga.empresa.id,
          titulo: vaga.titulo,
          descricao: vaga.descricao,
          requisitos: vaga.requisitos,
          atividades: vaga.atividades,
          beneficios: vaga.beneficios,
          areaInteresseId: areaPadrao?.id,
          subareaInteresseId: subareaPadrao?.id,
          modalidade: vaga.modalidade,
          regimeDeTrabalho: vaga.regimeDeTrabalho,
          senioridade: vaga.senioridade,
          jornada: vaga.jornada,
          numeroVagas: vaga.numeroVagas,
          salarioMin: vaga.salarioMin,
          salarioMax: vaga.salarioMax,
          salarioConfidencial: false,
          modoAnonimo: vaga.modoAnonimo,
          destaque: vaga.destaque,
          status: StatusDeVagas.PUBLICADO,
          localizacao: (() => {
            const empresaInfo = empresasMap.get(vaga.empresa.id);
            return {
              cidade: empresaInfo?.cidade || 'São Paulo',
              estado: empresaInfo?.estado || 'SP',
            };
          })(),
          inscricoesAte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
          inseridaEm: new Date(),
          atualizadoEm: new Date(),
        },
      });

      // Armazenar vaga com os dados que precisamos para o resumo
      vagasCriadas.push({
        id: vagaDb.id,
        titulo: vagaDb.titulo,
        modoAnonimo: vagaDb.modoAnonimo,
        destaque: vagaDb.destaque,
      });
      const modoAnonimoLabel = vaga.modoAnonimo ? ' [ANÔNIMO]' : '';
      console.log(`  ✅ Vaga criada: ${vaga.titulo}${modoAnonimoLabel}`);
    } catch (error: any) {
      console.error(`  ❌ Erro ao criar vaga ${vaga.titulo}:`, error.message);
    }
  }

  console.log(`\n✨ ${vagasCriadas.length} vagas criadas!\n`);

  // ============================================
  // 4. CRIAR CERTIFICADOS
  // ============================================
  console.log('🎓 Criando certificados...');

  // Buscar inscrições existentes que podem receber certificados
  const inscricoes = await client.cursosTurmasInscricoes.findMany({
    where: {
      status: StatusInscricao.CONCLUIDO,
    },
    include: {
      Usuarios: {
        select: {
          id: true,
          nomeCompleto: true,
          cpf: true,
        },
      },
      CursosTurmas: {
        include: {
          Cursos: {
            select: {
              id: true,
              nome: true,
              cargaHoraria: true,
            },
          },
        },
      },
    },
    take: 10, // Criar certificados para até 10 inscrições
  });

  if (inscricoes.length === 0) {
    console.log('  ⚠️  Nenhuma inscrição aprovada encontrada. Certificados não serão criados.');
  } else {
    const certificadosCriados: any[] = [];

    for (const inscricao of inscricoes) {
      try {
        // Verificar se já existe certificado para esta inscrição
        const certificadoExistente = await client.cursosCertificadosEmitidos.findFirst({
          where: { inscricaoId: inscricao.id },
        });

        if (certificadoExistente) {
          console.log(`  ⏭️  Certificado já existe para inscrição ${inscricao.id}`);
          continue;
        }

        // Gerar código único
        const codigo = `CERT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

        const cargaHoraria = inscricao.CursosTurmas.Cursos.cargaHoraria || 80;

        const certificado = await client.cursosCertificadosEmitidos.create({
          data: {
            id: randomUUID(),
            inscricaoId: inscricao.id,
            codigo,
            tipo: CursosCertificados.CONCLUSAO,
            formato: CursosCertificadosTipos.DIGITAL,
            cargaHoraria,
            alunoNome: inscricao.Usuarios.nomeCompleto,
            alunoCpf: inscricao.Usuarios.cpf,
            cursoNome: inscricao.CursosTurmas.Cursos.nome,
            turmaNome: inscricao.CursosTurmas.nome,
            emitidoEm: new Date(),
            CursosCertificadosLogs: {
              create: {
                acao: CursosCertificadosLogAcao.EMISSAO,
                formato: CursosCertificadosTipos.DIGITAL,
                detalhes: 'Certificado criado via seed',
              },
            },
          },
        });

        certificadosCriados.push(certificado);
        console.log(
          `  ✅ Certificado criado: ${inscricao.Usuarios.nomeCompleto} - ${inscricao.CursosTurmas.Cursos.nome}`,
        );
      } catch (error: any) {
        console.error(
          `  ❌ Erro ao criar certificado para inscrição ${inscricao.id}:`,
          error.message,
        );
      }
    }

    console.log(`\n✨ ${certificadosCriados.length} certificados criados!\n`);
  }

  console.log('✅ Seed completo finalizado!');
  console.log(`\n📊 Resumo:`);
  console.log(`   - ${empresasCriadas.length} empresas criadas`);
  console.log(`   - ${vagasCriadas.length} vagas criadas`);

  // Contar vagas anônimas e em destaque
  const vagasAnonimas = vagasCriadas.filter((v) => v.modoAnonimo === true).length;
  const vagasDestaque = vagasCriadas.filter((v) => v.destaque === true).length;
  console.log(`   - ${vagasAnonimas} vagas em modo anônimo`);
  console.log(`   - ${vagasDestaque} vagas em destaque`);

  return {
    empresas: empresasCriadas,
    vagas: vagasCriadas,
  };
}

// Se executado diretamente
if (require.main === module) {
  const prisma = new PrismaClient();
  seedEmpresasVagasCertificados(prisma)
    .then(() => {
      console.log('\n✅ Seed completo concluído com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Erro no seed completo:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
