/**
 * Script de teste para validar a migração do sistema de questões de provas
 * Testa criação de prova, questões, alternativas e respostas
 */

import { CursosTipoQuestao } from '@prisma/client';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { prisma } from '../src/config/prisma';

// Carregar variáveis de ambiente ANTES de importar o PrismaClient
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

interface TestResult {
  success: boolean;
  message: string;
  data?: any;
  error?: any;
}

async function testMigration() {
  console.log('🧪 Iniciando testes do sistema de questões de provas...\n');

  const results: TestResult[] = [];

  try {
    // 1. Buscar uma turma existente
    console.log('📚 Buscando turma existente...');
    const turma = await prisma.cursosTurmas.findFirst({
      where: {
        status: {
          in: ['ATIVO', 'EM_ANDAMENTO', 'RASCUNHO'],
        },
      },
      include: {
        Cursos: true,
      },
    });

    if (!turma) {
      throw new Error('Nenhuma turma encontrada. Execute o seed primeiro.');
    }

    console.log(`✅ Turma encontrada: ${turma.nome} (${turma.codigo})\n`);
    results.push({
      success: true,
      message: `Turma encontrada: ${turma.nome}`,
      data: { turmaId: turma.id, codigo: turma.codigo },
    });

    // 2. Buscar uma inscrição existente
    console.log('👤 Buscando inscrição existente...');
    const inscricao = await prisma.cursosTurmasInscricoes.findFirst({
      where: {
        turmaId: turma.id,
      },
      include: {
        Aluno: true,
      },
    });

    if (!inscricao) {
      throw new Error('Nenhuma inscrição encontrada na turma. Execute o seed primeiro.');
    }

    console.log(`✅ Inscrição encontrada: ${inscricao.Aluno.nomeCompleto}\n`);
    results.push({
      success: true,
      message: `Inscrição encontrada: ${inscricao.Aluno.nomeCompleto}`,
      data: { inscricaoId: inscricao.id, alunoId: inscricao.alunoId },
    });

    // 3. Criar uma prova
    console.log('📝 Criando prova de teste...');
    const prova = await prisma.cursosTurmasProvas.create({
      data: {
        id: randomUUID(),
        turmaId: turma.id,
        titulo: 'Prova de Teste - Sistema de Questões',
        etiqueta: 'TESTE',
        descricao: 'Prova criada para testar o sistema de questões após migração',
        peso: 10.0,
        valePonto: true,
        ativo: true,
        ordem: 0,
      },
    });

    console.log(`✅ Prova criada: ${prova.titulo} (ID: ${prova.id})\n`);
    results.push({
      success: true,
      message: `Prova criada: ${prova.titulo}`,
      data: { provaId: prova.id },
    });

    // 4. Criar questões de diferentes tipos
    console.log('❓ Criando questões...');

    // Questão 1: TEXTO
    const questaoTexto = await prisma.cursosTurmasProvasQuestoes.create({
      data: {
        id: randomUUID(),
        provaId: prova.id,
        enunciado: 'Explique o conceito de herança em programação orientada a objetos.',
        tipo: CursosTipoQuestao.TEXTO,
        ordem: 1,
        peso: 3.0,
        obrigatoria: true,
      },
    });
    console.log(`  ✅ Questão TEXTO criada: "${questaoTexto.enunciado.substring(0, 50)}..."`);
    results.push({
      success: true,
      message: 'Questão TEXTO criada',
      data: { questaoId: questaoTexto.id, tipo: 'TEXTO' },
    });

    // Questão 2: MULTIPLA_ESCOLHA
    const questaoMultiplaEscolha = await prisma.cursosTurmasProvasQuestoes.create({
      data: {
        id: randomUUID(),
        provaId: prova.id,
        enunciado:
          'Qual é a linguagem de programação mais usada para desenvolvimento web front-end?',
        tipo: CursosTipoQuestao.MULTIPLA_ESCOLHA,
        ordem: 2,
        peso: 2.0,
        obrigatoria: true,
      },
    });
    console.log(
      `  ✅ Questão MULTIPLA_ESCOLHA criada: "${questaoMultiplaEscolha.enunciado.substring(0, 50)}..."`,
    );
    results.push({
      success: true,
      message: 'Questão MULTIPLA_ESCOLHA criada',
      data: { questaoId: questaoMultiplaEscolha.id, tipo: 'MULTIPLA_ESCOLHA' },
    });

    // Questão 3: ANEXO
    const questaoAnexo = await prisma.cursosTurmasProvasQuestoes.create({
      data: {
        id: randomUUID(),
        provaId: prova.id,
        enunciado: 'Envie um arquivo PDF com seu currículo atualizado.',
        tipo: CursosTipoQuestao.ANEXO,
        ordem: 3,
        peso: 5.0,
        obrigatoria: false,
      },
    });
    console.log(`  ✅ Questão ANEXO criada: "${questaoAnexo.enunciado.substring(0, 50)}..."`);
    results.push({
      success: true,
      message: 'Questão ANEXO criada',
      data: { questaoId: questaoAnexo.id, tipo: 'ANEXO' },
    });

    console.log('');

    // 5. Criar alternativas para questão de múltipla escolha
    console.log('🔘 Criando alternativas para questão de múltipla escolha...');
    const alternativas = [
      { texto: 'Python', correta: false, ordem: 1 },
      { texto: 'JavaScript', correta: true, ordem: 2 },
      { texto: 'Java', correta: false, ordem: 3 },
      { texto: 'C++', correta: false, ordem: 4 },
    ];

    const alternativasCriadas = [];
    for (const alt of alternativas) {
      const alternativa = await prisma.cursosTurmasProvasQuestoesAlternativas.create({
        data: {
          id: randomUUID(),
          questaoId: questaoMultiplaEscolha.id,
          texto: alt.texto,
          ordem: alt.ordem,
          correta: alt.correta,
        },
      });
      alternativasCriadas.push(alternativa);
      console.log(`  ✅ Alternativa criada: "${alt.texto}" ${alt.correta ? '(CORRETA)' : ''}`);
    }
    console.log('');

    results.push({
      success: true,
      message: `${alternativasCriadas.length} alternativas criadas`,
      data: {
        alternativas: alternativasCriadas.map((a) => ({
          id: a.id,
          texto: a.texto,
          correta: a.correta,
        })),
      },
    });

    // 6. Criar envio de prova
    console.log('📤 Criando envio de prova...');
    const envio = await prisma.cursosTurmasProvasEnvios.create({
      data: {
        id: randomUUID(),
        provaId: prova.id,
        inscricaoId: inscricao.id,
        realizadoEm: new Date(),
      },
    });
    console.log(`✅ Envio criado (ID: ${envio.id})\n`);
    results.push({
      success: true,
      message: 'Envio de prova criado',
      data: { envioId: envio.id },
    });

    // 7. Criar respostas
    console.log('✍️  Criando respostas...');

    // Resposta para questão TEXTO
    const respostaTexto = await prisma.cursosTurmasProvasRespostas.create({
      data: {
        id: randomUUID(),
        questaoId: questaoTexto.id,
        inscricaoId: inscricao.id,
        envioId: envio.id,
        respostaTexto:
          'Herança é um mecanismo que permite que uma classe herde características (atributos e métodos) de outra classe, promovendo reutilização de código e estabelecendo uma relação "é um tipo de" entre classes.',
        corrigida: false,
      },
    });
    console.log(`  ✅ Resposta TEXTO criada`);
    results.push({
      success: true,
      message: 'Resposta TEXTO criada',
      data: { respostaId: respostaTexto.id },
    });

    // Resposta para questão MULTIPLA_ESCOLHA (selecionar alternativa correta)
    const alternativaCorreta = alternativasCriadas.find((a) => a.correta);
    if (alternativaCorreta) {
      const respostaMultiplaEscolha = await prisma.cursosTurmasProvasRespostas.create({
        data: {
          id: randomUUID(),
          questaoId: questaoMultiplaEscolha.id,
          inscricaoId: inscricao.id,
          envioId: envio.id,
          alternativaId: alternativaCorreta.id,
          corrigida: true,
          nota: 2.0, // Nota máxima para questão correta
        },
      });
      console.log(`  ✅ Resposta MULTIPLA_ESCOLHA criada (alternativa correta selecionada)`);
      results.push({
        success: true,
        message: 'Resposta MULTIPLA_ESCOLHA criada',
        data: { respostaId: respostaMultiplaEscolha.id, alternativaId: alternativaCorreta.id },
      });
    }

    // Resposta para questão ANEXO
    const respostaAnexo = await prisma.cursosTurmasProvasRespostas.create({
      data: {
        id: randomUUID(),
        questaoId: questaoAnexo.id,
        inscricaoId: inscricao.id,
        envioId: envio.id,
        anexoUrl: 'https://example.com/curriculo.pdf',
        anexoNome: 'curriculo_joao_silva.pdf',
        corrigida: false,
      },
    });
    console.log(`  ✅ Resposta ANEXO criada`);
    results.push({
      success: true,
      message: 'Resposta ANEXO criada',
      data: { respostaId: respostaAnexo.id },
    });

    console.log('');

    // 8. Validar dados criados
    console.log('🔍 Validando dados criados...');

    const provaCompleta = await prisma.cursosTurmasProvas.findUnique({
      where: { id: prova.id },
      include: {
        CursosTurmasProvasQuestoes: {
          include: {
            CursosTurmasProvasQuestoesAlternativas: true,
            CursosTurmasProvasRespostas: true,
          },
          orderBy: { ordem: 'asc' },
        },
        CursosTurmasProvasEnvios: {
          include: {
            CursosTurmasProvasRespostas: true,
          },
        },
      },
    });

    if (!provaCompleta) {
      throw new Error('Prova não encontrada após criação');
    }

    console.log(`\n📊 Resumo da validação:`);
    console.log(`  ✅ Prova: ${provaCompleta.titulo}`);
    console.log(`  ✅ Questões criadas: ${provaCompleta.CursosTurmasProvasQuestoes.length}`);
    console.log(`  ✅ Envios criados: ${provaCompleta.CursosTurmasProvasEnvios.length}`);

    let totalAlternativas = 0;
    let totalRespostas = 0;

    for (const questao of provaCompleta.CursosTurmasProvasQuestoes) {
      totalAlternativas += questao.CursosTurmasProvasQuestoesAlternativas.length;
      totalRespostas += questao.CursosTurmasProvasRespostas.length;
      console.log(`\n  📝 Questão ${questao.ordem} (${questao.tipo}):`);
      console.log(`     Enunciado: ${questao.enunciado.substring(0, 60)}...`);
      console.log(`     Alternativas: ${questao.CursosTurmasProvasQuestoesAlternativas.length}`);
      console.log(`     Respostas: ${questao.CursosTurmasProvasRespostas.length}`);
    }

    console.log(`\n  📈 Totais:`);
    console.log(`     Alternativas: ${totalAlternativas}`);
    console.log(`     Respostas: ${totalRespostas}`);

    results.push({
      success: true,
      message: 'Validação completa',
      data: {
        prova: {
          id: provaCompleta.id,
          titulo: provaCompleta.titulo,
          valePonto: provaCompleta.valePonto,
        },
        questoes: provaCompleta.CursosTurmasProvasQuestoes.length,
        alternativas: totalAlternativas,
        respostas: totalRespostas,
        envios: provaCompleta.CursosTurmasProvasEnvios.length,
      },
    });

    console.log('\n✅ Todos os testes passaram com sucesso!');
    console.log('\n📋 Resumo dos resultados:');
    results.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.success ? '✅' : '❌'} ${result.message}`);
    });

    return {
      success: true,
      results,
      prova: provaCompleta,
    };
  } catch (error: any) {
    console.error('\n❌ Erro durante os testes:', error.message);
    console.error('Stack:', error.stack);
    results.push({
      success: false,
      message: 'Erro durante execução',
      error: error.message,
    });

    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar testes
testMigration()
  .then((result) => {
    console.log('\n✨ Testes concluídos com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Falha crítica nos testes:', error);
    process.exit(1);
  });
