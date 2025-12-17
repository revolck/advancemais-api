/**
 * Script de teste completo usando SQL direto
 * Testa todos os tipos de questões, alternativas e respostas conforme documentação
 */

import { Client } from 'pg';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

// Carregar variáveis de ambiente
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

interface TestResult {
  test: string;
  success: boolean;
  message: string;
  data?: any;
}

const results: TestResult[] = [];

function logResult(test: string, success: boolean, message: string, data?: any) {
  results.push({ test, success, message, data });
  const icon = success ? '✅' : '❌';
  console.log(`${icon} ${test}: ${message}`);
  if (data && Object.keys(data).length > 0) {
    const dataStr = JSON.stringify(data, null, 2).substring(0, 150);
    if (dataStr.length < JSON.stringify(data, null, 2).length) {
      console.log(`   Dados: ${dataStr}...`);
    } else {
      console.log(`   Dados:`, dataStr);
    }
  }
}

async function testQuestoesCompletasSQL() {
  let connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  
  if (connectionString && !connectionString.includes('sslmode=')) {
    connectionString += (connectionString.includes('?') ? '&' : '?') + 'sslmode=require';
  }
  
  const client = new Client({
    connectionString,
    ssl: connectionString?.includes('supabase') ? {
      rejectUnauthorized: false,
    } : undefined,
  });

  try {
    console.log('🔌 Conectando ao banco de dados...');
    await client.connect();
    console.log('✅ Conectado com sucesso!\n');

    console.log('🧪 Iniciando testes completos do sistema de questões de provas...\n');

    // 1. Buscar turma e inscrição
    console.log('📚 Preparando ambiente de teste...');
    const turmaResult = await client.query(`
      SELECT id, codigo, nome
      FROM "CursosTurmas"
      WHERE status IN ('EM_ANDAMENTO', 'RASCUNHO', 'INSCRICOES_ABERTAS', 'PUBLICADO')
      LIMIT 1
    `);

    if (turmaResult.rows.length === 0) {
      throw new Error('Nenhuma turma encontrada. Execute o seed primeiro.');
    }

    const turma = turmaResult.rows[0];
    logResult('Buscar Turma', true, `Turma encontrada: ${turma.nome}`, { turmaId: turma.id });

    const inscricaoResult = await client.query(`
      SELECT id, "alunoId"
      FROM "CursosTurmasInscricoes"
      WHERE "turmaId" = $1
      LIMIT 1
    `, [turma.id]);

    if (inscricaoResult.rows.length === 0) {
      throw new Error('Nenhuma inscrição encontrada na turma.');
    }

    const inscricao = inscricaoResult.rows[0];
    logResult('Buscar Inscrição', true, 'Inscrição encontrada', { inscricaoId: inscricao.id });

    // 2. Criar ou buscar prova
    console.log('\n📝 Criando prova de teste completa...');
    const etiquetaUnica = `TESTE-${Date.now()}`;
    const provaId = randomUUID();
    
    // Tentar criar, se já existir, buscar a existente
    try {
      await client.query(`
        INSERT INTO "CursosTurmasProvas" (id, "turmaId", titulo, etiqueta, descricao, peso, "valePonto", ativo, ordem)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        provaId,
        turma.id,
        'Prova Completa - Teste de Todos os Tipos de Questões',
        etiquetaUnica,
        'Prova criada para testar todos os tipos de questões e alternativas',
        10.0,
        true,
        true,
        0,
      ]);
      logResult('Criar Prova', true, 'Prova criada', { provaId, etiqueta: etiquetaUnica });
    } catch (error: any) {
      if (error.code === '23505') {
        // Prova já existe, buscar
        const provaExistente = await client.query(`
          SELECT id FROM "CursosTurmasProvas"
          WHERE "turmaId" = $1 AND etiqueta = $2
        `, [turma.id, etiquetaUnica]);
        if (provaExistente.rows.length > 0) {
          const provaExistenteId = provaExistente.rows[0].id;
          logResult('Buscar Prova Existente', true, 'Usando prova existente', { provaId: provaExistenteId });
          // Usar a prova existente e limpar questões antigas se necessário
          await client.query(`DELETE FROM "CursosTurmasProvasQuestoes" WHERE "provaId" = $1`, [provaExistenteId]);
          // Atualizar provaId para usar a existente
          Object.assign({ provaId: provaExistenteId });
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    // 3. TESTE 1: Criar questão TEXTO
    console.log('\n📝 TESTE 1: Criando questão TEXTO...');
    const questaoTextoId = randomUUID();
    await client.query(`
      INSERT INTO "CursosTurmasProvasQuestoes" (id, "provaId", enunciado, tipo, ordem, peso, obrigatoria)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      questaoTextoId,
      provaId,
      'Explique detalhadamente o conceito de herança em programação orientada a objetos, incluindo exemplos práticos.',
      'TEXTO',
      1,
      3.0,
      true,
    ]);
    logResult('Questão TEXTO', true, 'Questão de texto criada', { questaoId: questaoTextoId, tipo: 'TEXTO' });

    // 4. TESTE 2: Criar questão MULTIPLA_ESCOLHA com 2 alternativas
    console.log('\n📝 TESTE 2: Criando questão MULTIPLA_ESCOLHA com 2 alternativas...');
    const questaoME2Id = randomUUID();
    await client.query(`
      INSERT INTO "CursosTurmasProvasQuestoes" (id, "provaId", enunciado, tipo, ordem, peso, obrigatoria)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      questaoME2Id,
      provaId,
      'Qual é a linguagem de programação mais usada para desenvolvimento web front-end?',
      'MULTIPLA_ESCOLHA',
      2,
      1.5,
      true,
    ]);

    const altME2_1 = randomUUID();
    const altME2_2 = randomUUID();
    await client.query(`
      INSERT INTO "CursosTurmasProvasQuestoesAlternativas" (id, "questaoId", texto, ordem, correta)
      VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)
    `, [altME2_1, questaoME2Id, 'Python', 1, false, altME2_2, questaoME2Id, 'JavaScript', 2, true]);
    logResult('Questão MULTIPLA_ESCOLHA (2 alt)', true, 'Questão criada com 2 alternativas, 1 correta', {
      questaoId: questaoME2Id,
      alternativas: 2,
      corretas: 1,
    });

    // 5. TESTE 3: Criar questão MULTIPLA_ESCOLHA com 3 alternativas
    console.log('\n📝 TESTE 3: Criando questão MULTIPLA_ESCOLHA com 3 alternativas...');
    const questaoME3Id = randomUUID();
    await client.query(`
      INSERT INTO "CursosTurmasProvasQuestoes" (id, "provaId", enunciado, tipo, ordem, peso, obrigatoria)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      questaoME3Id,
      provaId,
      'Qual é o método HTTP usado para criar um novo recurso em uma API REST?',
      'MULTIPLA_ESCOLHA',
      3,
      2.0,
      true,
    ]);

    const altME3_1 = randomUUID();
    const altME3_2 = randomUUID();
    const altME3_3 = randomUUID();
    await client.query(`
      INSERT INTO "CursosTurmasProvasQuestoesAlternativas" (id, "questaoId", texto, ordem, correta)
      VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10), ($11, $12, $13, $14, $15)
    `, [
      altME3_1, questaoME3Id, 'GET', 1, false,
      altME3_2, questaoME3Id, 'POST', 2, true,
      altME3_3, questaoME3Id, 'PUT', 3, false,
    ]);
    logResult('Questão MULTIPLA_ESCOLHA (3 alt)', true, 'Questão criada com 3 alternativas, 1 correta', {
      questaoId: questaoME3Id,
      alternativas: 3,
      corretas: 1,
    });

    // 6. TESTE 4: Criar questão MULTIPLA_ESCOLHA com 4 alternativas
    console.log('\n📝 TESTE 4: Criando questão MULTIPLA_ESCOLHA com 4 alternativas...');
    const questaoME4Id = randomUUID();
    await client.query(`
      INSERT INTO "CursosTurmasProvasQuestoes" (id, "provaId", enunciado, tipo, ordem, peso, obrigatoria)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      questaoME4Id,
      provaId,
      'Qual é a capital do Brasil?',
      'MULTIPLA_ESCOLHA',
      4,
      1.0,
      true,
    ]);

    const altME4_1 = randomUUID();
    const altME4_2 = randomUUID();
    const altME4_3 = randomUUID();
    const altME4_4 = randomUUID();
    await client.query(`
      INSERT INTO "CursosTurmasProvasQuestoesAlternativas" (id, "questaoId", texto, ordem, correta)
      VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10), ($11, $12, $13, $14, $15), ($16, $17, $18, $19, $20)
    `, [
      altME4_1, questaoME4Id, 'São Paulo', 1, false,
      altME4_2, questaoME4Id, 'Rio de Janeiro', 2, false,
      altME4_3, questaoME4Id, 'Brasília', 3, true,
      altME4_4, questaoME4Id, 'Belo Horizonte', 4, false,
    ]);
    logResult('Questão MULTIPLA_ESCOLHA (4 alt)', true, 'Questão criada com 4 alternativas, 1 correta', {
      questaoId: questaoME4Id,
      alternativas: 4,
      corretas: 1,
    });

    // 7. TESTE 5: Criar questão MULTIPLA_ESCOLHA com 5 alternativas
    console.log('\n📝 TESTE 5: Criando questão MULTIPLA_ESCOLHA com 5 alternativas...');
    const questaoME5Id = randomUUID();
    await client.query(`
      INSERT INTO "CursosTurmasProvasQuestoes" (id, "provaId", enunciado, tipo, ordem, peso, obrigatoria)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      questaoME5Id,
      provaId,
      'Qual é o framework JavaScript mais popular para desenvolvimento front-end?',
      'MULTIPLA_ESCOLHA',
      5,
      2.5,
      false,
    ]);

    const altME5_1 = randomUUID();
    const altME5_2 = randomUUID();
    const altME5_3 = randomUUID();
    const altME5_4 = randomUUID();
    const altME5_5 = randomUUID();
    await client.query(`
      INSERT INTO "CursosTurmasProvasQuestoesAlternativas" (id, "questaoId", texto, ordem, correta)
      VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10), ($11, $12, $13, $14, $15), ($16, $17, $18, $19, $20), ($21, $22, $23, $24, $25)
    `, [
      altME5_1, questaoME5Id, 'Angular', 1, false,
      altME5_2, questaoME5Id, 'React', 2, true,
      altME5_3, questaoME5Id, 'Vue.js', 3, false,
      altME5_4, questaoME5Id, 'Svelte', 4, false,
      altME5_5, questaoME5Id, 'Ember.js', 5, false,
    ]);
    logResult('Questão MULTIPLA_ESCOLHA (5 alt)', true, 'Questão criada com 5 alternativas, 1 correta', {
      questaoId: questaoME5Id,
      alternativas: 5,
      corretas: 1,
    });

    // 8. TESTE 6: Criar questão ANEXO
    console.log('\n📝 TESTE 6: Criando questão ANEXO...');
    const questaoAnexoId = randomUUID();
    await client.query(`
      INSERT INTO "CursosTurmasProvasQuestoes" (id, "provaId", enunciado, tipo, ordem, peso, obrigatoria)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      questaoAnexoId,
      provaId,
      'Envie um arquivo PDF com seu currículo atualizado e portfólio de projetos.',
      'ANEXO',
      6,
      5.0,
      false,
    ]);
    logResult('Questão ANEXO', true, 'Questão de anexo criada', { questaoId: questaoAnexoId, tipo: 'ANEXO' });

    // 9. Criar envio
    console.log('\n📤 Criando envio de prova...');
    const envioId = randomUUID();
    await client.query(`
      INSERT INTO "CursosTurmasProvasEnvios" (id, "provaId", "inscricaoId", "realizadoEm")
      VALUES ($1, $2, $3, $4)
    `, [envioId, provaId, inscricao.id, new Date()]);
    logResult('Criar Envio', true, 'Envio de prova criado', { envioId });

    // 10. TESTE 7: Criar resposta TEXTO
    console.log('\n✍️  TESTE 7: Criando resposta para questão TEXTO...');
    const respostaTextoId = randomUUID();
    await client.query(`
      INSERT INTO "CursosTurmasProvasRespostas" (id, "questaoId", "inscricaoId", "envioId", "respostaTexto", corrigida)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT ("questaoId", "inscricaoId") DO UPDATE SET "respostaTexto" = EXCLUDED."respostaTexto"
    `, [
      respostaTextoId,
      questaoTextoId,
      inscricao.id,
      envioId,
      'Herança é um mecanismo fundamental em programação orientada a objetos que permite que uma classe (classe filha) herde características (atributos e métodos) de outra classe (classe pai). Isso promove reutilização de código e estabelece uma relação "é um tipo de" entre classes.',
      false,
    ]);
    logResult('Resposta TEXTO', true, 'Resposta de texto criada', { respostaId: respostaTextoId });

    // 11. TESTE 8: Criar resposta MULTIPLA_ESCOLHA (2 alt) - CORRETA
    console.log('\n✍️  TESTE 8: Criando resposta para questão MULTIPLA_ESCOLHA (2 alt) - CORRETA...');
    const respostaME2Id = randomUUID();
    await client.query(`
      INSERT INTO "CursosTurmasProvasRespostas" (id, "questaoId", "inscricaoId", "envioId", "alternativaId", corrigida, nota)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT ("questaoId", "inscricaoId") DO UPDATE SET "alternativaId" = EXCLUDED."alternativaId", nota = EXCLUDED.nota
    `, [respostaME2Id, questaoME2Id, inscricao.id, envioId, altME2_2, true, 1.5]);
    logResult('Resposta MULTIPLA_ESCOLHA (correta)', true, 'Resposta correta criada', {
      respostaId: respostaME2Id,
      alternativaId: altME2_2,
      nota: 1.5,
    });

    // 12. TESTE 9: Criar resposta MULTIPLA_ESCOLHA (3 alt) - INCORRETA
    console.log('\n✍️  TESTE 9: Criando resposta para questão MULTIPLA_ESCOLHA (3 alt) - INCORRETA...');
    const respostaME3Id = randomUUID();
    await client.query(`
      INSERT INTO "CursosTurmasProvasRespostas" (id, "questaoId", "inscricaoId", "envioId", "alternativaId", corrigida, nota, observacoes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT ("questaoId", "inscricaoId") DO UPDATE SET "alternativaId" = EXCLUDED."alternativaId", nota = EXCLUDED.nota
    `, [respostaME3Id, questaoME3Id, inscricao.id, envioId, altME3_1, true, 0.0, 'Resposta incorreta. O método correto é POST.']);
    logResult('Resposta MULTIPLA_ESCOLHA (incorreta)', true, 'Resposta incorreta criada', {
      respostaId: respostaME3Id,
      alternativaId: altME3_1,
      nota: 0.0,
    });

    // 13. TESTE 10: Criar resposta MULTIPLA_ESCOLHA (4 alt) - CORRETA
    console.log('\n✍️  TESTE 10: Criando resposta para questão MULTIPLA_ESCOLHA (4 alt) - CORRETA...');
    const respostaME4Id = randomUUID();
    await client.query(`
      INSERT INTO "CursosTurmasProvasRespostas" (id, "questaoId", "inscricaoId", "envioId", "alternativaId", corrigida, nota)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT ("questaoId", "inscricaoId") DO UPDATE SET "alternativaId" = EXCLUDED."alternativaId", nota = EXCLUDED.nota
    `, [respostaME4Id, questaoME4Id, inscricao.id, envioId, altME4_3, true, 1.0]);
    logResult('Resposta MULTIPLA_ESCOLHA (4 alt - correta)', true, 'Resposta correta criada', {
      respostaId: respostaME4Id,
      alternativaId: altME4_3,
      nota: 1.0,
    });

    // 14. TESTE 11: Criar resposta MULTIPLA_ESCOLHA (5 alt) - CORRETA
    console.log('\n✍️  TESTE 11: Criando resposta para questão MULTIPLA_ESCOLHA (5 alt) - CORRETA...');
    const respostaME5Id = randomUUID();
    await client.query(`
      INSERT INTO "CursosTurmasProvasRespostas" (id, "questaoId", "inscricaoId", "envioId", "alternativaId", corrigida, nota)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT ("questaoId", "inscricaoId") DO UPDATE SET "alternativaId" = EXCLUDED."alternativaId", nota = EXCLUDED.nota
    `, [respostaME5Id, questaoME5Id, inscricao.id, envioId, altME5_2, true, 2.5]);
    logResult('Resposta MULTIPLA_ESCOLHA (5 alt - correta)', true, 'Resposta correta criada', {
      respostaId: respostaME5Id,
      alternativaId: altME5_2,
      nota: 2.5,
    });

    // 15. TESTE 12: Criar resposta ANEXO
    console.log('\n✍️  TESTE 12: Criando resposta para questão ANEXO...');
    const respostaAnexoId = randomUUID();
    await client.query(`
      INSERT INTO "CursosTurmasProvasRespostas" (id, "questaoId", "inscricaoId", "envioId", "anexoUrl", "anexoNome", corrigida)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT ("questaoId", "inscricaoId") DO UPDATE SET "anexoUrl" = EXCLUDED."anexoUrl", "anexoNome" = EXCLUDED."anexoNome"
    `, [
      respostaAnexoId,
      questaoAnexoId,
      inscricao.id,
      envioId,
      'https://storage.example.com/curriculo-portfolio.pdf',
      'curriculo_portfolio_joao_silva.pdf',
      false,
    ]);
    logResult('Resposta ANEXO', true, 'Resposta de anexo criada', {
      respostaId: respostaAnexoId,
      anexoUrl: 'https://storage.example.com/curriculo-portfolio.pdf',
    });

    // 16. TESTE 13: Corrigir resposta TEXTO
    console.log('\n📝 TESTE 13: Corrigindo resposta TEXTO...');
    await client.query(`
      UPDATE "CursosTurmasProvasRespostas"
      SET corrigida = $1, nota = $2, observacoes = $3
      WHERE id = $4
    `, [
      true,
      8.5,
      'Boa resposta! Você explicou bem o conceito de herança e deu um exemplo prático. Poderia ter mencionado também polimorfismo e encapsulamento.',
      respostaTextoId,
    ]);
    logResult('Corrigir Resposta TEXTO', true, 'Resposta de texto corrigida', { nota: 8.5 });

    // 17. TESTE 14: Corrigir resposta ANEXO
    console.log('\n📝 TESTE 14: Corrigindo resposta ANEXO...');
    await client.query(`
      UPDATE "CursosTurmasProvasRespostas"
      SET corrigida = $1, nota = $2, observacoes = $3
      WHERE id = $4
    `, [
      true,
      9.0,
      'Arquivo recebido e avaliado. Currículo bem estruturado e portfólio interessante.',
      respostaAnexoId,
    ]);
    logResult('Corrigir Resposta ANEXO', true, 'Resposta de anexo corrigida', { nota: 9.0 });

    // 18. Validação final
    console.log('\n🔍 Validação final...');
    const validacaoResult = await client.query(`
      SELECT 
        p.id as prova_id,
        p.titulo,
        p."valePonto",
        COUNT(DISTINCT q.id) as total_questoes,
        COUNT(DISTINCT a.id) as total_alternativas,
        COUNT(DISTINCT r.id) as total_respostas,
        COUNT(DISTINCT CASE WHEN r.corrigida THEN r.id END) as respostas_corrigidas,
        SUM(CASE WHEN r.corrigida THEN r.nota ELSE 0 END) as soma_notas
      FROM "CursosTurmasProvas" p
      LEFT JOIN "CursosTurmasProvasQuestoes" q ON q."provaId" = p.id
      LEFT JOIN "CursosTurmasProvasQuestoesAlternativas" a ON a."questaoId" = q.id
      LEFT JOIN "CursosTurmasProvasRespostas" r ON r."questaoId" = q.id
      WHERE p.id = $1
      GROUP BY p.id, p.titulo, p."valePonto"
    `, [provaId]);

    if (validacaoResult.rows.length > 0) {
      const validacao = validacaoResult.rows[0];
      console.log('\n📊 Resumo Final:');
      console.log(`   Prova: ${validacao.titulo}`);
      console.log(`   Vale Ponto: ${validacao.valePonto}`);
      console.log(`   Questões: ${validacao.total_questoes}`);
      console.log(`   Alternativas: ${validacao.total_alternativas}`);
      console.log(`   Respostas: ${validacao.total_respostas}`);
      console.log(`   Respostas corrigidas: ${validacao.respostas_corrigidas}`);
      console.log(`   Soma das notas: ${parseFloat(validacao.soma_notas || 0).toFixed(1)}`);

      // Detalhes por questão
      const questoesResult = await client.query(`
        SELECT 
          q.id,
          q.ordem,
          q.tipo,
          q.enunciado,
          q.peso,
          q.obrigatoria,
          COUNT(DISTINCT a.id) as num_alternativas,
          COUNT(DISTINCT r.id) as num_respostas,
          COUNT(DISTINCT CASE WHEN r.corrigida THEN r.id END) as respostas_corrigidas
        FROM "CursosTurmasProvasQuestoes" q
        LEFT JOIN "CursosTurmasProvasQuestoesAlternativas" a ON a."questaoId" = q.id
        LEFT JOIN "CursosTurmasProvasRespostas" r ON r."questaoId" = q.id
        WHERE q."provaId" = $1
        GROUP BY q.id, q.ordem, q.tipo, q.enunciado, q.peso, q.obrigatoria
        ORDER BY q.ordem
      `, [provaId]);

      console.log('\n   📝 Detalhes por questão:');
      for (const q of questoesResult.rows) {
        console.log(`\n   Questão ${q.ordem} (${q.tipo}):`);
        console.log(`     Enunciado: ${q.enunciado.substring(0, 60)}...`);
        console.log(`     Peso: ${q.peso}`);
        console.log(`     Obrigatória: ${q.obrigatoria}`);
        console.log(`     Alternativas: ${q.num_alternativas}`);
        console.log(`     Respostas: ${q.num_respostas}`);
        console.log(`     Corrigidas: ${q.respostas_corrigidas}`);
      }

      logResult('Validação Final', true, 'Prova completa validada', {
        questoes: parseInt(validacao.total_questoes),
        alternativas: parseInt(validacao.total_alternativas),
        respostas: parseInt(validacao.total_respostas),
        corrigidas: parseInt(validacao.respostas_corrigidas),
        somaNotas: parseFloat(validacao.soma_notas || 0).toFixed(1),
      });
    }

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
      });
    }

    return {
      success: falhas === 0,
      results,
    };
  } catch (error: any) {
    console.error('\n❌ Erro durante os testes:', error.message);
    console.error('Stack:', error.stack);
    logResult('Erro Geral', false, error.message);
    throw error;
  } finally {
    await client.end();
    console.log('\n🔌 Conexão fechada');
  }
}

// Executar testes
testQuestoesCompletasSQL()
  .then((result) => {
    console.log('\n✨ Testes concluídos!');
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n💥 Falha crítica nos testes:', error);
    process.exit(1);
  });

