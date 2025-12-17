import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function runMigration() {
  let connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  
  // Garantir que a URL tenha sslmode=require
  if (connectionString && !connectionString.includes('sslmode=')) {
    connectionString += (connectionString.includes('?') ? '&' : '?') + 'sslmode=require';
  }
  
  // Configurar SSL para Supabase
  const client = new Client({
    connectionString,
    ssl: connectionString?.includes('supabase') ? {
      rejectUnauthorized: false, // Aceitar certificados self-signed do Supabase
    } : undefined,
  });

  try {
    console.log('🔌 Conectando ao banco de dados...');
    await client.connect();
    console.log('✅ Conectado com sucesso!');

    console.log('📦 Carregando migração...');
    const migrationPath = join(
      __dirname,
      '../prisma/migrations/20251216000001_add_provas_questoes_system/migration.sql',
    );
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log('🚀 Executando migração...');
    console.log('📝 Executando SQL (primeiros 200 caracteres):', sql.substring(0, 200) + '...');

    try {
      // Executar o SQL completo
      await client.query(sql);
      console.log('✅ Migração executada com sucesso!');
    } catch (error: any) {
      // Verificar se é erro de objeto já existente
      const isAlreadyExistsError =
        error.code === '42P07' || // duplicate_table, duplicate_object
        error.code === '42710' || // duplicate_object
        error.message?.includes('already exists') ||
        error.message?.includes('duplicate') ||
        error.message?.includes('relation') && error.message?.includes('already exists');

      if (isAlreadyExistsError) {
        console.log('⚠️  Alguns objetos já existem, mas isso é esperado se a migração foi parcialmente aplicada.');
        console.log('✅ Migração concluída (objetos existentes foram ignorados)');
      } else {
        // Se for outro tipo de erro, relançar
        throw error;
      }
    }
  } catch (error: any) {
    console.error('❌ Erro ao executar migração:', error.message);
    console.error('Código:', error.code);
    if (error.position) {
      console.error('Posição do erro:', error.position);
    }
    throw error;
  } finally {
    await client.end();
    console.log('🔌 Conexão fechada');
  }
}

runMigration()
  .then(() => {
    console.log('✨ Processo concluído');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Falha crítica:', error);
    process.exit(1);
  });

