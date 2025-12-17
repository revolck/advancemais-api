/**
 * Script de teste completo para sistema de questões de provas
 * Testa todos os tipos de questões, alternativas e respostas conforme documentação
 */

import { PrismaClient, CursosTipoQuestao } from '@prisma/client';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { prisma } from '../src/config/prisma';

// Carregar variáveis de ambiente
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

interface TestResult {
  test: string;
  success: boolean;
  message: string;
  data?: any;
  error?: any;
}

const results: TestResult[] = [];

async function logResult(test: string, success: boolean, message: string, data?: any, error?: any) {
  results.push({ test, success, message, data, error });
  const icon = success ? '✅' : '❌';
  console.log(`${icon} ${test}: ${message}`);
  if (data && Object.keys(data).length > 0) {
    console.log(`   Dados:`, JSON.stringify(data, null, 2).substring(0, 200));
  }
  if (error) {
    console.error(`   Erro:`, error);
  }
}

async function testQuestoesCompletas() {
  console.log('🧪 Iniciando testes completos do sistema de questões de provas...\n');

  try {
    // 1. Buscar turma e inscrição existentes
    console.log('📚 Preparando ambiente de teste...');
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

    const inscricao = await prisma.cursosTurmasInscricoes.findFirst({
      where: {
        turmaId: turma.id,
      },
      include: {
        Aluno: true,
      },
    });

    if (!inscricao) {
      throw new Error('Nenhuma inscrição encontrada na turma.');
    }

    console.log(`✅ Ambiente preparado:`);
    console.log(`   Turma: ${turma.nome} (${turma.codigo})`);
    console.log(`   Aluno: ${inscricao.Aluno.nomeCompleto}\n`);

    // 2. Criar prova de teste
    console.log('📝 Criando prova de teste completa...');
    const prova = await prisma.cursosTurmasProvas.create({
      data: {
        id: randomUUID(),
        turmaId: turma.id,
        titulo: 'Prova Completa - Teste de Todos os Tipos de Questões',
        etiqueta: 'TESTE-COMPLETA',
        descricao: 'Prova criada para testar todos os tipos de questões e alternativas',
        peso: 10.0,
        valePonto: true,
        ativo: true,
        ordem: 0,
      },
    });
    await logResult('Criar Prova', true, `Prova criada: ${prova.titulo}`, { provaId: prova.id });

    // 3. TESTE 1: Criar questão TEXTO
    console.log('\n📝 TESTE 1: Criando questão TEXTO...');
    const questaoTexto = await prisma.cursosTurmasProvasQuestoes.create({
      data: {
        id: randomUUID(),
        provaId: prova.id,
        enunciado: 'Explique detalhadamente o conceito de herança em programação orientada a objetos, incluindo exemplos práticos.',
        tipo: CursosTipoQuestao.TEXTO,
        ordem: 1,
        peso: 3.0,
        obrigatoria: true,
      },
    });
    await logResult('Questão TEXTO', true, 'Questão de texto criada', {
      questaoId: questaoTexto.id,
      tipo: questaoTexto.tipo,
      peso: questaoTexto.peso,
    });

    // 4. TESTE 2: Criar questão MULTIPLA_ESCOLHA com 2 alternativas
    console.log('\n📝 TESTE 2: Criando questão MULTIPLA_ESCOLHA com 2 alternativas...');
    const questaoME2 = await prisma.cursosTurmasProvasQuestoes.create({
      data: {
        id: randomUUID(),
        provaId: prova.id,
        enunciado: 'Qual é a linguagem de programação mais usada para desenvolvimento web front-end?',
        tipo: CursosTipoQuestao.MULTIPLA_ESCOLHA,
        ordem: 2,
        peso: 1.5,
        obrigatoria: true,
      },
    });

    const alternativasME2 = [
      { texto: 'Python', correta: false, ordem: 1 },
      { texto: 'JavaScript', correta: true, ordem: 2 },
    ];

    const alternativasCriadasME2 = [];
    for (const alt of alternativasME2) {
      const alternativa = await prisma.cursosTurmasProvasQuestoesAlternativas.create({
        data: {
          id: randomUUID(),
          questaoId: questaoME2.id,
          texto: alt.texto,
          ordem: alt.ordem,
          correta: alt.correta,
        },
      });
      alternativasCriadasME2.push(alternativa);
    }

    const corretasME2 = alternativasCriadasME2.filter((a) => a.correta).length;
    await logResult(
      'Questão MULTIPLA_ESCOLHA (2 alt)',
      corretasME2 === 1 && alternativasCriadasME2.length === 2,
      `Questão criada com ${alternativasCriadasME2.length} alternativas, ${corretasME2} correta(s)`,
      {
        questaoId: questaoME2.id,
        alternativas: alternativasCriadasME2.length,
        corretas: corretasME2,
      },
    );

    // 5. TESTE 3: Criar questão MULTIPLA_ESCOLHA com 3 alternativas
    console.log('\n📝 TESTE 3: Criando questão MULTIPLA_ESCOLHA com 3 alternativas...');
    const questaoME3 = await prisma.cursosTurmasProvasQuestoes.create({
      data: {
        id: randomUUID(),
        provaId: prova.id,
        enunciado: 'Qual é o método HTTP usado para criar um novo recurso em uma API REST?',
        tipo: CursosTipoQuestao.MULTIPLA_ESCOLHA,
        ordem: 3,
        peso: 2.0,
        obrigatoria: true,
      },
    });

    const alternativasME3 = [
      { texto: 'GET', correta: false, ordem: 1 },
      { texto: 'POST', correta: true, ordem: 2 },
      { texto: 'PUT', correta: false, ordem: 3 },
    ];

    const alternativasCriadasME3 = [];
    for (const alt of alternativasME3) {
      const alternativa = await prisma.cursosTurmasProvasQuestoesAlternativas.create({
        data: {
          id: randomUUID(),
          questaoId: questaoME3.id,
          texto: alt.texto,
          ordem: alt.ordem,
          correta: alt.correta,
        },
      });
      alternativasCriadasME3.push(alternativa);
    }

    const corretasME3 = alternativasCriadasME3.filter((a) => a.correta).length;
    await logResult(
      'Questão MULTIPLA_ESCOLHA (3 alt)',
      corretasME3 === 1 && alternativasCriadasME3.length === 3,
      `Questão criada com ${alternativasCriadasME3.length} alternativas, ${corretasME3} correta(s)`,
      {
        questaoId: questaoME3.id,
        alternativas: alternativasCriadasME3.length,
        corretas: corretasME3,
      },
    );

    // 6. TESTE 4: Criar questão MULTIPLA_ESCOLHA com 4 alternativas
    console.log('\n📝 TESTE 4: Criando questão MULTIPLA_ESCOLHA com 4 alternativas...');
    const questaoME4 = await prisma.cursosTurmasProvasQuestoes.create({
      data: {
        id: randomUUID(),
        provaId: prova.id,
        enunciado: 'Qual é a capital do Brasil?',
        tipo: CursosTipoQuestao.MULTIPLA_ESCOLHA,
        ordem: 4,
        peso: 1.0,
        obrigatoria: true,
      },
    });

    const alternativasME4 = [
      { texto: 'São Paulo', correta: false, ordem: 1 },
      { texto: 'Rio de Janeiro', correta: false, ordem: 2 },
      { texto: 'Brasília', correta: true, ordem: 3 },
      { texto: 'Belo Horizonte', correta: false, ordem: 4 },
    ];

    const alternativasCriadasME4 = [];
    for (const alt of alternativasME4) {
      const alternativa = await prisma.cursosTurmasProvasQuestoesAlternativas.create({
        data: {
          id: randomUUID(),
          questaoId: questaoME4.id,
          texto: alt.texto,
          ordem: alt.ordem,
          correta: alt.correta,
        },
      });
      alternativasCriadasME4.push(alternativa);
    }

    const corretasME4 = alternativasCriadasME4.filter((a) => a.correta).length;
    await logResult(
      'Questão MULTIPLA_ESCOLHA (4 alt)',
      corretasME4 === 1 && alternativasCriadasME4.length === 4,
      `Questão criada com ${alternativasCriadasME4.length} alternativas, ${corretasME4} correta(s)`,
      {
        questaoId: questaoME4.id,
        alternativas: alternativasCriadasME4.length,
        corretas: corretasME4,
      },
    );

    // 7. TESTE 5: Criar questão MULTIPLA_ESCOLHA com 5 alternativas
    console.log('\n📝 TESTE 5: Criando questão MULTIPLA_ESCOLHA com 5 alternativas...');
    const questaoME5 = await prisma.cursosTurmasProvasQuestoes.create({
      data: {
        id: randomUUID(),
        provaId: prova.id,
        enunciado: 'Qual é o framework JavaScript mais popular para desenvolvimento front-end?',
        tipo: CursosTipoQuestao.MULTIPLA_ESCOLHA,
        ordem: 5,
        peso: 2.5,
        obrigatoria: false,
      },
    });

    const alternativasME5 = [
      { texto: 'Angular', correta: false, ordem: 1 },
      { texto: 'React', correta: true, ordem: 2 },
      { texto: 'Vue.js', correta: false, ordem: 3 },
      { texto: 'Svelte', correta: false, ordem: 4 },
      { texto: 'Ember.js', correta: false, ordem: 5 },
    ];

    const alternativasCriadasME5 = [];
    for (const alt of alternativasME5) {
      const alternativa = await prisma.cursosTurmasProvasQuestoesAlternativas.create({
        data: {
          id: randomUUID(),
          questaoId: questaoME5.id,
          texto: alt.texto,
          ordem: alt.ordem,
          correta: alt.correta,
        },
      });
      alternativasCriadasME5.push(alternativa);
    }

    const corretasME5 = alternativasCriadasME5.filter((a) => a.correta).length;
    await logResult(
      'Questão MULTIPLA_ESCOLHA (5 alt)',
      corretasME5 === 1 && alternativasCriadasME5.length === 5,
      `Questão criada com ${alternativasCriadasME5.length} alternativas, ${corretasME5} correta(s)`,
      {
        questaoId: questaoME5.id,
        alternativas: alternativasCriadasME5.length,
        corretas: corretasME5,
      },
    );

    // 8. TESTE 6: Criar questão ANEXO
    console.log('\n📝 TESTE 6: Criando questão ANEXO...');
    const questaoAnexo = await prisma.cursosTurmasProvasQuestoes.create({
      data: {
        id: randomUUID(),
        provaId: prova.id,
        enunciado: 'Envie um arquivo PDF com seu currículo atualizado e portfólio de projetos.',
        tipo: CursosTipoQuestao.ANEXO,
        ordem: 6,
        peso: 5.0,
        obrigatoria: false,
      },
    });
    await logResult('Questão ANEXO', true, 'Questão de anexo criada', {
      questaoId: questaoAnexo.id,
      tipo: questaoAnexo.tipo,
      peso: questaoAnexo.peso,
    });

    // 9. Criar envio de prova
    console.log('\n📤 Criando envio de prova...');
    const envio = await prisma.cursosTurmasProvasEnvios.create({
      data: {
        id: randomUUID(),
        provaId: prova.id,
        inscricaoId: inscricao.id,
        realizadoEm: new Date(),
      },
    });
    await logResult('Criar Envio', true, 'Envio de prova criado', { envioId: envio.id });

    // 10. TESTE 7: Criar resposta para questão TEXTO
    console.log('\n✍️  TESTE 7: Criando resposta para questão TEXTO...');
    const respostaTexto = await prisma.cursosTurmasProvasRespostas.create({
      data: {
        id: randomUUID(),
        questaoId: questaoTexto.id,
        inscricaoId: inscricao.id,
        envioId: envio.id,
        respostaTexto:
          'Herança é um mecanismo fundamental em programação orientada a objetos que permite que uma classe (classe filha) herde características (atributos e métodos) de outra classe (classe pai). Isso promove reutilização de código e estabelece uma relação "é um tipo de" entre classes. Por exemplo, uma classe "Cachorro" pode herdar de uma classe "Animal", herdando métodos como "comer()" e "dormir()", mas também pode ter métodos específicos como "latir()".',
        corrigida: false,
      },
    });
    await logResult(
      'Resposta TEXTO',
      !!respostaTexto.respostaTexto,
      'Resposta de texto criada',
      {
        respostaId: respostaTexto.id,
        temTexto: !!respostaTexto.respostaTexto,
        tamanhoTexto: respostaTexto.respostaTexto?.length || 0,
      },
    );

    // 11. TESTE 8: Criar resposta para questão MULTIPLA_ESCOLHA (2 alt) - CORRETA
    console.log('\n✍️  TESTE 8: Criando resposta para questão MULTIPLA_ESCOLHA (2 alt) - CORRETA...');
    const alternativaCorretaME2 = alternativasCriadasME2.find((a) => a.correta);
    if (alternativaCorretaME2) {
      const respostaME2Correta = await prisma.cursosTurmasProvasRespostas.create({
        data: {
          id: randomUUID(),
          questaoId: questaoME2.id,
          inscricaoId: inscricao.id,
          envioId: envio.id,
          alternativaId: alternativaCorretaME2.id,
          corrigida: true,
          nota: 1.5, // Nota máxima
        },
      });
      await logResult('Resposta MULTIPLA_ESCOLHA (correta)', true, 'Resposta correta criada', {
        respostaId: respostaME2Correta.id,
        alternativaId: alternativaCorretaME2.id,
        nota: respostaME2Correta.nota,
      });
    }

    // 12. TESTE 9: Criar resposta para questão MULTIPLA_ESCOLHA (3 alt) - INCORRETA
    console.log('\n✍️  TESTE 9: Criando resposta para questão MULTIPLA_ESCOLHA (3 alt) - INCORRETA...');
    const alternativaIncorretaME3 = alternativasCriadasME3.find((a) => !a.correta);
    if (alternativaIncorretaME3) {
      const respostaME3Incorreta = await prisma.cursosTurmasProvasRespostas.create({
        data: {
          id: randomUUID(),
          questaoId: questaoME3.id,
          inscricaoId: inscricao.id,
          envioId: envio.id,
          alternativaId: alternativaIncorretaME3.id,
          corrigida: true,
          nota: 0.0,
          observacoes: 'Resposta incorreta. O método correto é POST.',
        },
      });
      await logResult('Resposta MULTIPLA_ESCOLHA (incorreta)', true, 'Resposta incorreta criada', {
        respostaId: respostaME3Incorreta.id,
        alternativaId: alternativaIncorretaME3.id,
        nota: respostaME3Incorreta.nota,
        temObservacoes: !!respostaME3Incorreta.observacoes,
      });
    }

    // 13. TESTE 10: Criar resposta para questão MULTIPLA_ESCOLHA (4 alt) - CORRETA
    console.log('\n✍️  TESTE 10: Criando resposta para questão MULTIPLA_ESCOLHA (4 alt) - CORRETA...');
    const alternativaCorretaME4 = alternativasCriadasME4.find((a) => a.correta);
    if (alternativaCorretaME4) {
      const respostaME4Correta = await prisma.cursosTurmasProvasRespostas.create({
        data: {
          id: randomUUID(),
          questaoId: questaoME4.id,
          inscricaoId: inscricao.id,
          envioId: envio.id,
          alternativaId: alternativaCorretaME4.id,
          corrigida: true,
          nota: 1.0,
          observacoes: 'Excelente! Resposta correta.',
        },
      });
      await logResult('Resposta MULTIPLA_ESCOLHA (4 alt - correta)', true, 'Resposta correta criada', {
        respostaId: respostaME4Correta.id,
        alternativaId: alternativaCorretaME4.id,
        nota: respostaME4Correta.nota,
      });
    }

    // 14. TESTE 11: Criar resposta para questão MULTIPLA_ESCOLHA (5 alt) - CORRETA
    console.log('\n✍️  TESTE 11: Criando resposta para questão MULTIPLA_ESCOLHA (5 alt) - CORRETA...');
    const alternativaCorretaME5 = alternativasCriadasME5.find((a) => a.correta);
    if (alternativaCorretaME5) {
      const respostaME5Correta = await prisma.cursosTurmasProvasRespostas.create({
        data: {
          id: randomUUID(),
          questaoId: questaoME5.id,
          inscricaoId: inscricao.id,
          envioId: envio.id,
          alternativaId: alternativaCorretaME5.id,
          corrigida: true,
          nota: 2.5,
        },
      });
      await logResult('Resposta MULTIPLA_ESCOLHA (5 alt - correta)', true, 'Resposta correta criada', {
        respostaId: respostaME5Correta.id,
        alternativaId: alternativaCorretaME5.id,
        nota: respostaME5Correta.nota,
      });
    }

    // 15. TESTE 12: Criar resposta para questão ANEXO
    console.log('\n✍️  TESTE 12: Criando resposta para questão ANEXO...');
    const respostaAnexo = await prisma.cursosTurmasProvasRespostas.create({
      data: {
        id: randomUUID(),
        questaoId: questaoAnexo.id,
        inscricaoId: inscricao.id,
        envioId: envio.id,
        anexoUrl: 'https://storage.example.com/curriculo-portfolio.pdf',
        anexoNome: 'curriculo_portfolio_joao_silva.pdf',
        corrigida: false,
      },
    });
    await logResult('Resposta ANEXO', true, 'Resposta de anexo criada', {
      respostaId: respostaAnexo.id,
      anexoUrl: respostaAnexo.anexoUrl,
      anexoNome: respostaAnexo.anexoNome,
    });

    // 16. TESTE 13: Corrigir resposta TEXTO
    console.log('\n📝 TESTE 13: Corrigindo resposta TEXTO...');
    const respostaTextoCorrigida = await prisma.cursosTurmasProvasRespostas.update({
      where: { id: respostaTexto.id },
      data: {
        corrigida: true,
        nota: 8.5,
        observacoes:
          'Boa resposta! Você explicou bem o conceito de herança e deu um exemplo prático. Poderia ter mencionado também polimorfismo e encapsulamento.',
      },
    });
    await logResult('Corrigir Resposta TEXTO', true, 'Resposta de texto corrigida', {
      respostaId: respostaTextoCorrigida.id,
      nota: respostaTextoCorrigida.nota,
      temObservacoes: !!respostaTextoCorrigida.observacoes,
    });

    // 17. TESTE 14: Corrigir resposta ANEXO
    console.log('\n📝 TESTE 14: Corrigindo resposta ANEXO...');
    const respostaAnexoCorrigida = await prisma.cursosTurmasProvasRespostas.update({
      where: { id: respostaAnexo.id },
      data: {
        corrigida: true,
        nota: 9.0,
        observacoes: 'Arquivo recebido e avaliado. Currículo bem estruturado e portfólio interessante.',
      },
    });
    await logResult('Corrigir Resposta ANEXO', true, 'Resposta de anexo corrigida', {
      respostaId: respostaAnexoCorrigida.id,
      nota: respostaAnexoCorrigida.nota,
      temObservacoes: !!respostaAnexoCorrigida.observacoes,
    });

    // 18. Validação final - Buscar prova completa
    console.log('\n🔍 Validação final - Buscando prova completa...');
    const provaCompleta = await prisma.cursosTurmasProvas.findUnique({
      where: { id: prova.id },
      include: {
        CursosTurmasProvasQuestoes: {
          include: {
            CursosTurmasProvasQuestoesAlternativas: {
              orderBy: { ordem: 'asc' },
            },
            CursosTurmasProvasRespostas: {
              include: {
                CursosTurmasProvasQuestoesAlternativas: true,
              },
            },
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

    console.log('\n📊 Resumo Final:');
    console.log(`   Prova: ${provaCompleta.titulo}`);
    console.log(`   Vale Ponto: ${provaCompleta.valePonto}`);
    console.log(`   Questões criadas: ${provaCompleta.CursosTurmasProvasQuestoes.length}`);
    console.log(`   Envios: ${provaCompleta.CursosTurmasProvasEnvios.length}`);

    let totalAlternativas = 0;
    let totalRespostas = 0;
    let questoesCorrigidas = 0;
    let somaNotas = 0;

    for (const questao of provaCompleta.CursosTurmasProvasQuestoes) {
      totalAlternativas += questao.CursosTurmasProvasQuestoesAlternativas.length;
      totalRespostas += questao.CursosTurmasProvasRespostas.length;
      const corrigidas = questao.CursosTurmasProvasRespostas.filter((r) => r.corrigida);
      questoesCorrigidas += corrigidas.length;
      somaNotas += corrigidas.reduce((sum, r) => sum + (r.nota?.toNumber() || 0), 0);

      console.log(`\n   Questão ${questao.ordem} (${questao.tipo}):`);
      console.log(`     Enunciado: ${questao.enunciado.substring(0, 60)}...`);
      console.log(`     Peso: ${questao.peso}`);
      console.log(`     Obrigatória: ${questao.obrigatoria}`);
      console.log(`     Alternativas: ${questao.CursosTurmasProvasQuestoesAlternativas.length}`);
      console.log(`     Respostas: ${questao.CursosTurmasProvasRespostas.length}`);
      if (questao.CursosTurmasProvasRespostas.length > 0) {
        const resposta = questao.CursosTurmasProvasRespostas[0];
        console.log(`     Status: ${resposta.corrigida ? 'Corrigida' : 'Pendente'}`);
        if (resposta.corrigida && resposta.nota) {
          console.log(`     Nota: ${resposta.nota}`);
        }
      }
    }

    console.log(`\n   📈 Totais:`);
    console.log(`     Alternativas: ${totalAlternativas}`);
    console.log(`     Respostas: ${totalRespostas}`);
    console.log(`     Respostas corrigidas: ${questoesCorrigidas}`);
    console.log(`     Soma das notas: ${somaNotas.toFixed(1)}`);

    await logResult('Validação Final', true, 'Prova completa validada', {
      questoes: provaCompleta.CursosTurmasProvasQuestoes.length,
      alternativas: totalAlternativas,
      respostas: totalRespostas,
      corrigidas: questoesCorrigidas,
      somaNotas: somaNotas.toFixed(1),
    });

    // Resumo dos resultados
    console.log('\n\n📋 Resumo dos Testes:');
    const sucessos = results.filter((r) => r.success).length;
    const falhas = results.filter((r) => !r.success).length;
    console.log(`   ✅ Sucessos: ${sucessos}`);
    console.log(`   ❌ Falhas: ${falhas}`);
    console.log(`   📊 Total: ${results.length}`);

    if (falhas > 0) {
      console.log('\n   ❌ Testes que falharam:');
      results.filter((r) => !r.success).forEach((r) => {
        console.log(`      - ${r.test}: ${r.message}`);
        if (r.error) console.log(`        Erro: ${r.error}`);
      });
    }

    return {
      success: falhas === 0,
      results,
      prova: provaCompleta,
    };
  } catch (error: any) {
    console.error('\n❌ Erro durante os testes:', error.message);
    console.error('Stack:', error.stack);
    await logResult('Erro Geral', false, error.message, undefined, error.stack);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar testes
testQuestoesCompletas()
  .then((result) => {
    console.log('\n✨ Testes concluídos!');
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n💥 Falha crítica nos testes:', error);
    process.exit(1);
  });

