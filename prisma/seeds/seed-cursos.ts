/**
 * Seed de Cursos e Turmas
 */

import {
  PrismaClient,
  Roles,
  CursosStatusPadrao,
  CursoStatus,
  StatusInscricao,
} from '@prisma/client';
import { randomUUID } from 'crypto';

export async function seedCursos(prisma?: PrismaClient) {
  const client = prisma || new PrismaClient();
  console.log('🌱 Iniciando seed de cursos e turmas...');

  // Buscar instrutor
  const professor = await client.usuarios.findFirst({
    where: { role: Roles.INSTRUTOR },
  });

  if (!professor) {
    console.log('  ⚠️  Nenhum professor encontrado. Execute seed-usuarios.ts primeiro.');
    return { categorias: [], cursos: [], turmas: [] };
  }

  const categoriasCriadas: any[] = [];
  const cursosCriados: any[] = [];
  const turmasCriadas: any[] = [];

  // Criar categorias
  const categorias = [
    {
      codCategoria: 'TI-001',
      nome: 'Desenvolvimento Web',
      descricao: 'Cursos de desenvolvimento web front-end e back-end',
    },
    {
      codCategoria: 'TI-002',
      nome: 'Banco de Dados',
      descricao: 'Cursos de bancos de dados SQL e NoSQL',
    },
    {
      codCategoria: 'GE-001',
      nome: 'Gestão e Negócios',
      descricao: 'Cursos de administração e gestão empresarial',
    },
  ];

  for (const cat of categorias) {
    try {
      const categoria = await client.cursosCategorias.upsert({
        where: { codCategoria: cat.codCategoria },
        update: {
          atualizadoEm: new Date(),
        },
        create: {
          ...cat,
          atualizadoEm: new Date(),
        },
      });
      categoriasCriadas.push(categoria);
      console.log(`  📁 Categoria criada: ${cat.nome}`);
    } catch (error: any) {
      console.error(`  ❌ Erro ao criar categoria ${cat.nome}:`, error.message);
    }
  }

  // Criar cursos
  const cursos = [
    {
      codigo: 'DEV-FULL',
      nome: 'Desenvolvimento Full Stack Completo',
      descricao:
        'Aprenda a desenvolver aplicações web completas do zero, desde o front-end até o back-end',
      imagemUrl:
        'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&h=600&fit=crop',
      cargaHoraria: 320,
      categoriaId: categoriasCriadas[0]?.id,
      statusPadrao: CursosStatusPadrao.PUBLICADO,
    },
    {
      codigo: 'REACT-ADV',
      nome: 'React Avançado e Next.js',
      descricao: 'Domine React e Next.js para criar aplicações modernas e performáticas',
      imagemUrl:
        'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&h=600&fit=crop',
      cargaHoraria: 160,
      categoriaId: categoriasCriadas[0]?.id,
      statusPadrao: CursosStatusPadrao.PUBLICADO,
    },
    {
      codigo: 'SQL-COMP',
      nome: 'SQL do Básico ao Avançado',
      descricao: 'Aprenda SQL desde conceitos básicos até consultas complexas e otimização',
      imagemUrl: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=800&h=600&fit=crop',
      cargaHoraria: 80,
      categoriaId: categoriasCriadas[1]?.id,
      statusPadrao: CursosStatusPadrao.PUBLICADO,
    },
    {
      codigo: 'GEST-PROJ',
      nome: 'Gestão de Projetos Ágeis',
      descricao: 'Aprenda metodologias ágeis como Scrum e Kanban para gerenciar projetos',
      imagemUrl:
        'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=600&fit=crop',
      cargaHoraria: 120,
      categoriaId: categoriasCriadas[2]?.id,
      statusPadrao: CursosStatusPadrao.PUBLICADO,
    },
  ];

  for (const curso of cursos) {
    try {
      const cursoDb = await client.cursos.upsert({
        where: { codigo: curso.codigo },
        update: {},
        create: {
          ...curso,
          atualizadoEm: new Date(),
        },
      });
      cursosCriados.push(cursoDb);
      console.log(`  📚 Curso criado: ${curso.nome}`);

      // Criar turma para o curso
      const codigoTurma = `${curso.codigo}-T1`;
      try {
        const turma = await client.cursosTurmas.create({
          data: {
            id: randomUUID(),
            codigo: codigoTurma,
            cursoId: cursoDb.id,
            nome: `Turma 1 - ${curso.nome}`,
            instrutorId: professor.id,
            turno: 'NOITE',
            metodo: 'ONLINE',
            dataInicio: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Inicia em 7 dias
            dataFim: new Date(Date.now() + 97 * 24 * 60 * 60 * 1000), // 90 dias depois
            dataInscricaoInicio: new Date(),
            dataInscricaoFim: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 dias
            vagasTotais: 30,
            vagasDisponiveis: 30,
            status: CursoStatus.INSCRICOES_ABERTAS,
            atualizadoEm: new Date(),
          },
        });
        turmasCriadas.push(turma);
        console.log(`    🎓 Turma criada: ${codigoTurma}`);

        // Buscar alunos que NÃO têm inscrição ativa (EM_ANDAMENTO ou INSCRITO)
        // Um aluno não pode estar em múltiplos cursos simultaneamente
        const alunosDisponiveis = await client.usuarios.findMany({
          where: {
            role: 'ALUNO_CANDIDATO',
            NOT: {
              CursosTurmasInscricoes: {
                some: {
                  status: {
                    in: ['EM_ANDAMENTO', 'INSCRITO'],
                  },
                },
              },
            },
          },
          take: 3, // Inscrever até 3 alunos por turma
        });

        // Inscrever alunos na turma com status INSCRITO (padrão)
        for (const aluno of alunosDisponiveis) {
          try {
            await client.cursosTurmasInscricoes.create({
              data: {
                id: randomUUID(),
                turmaId: turma.id,
                alunoId: aluno.id,
                status: StatusInscricao.INSCRITO, // Status padrão para novas inscrições
              },
            });
            console.log(
              `      👤 Aluno inscrito: ${aluno.nomeCompleto} (${StatusInscricao.INSCRITO})`,
            );
          } catch (error: any) {
            if (!error.message.includes('Unique constraint')) {
              console.error(`      ❌ Erro ao inscrever aluno: ${error.message}`);
            }
          }
        }
      } catch (error: any) {
        if (!error.message.includes('Unique constraint')) {
          console.error(`    ❌ Erro ao criar turma: ${error.message}`);
        }
      }
    } catch (error: any) {
      if (!error.message.includes('Unique constraint')) {
        console.error(`  ❌ Erro ao criar curso ${curso.nome}:`, error.message);
      }
    }
  }

  console.log(`\n✨ ${categoriasCriadas.length} categorias criadas!`);
  console.log(`✨ ${cursosCriados.length} cursos criados!`);
  console.log(`✨ ${turmasCriadas.length} turmas criadas!\n`);

  return { categorias: categoriasCriadas, cursos: cursosCriados, turmas: turmasCriadas };
}

// Se executado diretamente
if (require.main === module) {
  const prisma = new PrismaClient();
  seedCursos(prisma)
    .then(() => {
      console.log('✅ Seed de cursos concluído');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro no seed de cursos:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
