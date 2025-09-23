import { PrismaClient, Prisma } from '@prisma/client';
import type {
  Usuarios,
  UsuariosCurriculos,
  Cursos,
  CursosTurmas,
  CursosTurmasMatriculas,
} from '@prisma/client';

import { seedCandidateInterestAreas } from './candidato/AreasDeInteresses';

const prisma = new PrismaClient();

interface CompanySeed {
  name: string;
  email: string;
  supabaseId: string;
  codUsuario: string;
  cnpj: string;
}

interface CandidateSeed {
  name: string;
  email: string;
  supabaseId: string;
  codUsuario: string;
  cpf: string;
}

interface AulaSeed {
  order: number;
  title: string;
  description: string;
  dayOffset: number;
  hour: number;
  durationHours: number;
}

interface TurmaSeed {
  code: string;
  name: string;
  turno: 'MANHA' | 'TARDE' | 'NOITE' | 'INTEGRAL';
  metodo: 'ONLINE' | 'PRESENCIAL' | 'LIVE' | 'SEMIPRESENCIAL';
  vagasTotais: number;
  startOffset: number;
  durationDays: number;
  aulas: AulaSeed[];
}

interface CourseSeed {
  code: string;
  name: string;
  description: string;
  cargaHoraria: number;
  turmas: TurmaSeed[];
}

const COMPANY_SEEDS: CompanySeed[] = [
  {
    name: 'Seed Ventures Tecnologia',
    email: 'contato+empresa1@advancemais.com',
    supabaseId: 'seed-empresa-1',
    codUsuario: 'SEEDCOMP1',
    cnpj: '11000000000101',
  },
  {
    name: 'InovaRH Consultoria',
    email: 'contato+empresa2@advancemais.com',
    supabaseId: 'seed-empresa-2',
    codUsuario: 'SEEDCOMP2',
    cnpj: '11000000000102',
  },
  {
    name: 'Futura Educação Corporativa',
    email: 'contato+empresa3@advancemais.com',
    supabaseId: 'seed-empresa-3',
    codUsuario: 'SEEDCOMP3',
    cnpj: '11000000000103',
  },
  {
    name: 'HealthCare Plus',
    email: 'contato+empresa4@advancemais.com',
    supabaseId: 'seed-empresa-4',
    codUsuario: 'SEEDCOMP4',
    cnpj: '11000000000104',
  },
  {
    name: 'LoggiX Distribuição',
    email: 'contato+empresa5@advancemais.com',
    supabaseId: 'seed-empresa-5',
    codUsuario: 'SEEDCOMP5',
    cnpj: '11000000000105',
  },
];

const CANDIDATE_SEEDS: CandidateSeed[] = [
  {
    name: 'Ana Paula Ribeiro',
    email: 'ana.ribeiro+seed@advancemais.com',
    supabaseId: 'seed-candidato-1',
    codUsuario: 'SEEDCAND1',
    cpf: '12345678901',
  },
  {
    name: 'Bruno Martins Souza',
    email: 'bruno.martins+seed@advancemais.com',
    supabaseId: 'seed-candidato-2',
    codUsuario: 'SEEDCAND2',
    cpf: '12345678902',
  },
  {
    name: 'Camila Ferreira Lopes',
    email: 'camila.lopes+seed@advancemais.com',
    supabaseId: 'seed-candidato-3',
    codUsuario: 'SEEDCAND3',
    cpf: '12345678903',
  },
  {
    name: 'Diego Nascimento Lima',
    email: 'diego.lima+seed@advancemais.com',
    supabaseId: 'seed-candidato-4',
    codUsuario: 'SEEDCAND4',
    cpf: '12345678904',
  },
  {
    name: 'Eduarda Campos Rocha',
    email: 'eduarda.rocha+seed@advancemais.com',
    supabaseId: 'seed-candidato-5',
    codUsuario: 'SEEDCAND5',
    cpf: '12345678905',
  },
];

const COURSE_SEEDS: CourseSeed[] = [
  {
    code: 'SCUR001',
    name: 'Seed - Fundamentos de Tecnologia',
    description:
      'Curso introdutório com foco em lógica de programação, ferramentas colaborativas e mindset ágil para quem está iniciando na área de tecnologia.',
    cargaHoraria: 40,
    turmas: [
      {
        code: 'STUR001A',
        name: 'Seed Turma 1A',
        turno: 'INTEGRAL',
        metodo: 'ONLINE',
        vagasTotais: 30,
        startOffset: 3,
        durationDays: 30,
        aulas: [
          {
            order: 1,
            title: 'Seed Aula 1: Boas-vindas e ferramentas',
            description: 'Apresentação do ambiente virtual, ferramentas colaborativas e dinâmica do curso.',
            dayOffset: 0,
            hour: 19,
            durationHours: 2,
          },
          {
            order: 2,
            title: 'Seed Aula 2: Introdução à lógica',
            description: 'Estruturas básicas, operadores e construção de algoritmos simples.',
            dayOffset: 2,
            hour: 19,
            durationHours: 2,
          },
          {
            order: 3,
            title: 'Seed Aula 3: Trabalhando em squads',
            description: 'Dinâmicas ágeis, papéis em times multidisciplinares e comunicação eficiente.',
            dayOffset: 5,
            hour: 19,
            durationHours: 2,
          },
        ],
      },
      {
        code: 'STUR001B',
        name: 'Seed Turma 1B',
        turno: 'MANHA',
        metodo: 'LIVE',
        vagasTotais: 25,
        startOffset: 10,
        durationDays: 25,
        aulas: [
          {
            order: 1,
            title: 'Seed Aula 1: Ferramentas colaborativas',
            description: 'Visão geral das ferramentas de produtividade utilizadas no curso.',
            dayOffset: 0,
            hour: 9,
            durationHours: 2,
          },
          {
            order: 2,
            title: 'Seed Aula 2: Algoritmos no dia a dia',
            description: 'Discussão de problemas comuns e como algoritmos os resolvem.',
            dayOffset: 3,
            hour: 9,
            durationHours: 2,
          },
        ],
      },
    ],
  },
  {
    code: 'SCUR002',
    name: 'Seed - Experiência do Usuário na Prática',
    description:
      'Imersão em pesquisa com usuários, prototipação com foco em acessibilidade e métricas de UX aplicadas a produtos digitais.',
    cargaHoraria: 60,
    turmas: [
      {
        code: 'STUR002A',
        name: 'Seed Turma 2A',
        turno: 'NOITE',
        metodo: 'SEMIPRESENCIAL',
        vagasTotais: 20,
        startOffset: 5,
        durationDays: 35,
        aulas: [
          {
            order: 1,
            title: 'Seed Aula 1: Pesquisa com usuários',
            description: 'Planejamento de entrevistas, definição de personas e análise de insights.',
            dayOffset: 0,
            hour: 19,
            durationHours: 3,
          },
          {
            order: 2,
            title: 'Seed Aula 2: Prototipação acessível',
            description: 'Construção de wireframes responsivos e diretrizes de acessibilidade.',
            dayOffset: 4,
            hour: 19,
            durationHours: 3,
          },
        ],
      },
      {
        code: 'STUR002B',
        name: 'Seed Turma 2B',
        turno: 'TARDE',
        metodo: 'ONLINE',
        vagasTotais: 25,
        startOffset: 14,
        durationDays: 28,
        aulas: [
          {
            order: 1,
            title: 'Seed Aula 1: Métricas de UX',
            description: 'Introdução a métricas comportamentais e satisfação do usuário.',
            dayOffset: 0,
            hour: 14,
            durationHours: 2,
          },
          {
            order: 2,
            title: 'Seed Aula 2: Testes de usabilidade',
            description: 'Planejamento e execução de testes moderados e não moderados.',
            dayOffset: 6,
            hour: 14,
            durationHours: 2,
          },
        ],
      },
    ],
  },
  {
    code: 'SCUR003',
    name: 'Seed - Dados para Tomada de Decisão',
    description:
      'Fundamentos de análise de dados, construção de dashboards interativos e storytelling orientado a dados para negócios.',
    cargaHoraria: 48,
    turmas: [
      {
        code: 'STUR003A',
        name: 'Seed Turma 3A',
        turno: 'MANHA',
        metodo: 'ONLINE',
        vagasTotais: 22,
        startOffset: 7,
        durationDays: 32,
        aulas: [
          {
            order: 1,
            title: 'Seed Aula 1: Cultura data-driven',
            description: 'Como estruturar times e projetos orientados a dados.',
            dayOffset: 0,
            hour: 8,
            durationHours: 2,
          },
          {
            order: 2,
            title: 'Seed Aula 2: Ferramentas de BI',
            description: 'Hands-on com ferramentas de Business Intelligence.',
            dayOffset: 5,
            hour: 8,
            durationHours: 2,
          },
        ],
      },
      {
        code: 'STUR003B',
        name: 'Seed Turma 3B',
        turno: 'NOITE',
        metodo: 'LIVE',
        vagasTotais: 18,
        startOffset: 18,
        durationDays: 24,
        aulas: [
          {
            order: 1,
            title: 'Seed Aula 1: Storytelling com dados',
            description: 'Estruturando narrativas e apresentações baseadas em dados.',
            dayOffset: 0,
            hour: 20,
            durationHours: 2,
          },
          {
            order: 2,
            title: 'Seed Aula 2: Indicadores de negócio',
            description: 'Definição e acompanhamento de KPIs relevantes.',
            dayOffset: 4,
            hour: 20,
            durationHours: 2,
          },
        ],
      },
    ],
  },
  {
    code: 'SCUR004',
    name: 'Seed - Marketing Digital 360º',
    description:
      'Planejamento de campanhas, produção de conteúdo, análise de funil e automação para geração de leads qualificados.',
    cargaHoraria: 36,
    turmas: [
      {
        code: 'STUR004A',
        name: 'Seed Turma 4A',
        turno: 'TARDE',
        metodo: 'ONLINE',
        vagasTotais: 28,
        startOffset: 4,
        durationDays: 26,
        aulas: [
          {
            order: 1,
            title: 'Seed Aula 1: Jornada de conteúdo',
            description: 'Construção de funil e storytelling para redes sociais.',
            dayOffset: 0,
            hour: 15,
            durationHours: 2,
          },
          {
            order: 2,
            title: 'Seed Aula 2: Automação de marketing',
            description: 'Configuração de fluxos e nutridores para leads.',
            dayOffset: 3,
            hour: 15,
            durationHours: 2,
          },
        ],
      },
      {
        code: 'STUR004B',
        name: 'Seed Turma 4B',
        turno: 'MANHA',
        metodo: 'SEMIPRESENCIAL',
        vagasTotais: 24,
        startOffset: 15,
        durationDays: 30,
        aulas: [
          {
            order: 1,
            title: 'Seed Aula 1: Métricas de aquisição',
            description: 'Como medir CAC, LTV e atribuição multi-touch.',
            dayOffset: 0,
            hour: 10,
            durationHours: 2,
          },
          {
            order: 2,
            title: 'Seed Aula 2: Growth frameworks',
            description: 'Aplicação de experimentos e análises de crescimento.',
            dayOffset: 6,
            hour: 10,
            durationHours: 2,
          },
        ],
      },
    ],
  },
  {
    code: 'SCUR005',
    name: 'Seed - Liderança Humanizada',
    description:
      'Desenvolvimento de habilidades socioemocionais, feedback contínuo e gestão de times híbridos com foco em resultados.',
    cargaHoraria: 32,
    turmas: [
      {
        code: 'STUR005A',
        name: 'Seed Turma 5A',
        turno: 'NOITE',
        metodo: 'ONLINE',
        vagasTotais: 26,
        startOffset: 6,
        durationDays: 21,
        aulas: [
          {
            order: 1,
            title: 'Seed Aula 1: Liderança empática',
            description: 'Práticas para criar ambientes psicológicos seguros.',
            dayOffset: 0,
            hour: 19,
            durationHours: 2,
          },
          {
            order: 2,
            title: 'Seed Aula 2: Feedback contínuo',
            description: 'Modelos de feedback e construção de planos de desenvolvimento.',
            dayOffset: 4,
            hour: 19,
            durationHours: 2,
          },
        ],
      },
      {
        code: 'STUR005B',
        name: 'Seed Turma 5B',
        turno: 'MANHA',
        metodo: 'PRESENCIAL',
        vagasTotais: 18,
        startOffset: 16,
        durationDays: 24,
        aulas: [
          {
            order: 1,
            title: 'Seed Aula 1: Times híbridos',
            description: 'Governança, rituais e ferramentas para equipes distribuídas.',
            dayOffset: 0,
            hour: 9,
            durationHours: 3,
          },
          {
            order: 2,
            title: 'Seed Aula 2: Cultura de desempenho',
            description: 'Como definir metas claras e acompanhar indicadores de performance.',
            dayOffset: 5,
            hour: 9,
            durationHours: 3,
          },
        ],
      },
    ],
  },
];

const CURRICULUM_IDS = [
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000202',
  '00000000-0000-4000-8000-000000000203',
  '00000000-0000-4000-8000-000000000204',
  '00000000-0000-4000-8000-000000000205',
];

interface SeededMatricula {
  matricula: CursosTurmasMatriculas;
  turma: CursosTurmas;
  curso: Cursos;
  aluno: Usuarios;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function withTime(base: Date, hour: number): Date {
  const result = new Date(base);
  result.setHours(hour, 0, 0, 0);
  return result;
}

async function seedUsuarios(prismaClient: PrismaClient): Promise<{
  companies: Usuarios[];
  candidates: Usuarios[];
}> {
  const companies = await Promise.all(
    COMPANY_SEEDS.map((company, index) =>
      prismaClient.usuarios.upsert({
        where: { email: company.email },
        update: {
          nomeCompleto: company.name,
          cnpj: company.cnpj,
          codUsuario: company.codUsuario,
        },
        create: {
          nomeCompleto: company.name,
          supabaseId: company.supabaseId,
          cpf: null,
          cnpj: company.cnpj,
          email: company.email,
          senha: 'Seed@123',
          codUsuario: company.codUsuario,
          tipoUsuario: 'PESSOA_JURIDICA',
          role: 'EMPRESA',
          status: 'ATIVO',
          ultimoLogin: addDays(new Date(), -index - 1),
        },
      })
    )
  );

  const candidates = await Promise.all(
    CANDIDATE_SEEDS.map((candidate, index) =>
      prismaClient.usuarios.upsert({
        where: { email: candidate.email },
        update: {
          nomeCompleto: candidate.name,
          cpf: candidate.cpf,
          codUsuario: candidate.codUsuario,
        },
        create: {
          nomeCompleto: candidate.name,
          supabaseId: candidate.supabaseId,
          cpf: candidate.cpf,
          cnpj: null,
          email: candidate.email,
          senha: 'Seed@123',
          codUsuario: candidate.codUsuario,
          tipoUsuario: 'PESSOA_FISICA',
          role: 'ALUNO_CANDIDATO',
          status: 'ATIVO',
          ultimoLogin: addDays(new Date(), -index - 1),
        },
      })
    )
  );

  return { companies, candidates };
}

async function seedCurriculos(
  prismaClient: PrismaClient,
  candidates: Usuarios[],
): Promise<Map<string, UsuariosCurriculos>> {
  const curriculos = new Map<string, UsuariosCurriculos>();

  await Promise.all(
    candidates.map((candidate) =>
      prismaClient.usuariosCurriculos.deleteMany({
        where: { usuarioId: candidate.id, titulo: { startsWith: 'Seed -' } },
      })
    )
  );

  await Promise.all(
    candidates.map((candidate, index) =>
      prismaClient.usuariosCurriculos
        .create({
          data: {
            id: CURRICULUM_IDS[index],
            usuarioId: candidate.id,
            titulo: 'Seed - Currículo Principal',
            resumo: `Resumo profissional de ${candidate.nomeCompleto} com foco em evolução de carreira e projetos colaborativos.`,
            objetivo: 'Atuar em projetos desafiadores que promovam impacto social positivo.',
            principal: true,
            areasInteresse: ['Tecnologia', 'UX', 'Dados'],
            preferencias: {
              local: 'Remoto',
              regime: 'CLT',
            },
            habilidades: ['Comunicação', 'Trabalho em equipe', 'Aprendizado contínuo'],
            idiomas: ['Português', 'Inglês'],
            experiencias: [
              {
                empresa: 'Experiência Seed',
                cargo: 'Analista',
                periodo: '2022 - 2024',
              },
            ],
            formacao: [
              {
                instituicao: 'Universidade Seed',
                curso: 'Bacharelado Interdisciplinar',
              },
            ],
          },
        })
        .then((curriculo) => {
          curriculos.set(candidate.id, curriculo);
        })
    )
  );

  return curriculos;
}

async function seedCursos(
  prismaClient: PrismaClient,
  candidates: Usuarios[],
  companies: Usuarios[],
): Promise<void> {
  const allTurmaCodes = COURSE_SEEDS.flatMap((course) => course.turmas.map((turma) => turma.code));

  await prismaClient.cursosTurmasAgenda.deleteMany({
    where: { turma: { codigo: { in: allTurmaCodes } }, titulo: { startsWith: 'Seed Agenda' } },
  });
  await prismaClient.cursosTurmasAulas.deleteMany({
    where: { turma: { codigo: { in: allTurmaCodes } }, nome: { startsWith: 'Seed Aula' } },
  });
  await prismaClient.cursosTurmasMatriculas.deleteMany({
    where: { turma: { codigo: { in: allTurmaCodes } }, alunoId: { in: candidates.map((candidate) => candidate.id) } },
  });

  const coursesById = new Map<number, Cursos>();
  const turmasById = new Map<string, CursosTurmas>();

  for (const courseSeed of COURSE_SEEDS) {
    const course = await prismaClient.cursos.upsert({
      where: { codigo: courseSeed.code },
      update: {
        nome: courseSeed.name,
        descricao: courseSeed.description,
        cargaHoraria: courseSeed.cargaHoraria,
        statusPadrao: 'PUBLICADO',
      },
      create: {
        codigo: courseSeed.code,
        nome: courseSeed.name,
        descricao: courseSeed.description,
        cargaHoraria: courseSeed.cargaHoraria,
        statusPadrao: 'PUBLICADO',
        estagioObrigatorio: false,
      },
    });

    coursesById.set(course.id, course);

    for (const turmaSeed of courseSeed.turmas) {
      const dataInicio = addDays(new Date(), turmaSeed.startOffset);
      const dataFim = addDays(dataInicio, turmaSeed.durationDays);
      const dataInscricaoInicio = addDays(dataInicio, -10);
      const dataInscricaoFim = addDays(dataInicio, -1);

      const turma = await prismaClient.cursosTurmas.upsert({
        where: { codigo: turmaSeed.code },
        update: {
          cursoId: course.id,
          nome: turmaSeed.name,
          turno: turmaSeed.turno,
          metodo: turmaSeed.metodo,
          vagasTotais: turmaSeed.vagasTotais,
          vagasDisponiveis: turmaSeed.vagasTotais,
          status: 'INSCRICOES_ABERTAS',
          dataInicio,
          dataFim,
          dataInscricaoInicio,
          dataInscricaoFim,
        },
        create: {
          codigo: turmaSeed.code,
          cursoId: course.id,
          nome: turmaSeed.name,
          turno: turmaSeed.turno,
          metodo: turmaSeed.metodo,
          vagasTotais: turmaSeed.vagasTotais,
          vagasDisponiveis: turmaSeed.vagasTotais,
          status: 'INSCRICOES_ABERTAS',
          dataInicio,
          dataFim,
          dataInscricaoInicio,
          dataInscricaoFim,
        },
      });

      turmasById.set(turma.id, turma);

      for (const aulaSeed of turmaSeed.aulas) {
        const aula = await prismaClient.cursosTurmasAulas.create({
          data: {
            turmaId: turma.id,
            nome: aulaSeed.title,
            descricao: aulaSeed.description,
            ordem: aulaSeed.order,
            urlVideo: 'https://videos.advancemais.com/seed/aula',
          },
        });

        const inicio = withTime(addDays(dataInicio, aulaSeed.dayOffset), aulaSeed.hour);
        const fim = new Date(inicio);
        fim.setHours(inicio.getHours() + aulaSeed.durationHours, inicio.getMinutes(), 0, 0);

        await prismaClient.cursosTurmasAgenda.create({
          data: {
            turmaId: turma.id,
            tipo: 'AULA',
            titulo: `Seed Agenda - ${aulaSeed.title}`,
            descricao: aulaSeed.description,
            inicio,
            fim,
            aulaId: aula.id,
          },
        });
      }
    }
  }

  const selectedTurmas = Array.from(turmasById.values()).slice(0, Math.min(5, turmasById.size));
  const seededMatriculas: SeededMatricula[] = [];

  for (let index = 0; index < selectedTurmas.length && index < candidates.length; index += 1) {
    const turma = selectedTurmas[index];
    const aluno = candidates[index];

    const matricula = await prismaClient.cursosTurmasMatriculas.create({
      data: {
        turmaId: turma.id,
        alunoId: aluno.id,
      },
    });

    const curso = coursesById.get(turma.cursoId);
    if (curso) {
      seededMatriculas.push({ matricula, turma, curso, aluno });
    }
  }

  const matriculasPorTurma = new Map<string, number>();
  for (const { turma } of seededMatriculas) {
    const count = matriculasPorTurma.get(turma.id) ?? 0;
    matriculasPorTurma.set(turma.id, count + 1);
  }

  await Promise.all(
    Array.from(matriculasPorTurma.entries()).map(([turmaId, count]) => {
      const turma = turmasById.get(turmaId);
      const vagasTotais = turma?.vagasTotais ?? 0;
      const vagasDisponiveis = Math.max(0, vagasTotais - count);

      return prismaClient.cursosTurmas.update({
        where: { id: turmaId },
        data: { vagasDisponiveis },
      });
    })
  );

  const certificateCodes = seededMatriculas.map((_, index) => `SCERT-00${index + 1}`);
  if (certificateCodes.length > 0) {
    await prismaClient.cursosCertificadosEmitidos.deleteMany({
      where: { codigo: { in: certificateCodes } },
    });
  }

  for (const [index, item] of seededMatriculas.entries()) {
    await prismaClient.cursosCertificadosEmitidos.create({
      data: {
        codigo: certificateCodes[index],
        matriculaId: item.matricula.id,
        tipo: 'CONCLUSAO',
        formato: 'DIGITAL',
        cargaHoraria: item.curso.cargaHoraria,
        alunoNome: item.aluno.nomeCompleto,
        alunoCpf: item.aluno.cpf,
        cursoNome: item.curso.nome,
        turmaNome: item.turma.nome,
        emitidoPorId: companies[0]?.id,
        observacoes: 'Certificado emitido automaticamente para fins de demonstração.',
      },
    });
  }
}

async function seedVagas(
  prismaClient: PrismaClient,
  companies: Usuarios[],
  candidates: Usuarios[],
  candidateCurriculos: Map<string, UsuariosCurriculos>,
): Promise<void> {
  if (companies.length === 0) {
    return;
  }

  const interestArea = await prismaClient.candidatosAreasInteresse.findFirst({
    include: { subareas: true },
  });

  if (!interestArea || interestArea.subareas.length === 0) {
    throw new Error('Nenhuma área de interesse cadastrada para vincular às vagas.');
  }

  const vacancySeeds = [
    {
      code: 'SV0001',
      slug: 'seed-desenvolvedor-fullstack-jr',
      title: 'Desenvolvedor(a) Full Stack Jr',
      regime: 'CLT',
      modalidade: 'HIBRIDO',
      jornada: 'INTEGRAL',
      senioridade: 'JUNIOR',
      salarioMin: new Prisma.Decimal(3500),
      salarioMax: new Prisma.Decimal(5500),
      descricao:
        'Atuação em produtos digitais com foco em performance, acessibilidade e colaboração com times multidisciplinares.',
    },
    {
      code: 'SV0002',
      slug: 'seed-analista-dados-pleno',
      title: 'Analista de Dados Pleno',
      regime: 'CLT',
      modalidade: 'REMOTO',
      jornada: 'INTEGRAL',
      senioridade: 'PLENO',
      salarioMin: new Prisma.Decimal(5200),
      salarioMax: new Prisma.Decimal(7200),
      descricao:
        'Construção de dashboards, governança de dados e suporte a decisões estratégicas com storytelling.',
    },
    {
      code: 'SV0003',
      slug: 'seed-especialista-ux',
      title: 'Especialista em UX Research',
      regime: 'PJ',
      modalidade: 'HIBRIDO',
      jornada: 'MEIO_PERIODO',
      senioridade: 'SENIOR',
      salarioMin: new Prisma.Decimal(7000),
      salarioMax: new Prisma.Decimal(9800),
      descricao:
        'Responsável por liderar pesquisas qualitativas e quantitativas, consolidando aprendizados com o time de produto.',
    },
    {
      code: 'SV0004',
      slug: 'seed-coordenador-marketing',
      title: 'Coordenador(a) de Marketing Digital',
      regime: 'CLT',
      modalidade: 'PRESENCIAL',
      jornada: 'INTEGRAL',
      senioridade: 'PLENO',
      salarioMin: new Prisma.Decimal(6000),
      salarioMax: new Prisma.Decimal(8500),
      descricao:
        'Gestão de campanhas 360º, acompanhamento de KPIs e liderança de squad multidisciplinar de growth.',
    },
    {
      code: 'SV0005',
      slug: 'seed-analista-rh-generalista',
      title: 'Analista de RH Generalista',
      regime: 'CLT',
      modalidade: 'HIBRIDO',
      jornada: 'INTEGRAL',
      senioridade: 'PLENO',
      salarioMin: new Prisma.Decimal(3800),
      salarioMax: new Prisma.Decimal(5200),
      descricao:
        'Condução de processos seletivos, trilhas de desenvolvimento e projetos de clima organizacional.',
    },
  ];

  const vacancyCodes = vacancySeeds.map((vacancy) => vacancy.code);

  await prismaClient.empresasCandidatos.deleteMany({
    where: { vaga: { codigo: { in: vacancyCodes } } },
  });
  await prismaClient.empresasVagasProcesso.deleteMany({
    where: { vaga: { codigo: { in: vacancyCodes } } },
  });

  const vagas = await Promise.all(
    vacancySeeds.map((vacancy, index) => {
      const company = companies[index % companies.length];
      const area = interestArea;
      const subarea = interestArea.subareas[index % interestArea.subareas.length];

      return prismaClient.empresasVagas.upsert({
        where: { codigo: vacancy.code },
        update: {
          slug: vacancy.slug,
          usuarioId: company.id,
          areaInteresseId: area.id,
          subareaInteresseId: subarea.id,
          regimeDeTrabalho: vacancy.regime,
          modalidade: vacancy.modalidade,
          titulo: vacancy.title,
          numeroVagas: 2,
          descricao: vacancy.descricao,
          requisitos: ['Experiência colaborativa', 'Boa comunicação escrita e verbal'],
          atividades: ['Participar de rituais ágeis', 'Documentar aprendizados e métricas-chave'],
          beneficios: ['Plano de saúde', 'Auxílio home office', 'Gympass'],
          observacoes: 'Vaga destinada também para pessoas candidatas PCD.',
          jornada: vacancy.jornada,
          senioridade: vacancy.senioridade,
          inscricoesAte: addDays(new Date(), 30),
          status: 'PUBLICADO',
          localizacao: {
            cidade: 'São Paulo',
            estado: 'SP',
            formato: vacancy.modalidade,
          },
          salarioMin: vacancy.salarioMin,
          salarioMax: vacancy.salarioMax,
          salarioConfidencial: false,
          destaque: index === 0,
        },
        create: {
          codigo: vacancy.code,
          slug: vacancy.slug,
          usuarioId: company.id,
          areaInteresseId: area.id,
          subareaInteresseId: subarea.id,
          regimeDeTrabalho: vacancy.regime,
          modalidade: vacancy.modalidade,
          titulo: vacancy.title,
          numeroVagas: 2,
          descricao: vacancy.descricao,
          requisitos: ['Experiência colaborativa', 'Boa comunicação escrita e verbal'],
          atividades: ['Participar de rituais ágeis', 'Documentar aprendizados e métricas-chave'],
          beneficios: ['Plano de saúde', 'Auxílio home office', 'Gympass'],
          observacoes: 'Vaga destinada também para pessoas candidatas PCD.',
          jornada: vacancy.jornada,
          senioridade: vacancy.senioridade,
          inscricoesAte: addDays(new Date(), 30),
          status: 'PUBLICADO',
          localizacao: {
            cidade: 'São Paulo',
            estado: 'SP',
            formato: vacancy.modalidade,
          },
          salarioMin: vacancy.salarioMin,
          salarioMax: vacancy.salarioMax,
          salarioConfidencial: false,
          maxCandidaturasPorUsuario: 3,
          destaque: index === 0,
          modoAnonimo: false,
          paraPcd: true,
        },
      });
    })
  );

  const candidaturas = candidates.slice(0, Math.min(5, vagas.length));

  await Promise.all(
    candidaturas.map((candidate, index) => {
      const vaga = vagas[index % vagas.length];
      const curriculo = candidateCurriculos.get(candidate.id);
      if (!curriculo) {
        return Promise.resolve();
      }

      return prismaClient.empresasCandidatos.create({
        data: {
          vagaId: vaga.id,
          candidatoId: candidate.id,
          curriculoId: curriculo.id,
          empresaUsuarioId: vaga.usuarioId,
          status: index % 2 === 0 ? 'EM_ANALISE' : 'RECEBIDA',
          origem: 'SITE',
          consentimentos: { newsletter: true },
        },
      });
    })
  );
}

async function main(): Promise<void> {
  await seedCandidateInterestAreas(prisma);
  const { companies, candidates } = await seedUsuarios(prisma);
  const candidateCurriculos = await seedCurriculos(prisma, candidates);
  await seedCursos(prisma, candidates, companies);
  await seedVagas(prisma, companies, candidates, candidateCurriculos);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.info('Seed concluído com sucesso.');
  })
  .catch(async (error) => {
    console.error('Erro ao executar seed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
