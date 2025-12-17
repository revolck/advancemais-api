/**
 * Script de teste completo com retry automático
 * Tenta conectar várias vezes até conseguir
 */

import { Client } from 'pg';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function connectWithRetry(maxRetries = 10, delayMs = 5000) {
  let connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  
  if (connectionString && !connectionString.includes('sslmode=')) {
    connectionString += (connectionString.includes('?') ? '&' : '?') + 'sslmode=require';
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const client = new Client({
      connectionString,
      ssl: connectionString?.includes('supabase') ? {
        rejectUnauthorized: false,
      } : undefined,
    });

    try {
      console.log(`🔌 Tentativa ${attempt}/${maxRetries} de conexão...`);
      await client.connect();
      console.log('✅ Conectado com sucesso!\n');
      return client;
    } catch (error: any) {
      if (error.code === 'XX000' && attempt < maxRetries) {
        console.log(`⚠️  Conexões esgotadas. Aguardando ${delayMs}ms antes de tentar novamente...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      throw error;
    }
  }
  
  throw new Error('Não foi possível conectar após todas as tentativas');
}

// Importar e executar o teste completo
async function runTests() {
  const client = await connectWithRetry();
  
  try {
    console.log('🧪 Iniciando testes completos do sistema de questões de provas...\n');

    // Buscar turma
    const turmaResult = await client.query(`
      SELECT id, codigo, nome
      FROM "CursosTurmas"
      WHERE status IN ('EM_ANDAMENTO', 'RASCUNHO', 'INSCRICOES_ABERTAS', 'PUBLICADO')
      LIMIT 1
    `);

    if (turmaResult.rows.length === 0) {
      throw new Error('Nenhuma turma encontrada.');
    }

    const turma = turmaResult.rows[0];
    console.log(`✅ Turma encontrada: ${turma.nome} (${turma.codigo})\n`);

    const inscricaoResult = await client.query(`
      SELECT id FROM "CursosTurmasInscricoes" WHERE "turmaId" = $1 LIMIT 1
    `, [turma.id]);

    if (inscricaoResult.rows.length === 0) {
      throw new Error('Nenhuma inscrição encontrada.');
    }

    const inscricao = inscricaoResult.rows[0];
    console.log(`✅ Inscrição encontrada\n`);

    // Criar prova com etiqueta única
    const etiquetaUnica = `TESTE-${Date.now()}`;
    const provaId = randomUUID();
    
    await client.query(`
      INSERT INTO "CursosTurmasProvas" (id, "turmaId", titulo, etiqueta, descricao, peso, "valePonto", ativo, ordem)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      provaId, turma.id,
      'Prova Completa - Teste de Todos os Tipos',
      etiquetaUnica,
      'Prova para testar todos os tipos de questões',
      10.0, true, true, 0,
    ]);
    console.log(`✅ Prova criada: ${provaId}\n`);

    // Criar questões
    const questoes = [
      { tipo: 'TEXTO', ordem: 1, peso: 3.0, enunciado: 'Explique o conceito de herança em POO.' },
      { tipo: 'MULTIPLA_ESCOLHA', ordem: 2, peso: 1.5, enunciado: 'Qual linguagem é mais usada no front-end?', alternativas: 2 },
      { tipo: 'MULTIPLA_ESCOLHA', ordem: 3, peso: 2.0, enunciado: 'Qual método HTTP cria recursos?', alternativas: 3 },
      { tipo: 'MULTIPLA_ESCOLHA', ordem: 4, peso: 1.0, enunciado: 'Qual é a capital do Brasil?', alternativas: 4 },
      { tipo: 'MULTIPLA_ESCOLHA', ordem: 5, peso: 2.5, enunciado: 'Qual framework JS é mais popular?', alternativas: 5 },
      { tipo: 'ANEXO', ordem: 6, peso: 5.0, enunciado: 'Envie seu currículo em PDF.' },
    ];

    const questoesCriadas = [];
    
    for (const q of questoes) {
      const questaoId = randomUUID();
      await client.query(`
        INSERT INTO "CursosTurmasProvasQuestoes" (id, "provaId", enunciado, tipo, ordem, peso, obrigatoria)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [questaoId, provaId, q.enunciado, q.tipo, q.ordem, q.peso, q.ordem <= 4]);

      if (q.tipo === 'MULTIPLA_ESCOLHA' && q.alternativas) {
        const alternativas = [];
        for (let i = 0; i < q.alternativas; i++) {
          const altId = randomUUID();
          const textos = [
            ['Python', 'JavaScript'],
            ['GET', 'POST', 'PUT'],
            ['São Paulo', 'Rio de Janeiro', 'Brasília', 'Belo Horizonte'],
            ['Angular', 'React', 'Vue.js', 'Svelte', 'Ember.js'],
          ];
          const corretas = [1, 1, 2, 1]; // Índices das corretas
          const texto = textos[q.alternativas - 2]?.[i] || `Alternativa ${i + 1}`;
          const correta = i === (corretas[q.alternativas - 2] || 0);
          
          await client.query(`
            INSERT INTO "CursosTurmasProvasQuestoesAlternativas" (id, "questaoId", texto, ordem, correta)
            VALUES ($1, $2, $3, $4, $5)
          `, [altId, questaoId, texto, i + 1, correta]);
          alternativas.push({ id: altId, correta });
        }
        questoesCriadas.push({ id: questaoId, tipo: q.tipo, alternativas });
        console.log(`✅ Questão ${q.ordem} (${q.tipo}) criada com ${q.alternativas} alternativas`);
      } else {
        questoesCriadas.push({ id: questaoId, tipo: q.tipo });
        console.log(`✅ Questão ${q.ordem} (${q.tipo}) criada`);
      }
    }

    // Criar envio
    const envioId = randomUUID();
    await client.query(`
      INSERT INTO "CursosTurmasProvasEnvios" (id, "provaId", "inscricaoId", "realizadoEm")
      VALUES ($1, $2, $3, $4)
    `, [envioId, provaId, inscricao.id, new Date()]);
    console.log(`\n✅ Envio criado\n`);

    // Criar respostas
    for (const questao of questoesCriadas) {
      const respostaId = randomUUID();
      
      if (questao.tipo === 'TEXTO') {
        await client.query(`
          INSERT INTO "CursosTurmasProvasRespostas" (id, "questaoId", "inscricaoId", "envioId", "respostaTexto", corrigida)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT ("questaoId", "inscricaoId") DO UPDATE SET "respostaTexto" = EXCLUDED."respostaTexto"
        `, [respostaId, questao.id, inscricao.id, envioId, 'Resposta de teste para questão de texto.', false]);
        console.log(`✅ Resposta TEXTO criada`);
      } else if (questao.tipo === 'MULTIPLA_ESCOLHA' && questao.alternativas) {
        const alternativaCorreta = questao.alternativas.find(a => a.correta);
        if (alternativaCorreta) {
          await client.query(`
            INSERT INTO "CursosTurmasProvasRespostas" (id, "questaoId", "inscricaoId", "envioId", "alternativaId", corrigida, nota)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT ("questaoId", "inscricaoId") DO UPDATE SET "alternativaId" = EXCLUDED."alternativaId"
          `, [respostaId, questao.id, inscricao.id, envioId, alternativaCorreta.id, true, 2.0]);
          console.log(`✅ Resposta MULTIPLA_ESCOLHA criada (correta)`);
        }
      } else if (questao.tipo === 'ANEXO') {
        await client.query(`
          INSERT INTO "CursosTurmasProvasRespostas" (id, "questaoId", "inscricaoId", "envioId", "anexoUrl", "anexoNome", corrigida)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT ("questaoId", "inscricaoId") DO UPDATE SET "anexoUrl" = EXCLUDED."anexoUrl"
        `, [respostaId, questao.id, inscricao.id, envioId, 'https://example.com/arquivo.pdf', 'teste.pdf', false]);
        console.log(`✅ Resposta ANEXO criada`);
      }
    }

    // Validação final
    console.log(`\n🔍 Validando dados criados...`);
    const validacao = await client.query(`
      SELECT 
        COUNT(DISTINCT q.id) as questoes,
        COUNT(DISTINCT a.id) as alternativas,
        COUNT(DISTINCT r.id) as respostas
      FROM "CursosTurmasProvas" p
      LEFT JOIN "CursosTurmasProvasQuestoes" q ON q."provaId" = p.id
      LEFT JOIN "CursosTurmasProvasQuestoesAlternativas" a ON a."questaoId" = q.id
      LEFT JOIN "CursosTurmasProvasRespostas" r ON r."questaoId" = q.id
      WHERE p.id = $1
    `, [provaId]);

    const stats = validacao.rows[0];
    console.log(`\n📊 Resumo Final:`);
    console.log(`   Questões: ${stats.questoes}`);
    console.log(`   Alternativas: ${stats.alternativas}`);
    console.log(`   Respostas: ${stats.respostas}`);
    console.log(`\n✅ Todos os testes passaram com sucesso!`);

  } finally {
    await client.end();
    console.log('\n🔌 Conexão fechada');
  }
}

runTests().catch(error => {
  console.error('\n💥 Erro:', error.message);
  process.exit(1);
});

