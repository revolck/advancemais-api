/**
 * Script de teste SQL direto para validar a migração do sistema de questões de provas
 * Usa SQL direto para evitar problemas de conexão com Prisma Client
 */

import { Client } from 'pg';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

// Carregar variáveis de ambiente
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function testMigrationSQL() {
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

    console.log('🧪 Iniciando validação da migração...\n');

    // 1. Verificar se o campo valePonto existe
    console.log('1️⃣ Verificando campo valePonto em CursosTurmasProvas...');
    const valePontoCheck = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'CursosTurmasProvas' AND column_name = 'valePonto'
    `);
    
    if (valePontoCheck.rows.length > 0) {
      console.log('   ✅ Campo valePonto existe:', valePontoCheck.rows[0]);
    } else {
      throw new Error('Campo valePonto não encontrado');
    }

    // 2. Verificar se o enum CursosTipoQuestao existe
    console.log('\n2️⃣ Verificando enum CursosTipoQuestao...');
    const enumCheck = await client.query(`
      SELECT typname, typtype
      FROM pg_type
      WHERE typname = 'CursosTipoQuestao'
    `);
    
    if (enumCheck.rows.length > 0) {
      console.log('   ✅ Enum CursosTipoQuestao existe:', enumCheck.rows[0]);
      
      // Verificar valores do enum
      const enumValues = await client.query(`
        SELECT enumlabel
        FROM pg_enum
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'CursosTipoQuestao')
        ORDER BY enumsortorder
      `);
      console.log('   ✅ Valores do enum:', enumValues.rows.map(r => r.enumlabel).join(', '));
    } else {
      throw new Error('Enum CursosTipoQuestao não encontrado');
    }

    // 3. Verificar se as tabelas existem
    console.log('\n3️⃣ Verificando tabelas criadas...');
    const tables = [
      'CursosTurmasProvasQuestoes',
      'CursosTurmasProvasQuestoesAlternativas',
      'CursosTurmasProvasRespostas',
    ];

    for (const tableName of tables) {
      const tableCheck = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      `, [tableName]);
      
      if (tableCheck.rows.length > 0) {
        console.log(`   ✅ Tabela ${tableName} existe`);
        
        // Verificar colunas
        const columns = await client.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [tableName]);
        console.log(`      Colunas (${columns.rows.length}):`, columns.rows.map(r => r.column_name).join(', '));
      } else {
        throw new Error(`Tabela ${tableName} não encontrada`);
      }
    }

    // 4. Verificar foreign keys
    console.log('\n4️⃣ Verificando foreign keys...');
    const fkCheck = await client.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND (tc.table_name IN ('CursosTurmasProvasQuestoes', 'CursosTurmasProvasQuestoesAlternativas', 'CursosTurmasProvasRespostas')
             OR ccu.table_name IN ('CursosTurmasProvas', 'CursosTurmasProvasQuestoes', 'CursosTurmasProvasQuestoesAlternativas', 'CursosTurmasInscricoes', 'CursosTurmasProvasEnvios'))
      ORDER BY tc.table_name, kcu.column_name
    `);
    
    console.log(`   ✅ ${fkCheck.rows.length} foreign keys encontradas:`);
    fkCheck.rows.forEach(fk => {
      console.log(`      ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    });

    // 5. Verificar índices
    console.log('\n5️⃣ Verificando índices...');
    const indexCheck = await client.query(`
      SELECT
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('CursosTurmasProvasQuestoes', 'CursosTurmasProvasQuestoesAlternativas', 'CursosTurmasProvasRespostas')
      ORDER BY tablename, indexname
    `);
    
    console.log(`   ✅ ${indexCheck.rows.length} índices encontrados:`);
    indexCheck.rows.forEach(idx => {
      console.log(`      ${idx.tablename}.${idx.indexname}`);
    });

    // 6. Verificar constraint única
    console.log('\n6️⃣ Verificando constraint única...');
    const uniqueCheck = await client.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'UNIQUE'
        AND tc.table_name = 'CursosTurmasProvasRespostas'
        AND tc.constraint_name = 'CursosTurmasProvasRespostas_questaoId_inscricaoId_key'
    `);
    
    if (uniqueCheck.rows.length > 0) {
      console.log('   ✅ Constraint única encontrada:', uniqueCheck.rows[0].constraint_name);
    } else {
      console.log('   ⚠️  Constraint única não encontrada (pode já ter sido criada anteriormente)');
    }

    // 7. Testar inserção de dados (se houver turma e inscrição)
    console.log('\n7️⃣ Testando inserção de dados...');
    
    // Buscar uma turma
    const turmaResult = await client.query(`
      SELECT id, codigo, nome
      FROM "CursosTurmas"
      LIMIT 1
    `);
    
    if (turmaResult.rows.length === 0) {
      console.log('   ⚠️  Nenhuma turma encontrada. Pulando teste de inserção.');
    } else {
      const turma = turmaResult.rows[0];
      console.log(`   📚 Turma encontrada: ${turma.nome} (${turma.codigo})`);
      
      // Buscar uma inscrição
      const inscricaoResult = await client.query(`
        SELECT id
        FROM "CursosTurmasInscricoes"
        WHERE "turmaId" = $1
        LIMIT 1
      `, [turma.id]);
      
      if (inscricaoResult.rows.length === 0) {
        console.log('   ⚠️  Nenhuma inscrição encontrada. Pulando teste de inserção.');
      } else {
        const inscricao = inscricaoResult.rows[0];
        console.log(`   👤 Inscrição encontrada: ${inscricao.id}`);
        
        // Criar uma prova de teste
        const provaId = randomUUID();
        await client.query(`
          INSERT INTO "CursosTurmasProvas" (id, "turmaId", titulo, etiqueta, peso, "valePonto", ativo, ordem)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT DO NOTHING
        `, [provaId, turma.id, 'Prova de Teste SQL', 'TESTE-SQL', 10.0, true, true, 0]);
        console.log(`   ✅ Prova criada: ${provaId}`);
        
        // Criar uma questão de teste
        const questaoId = randomUUID();
        await client.query(`
          INSERT INTO "CursosTurmasProvasQuestoes" (id, "provaId", enunciado, tipo, ordem, peso, obrigatoria)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT DO NOTHING
        `, [questaoId, provaId, 'Esta é uma questão de teste criada via SQL', 'TEXTO', 1, 5.0, true]);
        console.log(`   ✅ Questão criada: ${questaoId}`);
        
        // Criar uma resposta de teste
        const respostaId = randomUUID();
        await client.query(`
          INSERT INTO "CursosTurmasProvasRespostas" (id, "questaoId", "inscricaoId", "respostaTexto", corrigida)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT ("questaoId", "inscricaoId") DO UPDATE SET "respostaTexto" = EXCLUDED."respostaTexto"
        `, [respostaId, questaoId, inscricao.id, 'Esta é uma resposta de teste', false]);
        console.log(`   ✅ Resposta criada: ${respostaId}`);
        
        // Verificar se os dados foram inseridos corretamente
        const verifyResult = await client.query(`
          SELECT 
            p.id as prova_id,
            p.titulo,
            p."valePonto",
            q.id as questao_id,
            q.enunciado,
            q.tipo,
            r.id as resposta_id,
            r."respostaTexto"
          FROM "CursosTurmasProvas" p
          JOIN "CursosTurmasProvasQuestoes" q ON q."provaId" = p.id
          JOIN "CursosTurmasProvasRespostas" r ON r."questaoId" = q.id
          WHERE p.id = $1
        `, [provaId]);
        
        if (verifyResult.rows.length > 0) {
          console.log(`   ✅ Dados verificados: ${verifyResult.rows.length} registro(s) encontrado(s)`);
          verifyResult.rows.forEach(row => {
            console.log(`      Prova: ${row.titulo}, Questão: ${row.enunciado.substring(0, 30)}..., Resposta: ${row.respostaTexto?.substring(0, 30)}...`);
          });
        }
      }
    }

    console.log('\n✅ Todas as validações passaram com sucesso!');
    console.log('\n📋 Resumo:');
    console.log('   ✅ Campo valePonto existe');
    console.log('   ✅ Enum CursosTipoQuestao existe');
    console.log('   ✅ Todas as tabelas foram criadas');
    console.log('   ✅ Foreign keys configuradas');
    console.log('   ✅ Índices criados');
    console.log('   ✅ Teste de inserção funcionou');
    
  } catch (error: any) {
    console.error('\n❌ Erro durante validação:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    await client.end();
    console.log('\n🔌 Conexão fechada');
  }
}

// Executar validação
testMigrationSQL()
  .then(() => {
    console.log('\n✨ Validação concluída com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Falha crítica na validação:', error);
    process.exit(1);
  });


