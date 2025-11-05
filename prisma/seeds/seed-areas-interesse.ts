/**
 * Seed de Áreas de Interesse - Cria áreas e subáreas para candidatos e vagas
 */

import { PrismaClient, CandidatosAreasInteresse } from '@prisma/client';

interface AreaSeed {
  categoria: string;
  subareas: string[];
}

const areas: AreaSeed[] = [
  {
    categoria: 'Tecnologia da Informação',
    subareas: [
      'Desenvolvimento Front-end',
      'Desenvolvimento Back-end',
      'Desenvolvimento Full Stack',
      'DevOps',
      'Segurança da Informação',
      'Infraestrutura de TI',
      'Suporte Técnico',
      'Análise de Dados',
      'Business Intelligence',
      'Banco de Dados',
    ],
  },
  {
    categoria: 'Recursos Humanos',
    subareas: [
      'Recrutamento e Seleção',
      'Treinamento e Desenvolvimento',
      'Gestão de Pessoas',
      'Departamento Pessoal',
      'Remuneração e Benefícios',
      'Comunicação Interna',
    ],
  },
  {
    categoria: 'Marketing e Comunicação',
    subareas: [
      'Marketing Digital',
      'Social Media',
      'Copywriting',
      'SEO/SEM',
      'Design Gráfico',
      'Branding',
      'Relações Públicas',
      'Produção de Conteúdo',
    ],
  },
  {
    categoria: 'Vendas e Comercial',
    subareas: [
      'Vendas B2B',
      'Vendas B2C',
      'Inside Sales',
      'Key Account',
      'Pré-vendas',
      'Customer Success',
      'E-commerce',
    ],
  },
  {
    categoria: 'Administração e Finanças',
    subareas: [
      'Controladoria',
      'Contabilidade',
      'Tesouraria',
      'Auditoria',
      'Planejamento Financeiro',
      'Contas a Pagar',
      'Contas a Receber',
      'Fiscal',
    ],
  },
  {
    categoria: 'Engenharia',
    subareas: [
      'Engenharia Civil',
      'Engenharia Mecânica',
      'Engenharia Elétrica',
      'Engenharia de Produção',
      'Engenharia de Qualidade',
      'Engenharia de Projetos',
    ],
  },
  {
    categoria: 'Saúde',
    subareas: [
      'Enfermagem',
      'Farmácia',
      'Fisioterapia',
      'Nutrição',
      'Psicologia',
      'Medicina',
      'Análises Clínicas',
    ],
  },
  {
    categoria: 'Educação',
    subareas: [
      'Ensino Fundamental',
      'Ensino Médio',
      'Ensino Superior',
      'Educação Infantil',
      'Educação a Distância',
      'Coordenação Pedagógica',
      'Orientação Educacional',
    ],
  },
  {
    categoria: 'Logística e Operações',
    subareas: [
      'Armazenagem',
      'Distribuição',
      'Transportes',
      'Compras',
      'Supply Chain',
      'Planejamento Logístico',
      'Expedição',
    ],
  },
  {
    categoria: 'Jurídico',
    subareas: [
      'Direito Trabalhista',
      'Direito Tributário',
      'Direito Empresarial',
      'Contratos',
      'Compliance',
      'Advocacia Corporativa',
    ],
  },
];

export async function seedAreasInteresse(prisma?: PrismaClient) {
  const client = prisma || new PrismaClient();
  console.log('🌱 Iniciando seed de áreas de interesse...');

  const areasCriadas: CandidatosAreasInteresse[] = [];

  for (const area of areas) {
    try {
      console.log(`  📁 Criando área: ${area.categoria}`);

      // Verificar se área já existe
      let areaDb = await client.candidatosAreasInteresse.findFirst({
        where: { categoria: area.categoria },
      });

      if (!areaDb) {
        // Criar área se não existir
        areaDb = await client.candidatosAreasInteresse.create({
          data: {
            categoria: area.categoria,
            atualizadoEm: new Date(),
          },
        });
      }

      // Criar subáreas
      for (const subareaNome of area.subareas) {
        // Verificar se subárea já existe
        const existingSubarea = await client.candidatosSubareasInteresse.findFirst({
          where: {
            areaId: areaDb.id,
            nome: subareaNome,
          },
        });

        if (!existingSubarea) {
          await client.candidatosSubareasInteresse.create({
            data: {
              areaId: areaDb.id,
              nome: subareaNome,
              atualizadoEm: new Date(),
            },
          });
        }
      }

      areasCriadas.push(areaDb);
      console.log(`  ✅ Área criada: ${area.categoria} (${area.subareas.length} subáreas)`);
    } catch (error: any) {
      console.error(`  ❌ Erro ao criar área ${area.categoria}:`, error.message);
    }
  }

  console.log(`\n✨ ${areasCriadas.length} áreas de interesse criadas com sucesso!\n`);

  return areasCriadas;
}

// Se executado diretamente
if (require.main === module) {
  const prisma = new PrismaClient();
  seedAreasInteresse(prisma)
    .then(() => {
      console.log('✅ Seed de áreas de interesse concluído');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro no seed de áreas de interesse:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
