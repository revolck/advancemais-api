import { PrismaClient } from '@prisma/client';

export interface CandidateInterestAreaSeed {
  id: number;
  categoria: string;
  subareas: string[];
}

export const CANDIDATE_INTEREST_AREAS: CandidateInterestAreaSeed[] = [
  {
    id: 1,
    categoria: 'Administração e Escritório',
    subareas: [
      'Administração Geral',
      'Secretariado',
      'Recepção',
      'Compras / Suprimentos',
      'Planejamento / Estratégia',
    ],
  },
  {
    id: 2,
    categoria: 'Atendimento ao Cliente',
    subareas: ['Call Center', 'SAC / Pós-Venda', 'Vendas Internas', 'Suporte Técnico'],
  },
  {
    id: 3,
    categoria: 'Comercial e Vendas',
    subareas: ['Representação Comercial', 'Varejo', 'Merchandising', 'Prospecção / Negociação'],
  },
  {
    id: 4,
    categoria: 'Comunicação e Marketing',
    subareas: ['Marketing Digital', 'Publicidade / Propaganda', 'Relações Públicas', 'Eventos'],
  },
  {
    id: 5,
    categoria: 'Tecnologia da Informação',
    subareas: [
      'Desenvolvimento de Software',
      'Infraestrutura / Redes',
      'Segurança da Informação',
      'UX/UI Design',
      'Suporte / Help Desk',
    ],
  },
  {
    id: 6,
    categoria: 'Engenharia e Produção',
    subareas: [
      'Engenharia Civil',
      'Engenharia Mecânica',
      'Engenharia Elétrica',
      'Produção / Manufatura',
      'Manutenção Industrial',
    ],
  },
  {
    id: 7,
    categoria: 'Financeiro e Contábil',
    subareas: ['Contabilidade', 'Controladoria', 'Tesouraria', 'Planejamento Financeiro'],
  },
  {
    id: 8,
    categoria: 'Recursos Humanos',
    subareas: ['Recrutamento e Seleção', 'Treinamento e Desenvolvimento', 'Departamento Pessoal'],
  },
  {
    id: 9,
    categoria: 'Logística',
    subareas: ['Transporte', 'Armazenagem', 'Distribuição', 'Comércio Exterior'],
  },
  {
    id: 10,
    categoria: 'Jurídico',
    subareas: ['Direito Empresarial', 'Direito Trabalhista', 'Compliance'],
  },
  {
    id: 11,
    categoria: 'Saúde',
    subareas: ['Enfermagem', 'Medicina', 'Farmácia', 'Fisioterapia', 'Psicologia'],
  },
  {
    id: 12,
    categoria: 'Educação',
    subareas: [
      'Ensino Fundamental e Médio',
      'Ensino Superior',
      'Cursos Técnicos',
      'Treinamentos Corporativos',
    ],
  },
  {
    id: 13,
    categoria: 'Serviços Operacionais',
    subareas: ['Limpeza', 'Portaria / Segurança', 'Produção / Operação de Máquinas'],
  },
  {
    id: 14,
    categoria: 'Design e Criatividade',
    subareas: ['Design Gráfico', 'Moda', 'Fotografia', 'Audiovisual'],
  },
  {
    id: 15,
    categoria: 'Meio Ambiente e Sustentabilidade',
    subareas: ['Gestão Ambiental', 'Projetos Socioambientais'],
  },
  {
    id: 16,
    categoria: 'Agro, Alimentação e Bebidas',
    subareas: ['Agronegócio', 'Produção de Alimentos', 'Gastronomia', 'Nutrição'],
  },
  {
    id: 17,
    categoria: 'Construção Civil',
    subareas: ['Obra / Campo', 'Projetos / Planejamento'],
  },
  {
    id: 18,
    categoria: 'Transportes',
    subareas: ['Motorista / Entregador', 'Operação de Frota'],
  },
  {
    id: 19,
    categoria: 'Outros',
    subareas: ['Estágio / Primeiro Emprego', 'Programas de Trainee', 'Trabalho Voluntário'],
  },
];

export async function seedCandidateInterestAreas(prisma: PrismaClient): Promise<void> {
  const areaIds = CANDIDATE_INTEREST_AREAS.map((area) => area.id);

  await prisma.candidatosSubareasInteresse.deleteMany({
    where: {
      areaId: {
        notIn: areaIds,
      },
    },
  });

  await prisma.candidatosAreasInteresse.deleteMany({
    where: {
      id: {
        notIn: areaIds,
      },
    },
  });

  for (const area of CANDIDATE_INTEREST_AREAS) {
    await prisma.candidatosAreasInteresse.upsert({
      where: { id: area.id },
      update: {
        categoria: area.categoria,
        subareas: {
          deleteMany: {},
          create: area.subareas.map((nome) => ({ nome })),
        },
      },
      create: {
        id: area.id,
        categoria: area.categoria,
        subareas: {
          create: area.subareas.map((nome) => ({ nome })),
        },
      },
    });
  }
}
