const { Client } = require('pg');
require('dotenv').config();

async function testConnection() {
  console.log('🔍 TESTE DE CONEXÃO DIRETA COM POSTGRESQL\n');
  console.log('='.repeat(50));

  // Extrair dados da DATABASE_URL
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('❌ DATABASE_URL não encontrada no .env');
    process.exit(1);
  }

  console.log('✅ DATABASE_URL encontrada');
  console.log('📍 Host:', dbUrl.match(/@([^:]+):/)?.[1] || 'N/A');
  console.log('');

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });

  try {
    console.log('🔄 Tentando conectar...');
    const startTime = Date.now();

    await client.connect();

    const elapsed = Date.now() - startTime;
    console.log(`✅ CONECTADO COM SUCESSO! (${elapsed}ms)`);
    console.log('');

    // Testar query simples
    console.log('🧪 Testando query simples...');
    const result = await client.query(
      'SELECT NOW() as now, current_database() as db, version() as version',
    );

    console.log('✅ Query executada com sucesso!');
    console.log('📊 Resultado:');
    console.log('  - Hora atual:', result.rows[0].now);
    console.log('  - Database:', result.rows[0].db);
    console.log(
      '  - Versão:',
      result.rows[0].version.split(' ')[0],
      result.rows[0].version.split(' ')[1],
    );
    console.log('');

    // Testar query na tabela de usuários
    console.log('🧪 Testando query na tabela Usuarios...');
    const usersResult = await client.query('SELECT COUNT(*) as count FROM "Usuarios"');
    console.log(`✅ Total de usuários: ${usersResult.rows[0].count}`);

    console.log('');
    console.log('='.repeat(50));
    console.log('🎉 TODOS OS TESTES PASSARAM! A CONEXÃO ESTÁ FUNCIONANDO!');
    console.log('='.repeat(50));
  } catch (error) {
    console.error('');
    console.error('='.repeat(50));
    console.error('❌ ERRO NA CONEXÃO:');
    console.error('='.repeat(50));
    console.error('');
    console.error('Mensagem:', error.message);
    console.error('Código:', error.code);
    console.error('');

    if (error.code === 'ENOTFOUND') {
      console.error('🔍 Diagnóstico: DNS não resolveu o hostname');
      console.error('   Verifique se o hostname está correto na DATABASE_URL');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('🔍 Diagnóstico: Conexão recusada');
      console.error('   O servidor pode estar offline ou o firewall está bloqueando');
    } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      console.error('🔍 Diagnóstico: Timeout de conexão');
      console.error('   A rede está lenta ou o servidor não está respondendo');
    } else if (error.message.includes('password') || error.message.includes('authentication')) {
      console.error('🔍 Diagnóstico: Falha de autenticação');
      console.error('   Verifique usuário e senha na DATABASE_URL');
    }

    console.error('');
    process.exit(1);
  } finally {
    await client.end();
  }
}

testConnection();
