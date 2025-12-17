import { Client } from 'pg';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function markMigrationApplied() {
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
    console.log('✅ Conectado com sucesso!');

    const migrationName = '20251216000001_add_provas_questoes_system';
    const checksum = 'migration_applied_manually'; // Checksum placeholder
    const finishedAt = new Date();
    const startedAt = finishedAt;

    // Verificar se a migração já está registrada
    const checkResult = await client.query(
      `SELECT * FROM "_prisma_migrations" WHERE migration_name = $1`,
      [migrationName]
    );

    if (checkResult.rows.length > 0) {
      console.log('✅ Migração já está marcada como aplicada');
      return;
    }

    // Inserir registro na tabela _prisma_migrations
    await client.query(
      `INSERT INTO "_prisma_migrations" (migration_name, checksum, finished_at, started_at, applied_steps_count)
       VALUES ($1, $2, $3, $4, $5)`,
      [migrationName, checksum, finishedAt, startedAt, 1]
    );

    console.log(`✅ Migração ${migrationName} marcada como aplicada!`);
  } catch (error: any) {
    console.error('❌ Erro ao marcar migração:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 Conexão fechada');
  }
}

markMigrationApplied()
  .then(() => {
    console.log('✨ Processo concluído');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Falha crítica:', error);
    process.exit(1);
  });

