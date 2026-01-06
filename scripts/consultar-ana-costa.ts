/**
 * Script para consultar Ana Costa e verificar seus cursos e progresso
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Calcula o progresso do curso (mesma lógica do controller)
 */
async function calcularProgressoCurso(
  inscricaoId: string,
  turmaId: string,
  dataInicio: Date | null,
  dataFim: Date | null,
): Promise<number> {
  try {
    const totalAulas = await prisma.cursosTurmasAulas.count({
      where: { turmaId },
    });
    const totalProvas = await prisma.cursosTurmasProvas.count({
      where: { turmaId },
    });
    const aulasComFrequencia = await prisma.cursosFrequenciaAlunos.count({
      where: { inscricaoId, status: 'PRESENTE' },
    });
    const provasComEnvio = await prisma.cursosTurmasProvasEnvios.count({
      where: { inscricaoId },
    });

    // Se não há aulas nem provas, calcular por tempo decorrido
    if (totalAulas === 0 && totalProvas === 0) {
      if (dataInicio && dataFim) {
        const agora = new Date();
        const inicio = new Date(dataInicio).getTime();
        const fim = new Date(dataFim).getTime();
        const atual = agora.getTime();

        if (fim > inicio) {
          const progressoPorTempo = Math.min(
            100,
            Math.max(0, ((atual - inicio) / (fim - inicio)) * 100),
          );
          return Math.round(progressoPorTempo);
        }
      }
      return 0;
    }

    // Calcular progresso baseado em aulas e provas
    let progressoAulas = 0;
    let progressoProvas = 0;
    let pesoAulas = 0.6;
    let pesoProvas = 0.4;

    if (totalAulas > 0) {
      progressoAulas = (aulasComFrequencia / totalAulas) * 100;
    }

    if (totalProvas > 0) {
      progressoProvas = (provasComEnvio / totalProvas) * 100;
    }

    // Ajustar pesos se um dos componentes não existe
    if (totalAulas === 0 && totalProvas > 0) {
      pesoAulas = 0;
      pesoProvas = 1;
    } else if (totalAulas > 0 && totalProvas === 0) {
      pesoAulas = 1;
      pesoProvas = 0;
    }

    const progressoTotal = progressoAulas * pesoAulas + progressoProvas * pesoProvas;
    return Math.round(Math.min(100, Math.max(0, progressoTotal)));
  } catch (error) {
    console.error('Erro ao calcular progresso:', error);
    return 0;
  }
}

async function main() {
  console.log('🔍 Consultando dados da Ana Costa...\n');

  try {
    // 1. Buscar Ana Costa
    const anaCosta = await prisma.usuarios.findFirst({
      where: {
        nomeCompleto: {
          contains: 'Ana Costa',
          mode: 'insensitive',
        },
        role: 'ALUNO_CANDIDATO',
      },
      include: {
        CursosTurmasInscricoes: {
          include: {
            CursosTurmas: {
              include: {
                Cursos: {
                  select: {
                    id: true,
                    nome: true,
                    codigo: true,
                    descricao: true,
                    cargaHoraria: true,
                    imagemUrl: true,
                  },
                },
              },
            },
          },
          orderBy: {
            criadoEm: 'desc',
          },
        },
        UsuariosEnderecos: {
          take: 1,
        },
      },
    });

    if (!anaCosta) {
      console.log('❌ Ana Costa não encontrada no banco de dados');
      return;
    }

    console.log('✅ ANA COSTA ENCONTRADA:');
    console.log('═'.repeat(80));
    console.log(`   ID: ${anaCosta.id}`);
    console.log(`   Nome: ${anaCosta.nomeCompleto}`);
    console.log(`   Email: ${anaCosta.email}`);
    console.log(`   CPF: ${anaCosta.cpf}`);
    console.log(`   Código: ${anaCosta.codUsuario}`);
    console.log(`   Status: ${anaCosta.status}`);

    if (anaCosta.UsuariosEnderecos.length > 0) {
      const endereco = anaCosta.UsuariosEnderecos[0];
      console.log(`   Cidade: ${endereco.cidade || 'N/A'}`);
      console.log(`   Estado: ${endereco.estado || 'N/A'}`);
    }

    console.log(`\n   Total de Inscrições: ${anaCosta.CursosTurmasInscricoes.length}`);
    console.log('═'.repeat(80));

    if (anaCosta.CursosTurmasInscricoes.length === 0) {
      console.log('\n⚠️  Ana Costa não possui inscrições em cursos.');
      return;
    }

    // 2. Calcular progresso para cada inscrição
    console.log('\n📡 Calculando progresso de cada inscrição...\n');

    const inscricoesComProgresso = await Promise.all(
      anaCosta.CursosTurmasInscricoes.map(async (inscricao) => {
        const progresso = await calcularProgressoCurso(
          inscricao.id,
          inscricao.CursosTurmas.id,
          inscricao.CursosTurmas.dataInicio,
          inscricao.CursosTurmas.dataFim,
        );

        return {
          ...inscricao,
          progresso,
        };
      }),
    );

    // 3. Exibir resultados
    console.log('═'.repeat(80));
    console.log('📚 CURSOS E PROGRESSO DA ANA COSTA:');
    console.log('═'.repeat(80));

    if (inscricoesComProgresso.length > 0) {
      inscricoesComProgresso.forEach((inscricao, index) => {
        console.log(`\n📖 CURSO ${index + 1}:`);
        console.log('─'.repeat(80));
        console.log(`   ID da Inscrição: ${inscricao.id}`);
        console.log(`   Curso: ${inscricao.CursosTurmas.Cursos.nome}`);
        console.log(`   Código do Curso: ${inscricao.CursosTurmas.Cursos.codigo}`);
        console.log(`   Carga Horária: ${inscricao.CursosTurmas.Cursos.cargaHoraria}h`);
        console.log(`   Descrição: ${inscricao.CursosTurmas.Cursos.descricao || 'N/A'}`);
        console.log(`   Turma: ${inscricao.CursosTurmas.nome}`);
        console.log(`   Código da Turma: ${inscricao.CursosTurmas.codigo}`);
        console.log(`   Status da Turma: ${inscricao.CursosTurmas.status}`);
        console.log(
          `   Data Início: ${inscricao.CursosTurmas.dataInicio ? new Date(inscricao.CursosTurmas.dataInicio).toLocaleDateString('pt-BR') : 'N/A'}`,
        );
        console.log(
          `   Data Fim: ${inscricao.CursosTurmas.dataFim ? new Date(inscricao.CursosTurmas.dataFim).toLocaleDateString('pt-BR') : 'N/A'}`,
        );
        console.log(`   Status da Inscrição: ${inscricao.status}`);
        console.log(
          `   Data de Inscrição: ${new Date(inscricao.criadoEm).toLocaleDateString('pt-BR')}`,
        );
        console.log(`   📊 PROGRESSO: ${inscricao.progresso}%`);

        // Barra de progresso visual
        const progresso = inscricao.progresso;
        const barra =
          '█'.repeat(Math.floor(progresso / 2)) + '░'.repeat(50 - Math.floor(progresso / 2));
        console.log(`   ${barra} ${progresso}%`);

        // Classificação do progresso
        if (progresso === 0) {
          console.log(`   📌 Status: Não iniciado`);
        } else if (progresso < 25) {
          console.log(`   📌 Status: Início`);
        } else if (progresso < 50) {
          console.log(`   📌 Status: Em andamento (inicial)`);
        } else if (progresso < 75) {
          console.log(`   📌 Status: Em andamento (intermediário)`);
        } else if (progresso < 100) {
          console.log(`   📌 Status: Quase concluído`);
        } else {
          console.log(`   📌 Status: Concluído! 🎉`);
        }
      });

      // Resumo estatístico
      console.log('\n\n📊 RESUMO:');
      console.log('═'.repeat(80));
      console.log(`   Total de Cursos: ${inscricoesComProgresso.length}`);

      const cursosAtivos = inscricoesComProgresso.filter((i) =>
        ['INSCRITO', 'EM_ANDAMENTO'].includes(i.status),
      ).length;
      const cursosConcluidos = inscricoesComProgresso.filter(
        (i) => i.status === 'CONCLUIDO',
      ).length;
      const mediaProgresso =
        inscricoesComProgresso.reduce((acc, i) => acc + i.progresso, 0) /
        inscricoesComProgresso.length;

      console.log(`   Cursos Ativos: ${cursosAtivos}`);
      console.log(`   Cursos Concluídos: ${cursosConcluidos}`);
      console.log(`   Progresso Médio: ${mediaProgresso.toFixed(1)}%`);

      // Progresso por curso
      console.log('\n   Progresso por Curso:');
      inscricoesComProgresso.forEach((inscricao) => {
        console.log(`      • ${inscricao.CursosTurmas.Cursos.nome}: ${inscricao.progresso}%`);
      });

      // JSON completo
      console.log('\n\n📄 JSON COMPLETO:');
      console.log('═'.repeat(80));
      console.log(
        JSON.stringify(
          inscricoesComProgresso.map((i) => ({
            id: i.id,
            statusInscricao: i.status,
            criadoEm: i.criadoEm,
            progresso: i.progresso,
            turma: {
              id: i.CursosTurmas.id,
              nome: i.CursosTurmas.nome,
              codigo: i.CursosTurmas.codigo,
              status: i.CursosTurmas.status,
              dataInicio: i.CursosTurmas.dataInicio,
              dataFim: i.CursosTurmas.dataFim,
            },
            curso: {
              id: i.CursosTurmas.Cursos.id,
              nome: i.CursosTurmas.Cursos.nome,
              codigo: i.CursosTurmas.Cursos.codigo,
              cargaHoraria: i.CursosTurmas.Cursos.cargaHoraria,
            },
          })),
          null,
          2,
        ),
      );
    } else {
      console.log('\n⚠️  Nenhuma inscrição encontrada');
    }
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();
