/**
 * Seed de Currículos e Candidaturas
 */

import { PrismaClient, Roles, UsuariosCurriculos, EmpresasCandidatos } from '@prisma/client';
import { randomUUID } from 'crypto';

export async function seedCurriculosCandidaturas(prisma?: PrismaClient) {
  const client = prisma || new PrismaClient();
  console.log('🌱 Iniciando seed de currículos e candidaturas...');

  // Buscar candidatos
  const candidatos = await client.usuarios.findMany({
    where: { role: Roles.ALUNO_CANDIDATO },
  });

  if (candidatos.length === 0) {
    console.log('  ⚠️  Nenhum candidato encontrado. Execute seed-usuarios.ts primeiro.');
    return { curriculos: [], candidaturas: [] };
  }

  // Buscar vagas publicadas
  const vagas = await client.empresasVagas.findMany({
    where: { status: 'PUBLICADO' },
    take: 5,
  });

  if (vagas.length === 0) {
    console.log('  ⚠️  Nenhuma vaga encontrada. Execute seed-vagas.ts primeiro.');
    return { curriculos: [], candidaturas: [] };
  }

  const curriculosCriados: UsuariosCurriculos[] = [];
  const candidaturasCriadas: EmpresasCandidatos[] = [];

  // Criar currículos para cada candidato
  for (const candidato of candidatos) {
    try {
      console.log(`  📄 Criando currículo para: ${candidato.nomeCompleto}`);

      const curriculo = await client.usuariosCurriculos.create({
        data: {
          id: randomUUID(),
          usuarioId: candidato.id,
          titulo: `Currículo de ${candidato.nomeCompleto}`,
          resumo: `Profissional com experiência na área de ${['Tecnologia', 'Marketing', 'RH', 'Vendas'][Math.floor(Math.random() * 4)]}`,
          objetivo: 'Crescimento profissional e desenvolvimento de novas habilidades',
          principal: true,
          atualizadoEm: new Date(),
          areasInteresse: {
            primaria: 'Tecnologia da Informação',
            secundarias: ['Marketing Digital', 'Gestão de Projetos'],
          },
          habilidades: {
            tecnicas: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Git', 'Metodologias Ágeis'],
            comportamentais: [
              'Comunicação',
              'Trabalho em equipe',
              'Proatividade',
              'Resolução de problemas',
            ],
          },
          idiomas: [
            {
              idioma: 'Português',
              nivel: 'Nativo',
            },
            {
              idioma: 'Inglês',
              nivel: Math.random() > 0.5 ? 'Avançado' : 'Intermediário',
            },
          ],
          experiencias: [
            {
              cargo: 'Desenvolvedor Full Stack',
              empresa: 'Tech Company LTDA',
              dataInicio: '2021-01-15',
              dataFim: '2023-06-30',
              atual: false,
              descricao: 'Desenvolvimento de aplicações web utilizando React, Node.js e PostgreSQL',
              principais_atividades: [
                'Desenvolvimento de features',
                'Code review',
                'Manutenção de sistemas legados',
              ],
            },
            {
              cargo: 'Desenvolvedor Junior',
              empresa: 'Startup XYZ',
              dataInicio: '2019-03-01',
              dataFim: '2020-12-31',
              atual: false,
              descricao: 'Desenvolvimento front-end com React e integração com APIs REST',
              principais_atividades: [
                'Criação de componentes React',
                'Integração com APIs',
                'Testes unitários',
              ],
            },
          ],
          formacao: [
            {
              instituicao: 'Universidade de São Paulo',
              curso: 'Ciência da Computação',
              nivel: 'Graduação',
              dataInicio: '2015-02-01',
              dataFim: '2019-12-15',
              status: 'CONCLUIDO',
              descricao: 'Bacharelado em Ciência da Computação',
            },
          ],
          cursosCertificacoes: [
            {
              nome: 'AWS Certified Solutions Architect',
              instituicao: 'Amazon Web Services',
              dataEmissao: '2022-06-15',
              dataValidade: '2025-06-15',
              credencial: 'AWS-CSA-2022',
            },
          ],
        },
      });

      curriculosCriados.push(curriculo);
      console.log(`  ✅ Currículo criado para: ${candidato.nomeCompleto}`);

      // Candidatar-se a algumas vagas (aleatório)
      const numCandidaturas = Math.min(Math.floor(Math.random() * 3) + 1, vagas.length);
      const vagasSelecionadas = vagas.slice(0, numCandidaturas);

      for (const vaga of vagasSelecionadas) {
        try {
          // Buscar um status padrão para usar nas candidaturas
          const statusPadrao = await client.statusProcessosCandidatos.findFirst({
            where: { isDefault: true, ativo: true },
          });

          if (!statusPadrao) {
            console.log('⚠️ Nenhum status padrão encontrado, pulando candidatura');
            continue;
          }

          const candidatura = await client.empresasCandidatos.create({
            data: {
              id: randomUUID(),
              vagaId: vaga.id,
              candidatoId: candidato.id,
              curriculoId: curriculo.id,
              empresaUsuarioId: vaga.usuarioId,
              statusId: statusPadrao.id,
              origem: 'SITE',
              consentimentos: {
                lgpd: true,
                comunicacao: true,
              },
              atualizadaEm: new Date(),
            },
          });

          candidaturasCriadas.push(candidatura);
          console.log(`    📮 Candidatura criada: ${candidato.nomeCompleto} -> ${vaga.titulo}`);
        } catch (error: any) {
          // Ignorar erro de candidatura duplicada
          if (!error.message.includes('Unique constraint')) {
            console.error(`    ❌ Erro ao criar candidatura: ${error.message}`);
          }
        }
      }
    } catch (error: any) {
      console.error(`  ❌ Erro ao criar currículo para ${candidato.nomeCompleto}:`, error.message);
    }
  }

  console.log(`\n✨ ${curriculosCriados.length} currículos criados!`);
  console.log(`✨ ${candidaturasCriadas.length} candidaturas criadas!\n`);

  return { curriculos: curriculosCriados, candidaturas: candidaturasCriadas };
}

// Se executado diretamente
if (require.main === module) {
  const prisma = new PrismaClient();
  seedCurriculosCandidaturas(prisma)
    .then(() => {
      console.log('✅ Seed de currículos e candidaturas concluído');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro no seed de currículos e candidaturas:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
