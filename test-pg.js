const { Client } = require('pg');
(async () => {
  const cs = process.env.DATABASE_URL;
  if (!cs) {
    console.error('DATABASE_URL not set in env for node test');
    process.exit(2);
  }
  const client = new Client({ connectionString: cs, statement_timeout: 15000, connectionTimeoutMillis: 10000 });
  try {
    console.log('Attempting connection...');
    await client.connect();
    console.log('Connected successfully');
    const r = await client.query('SELECT current_database() as db, current_user as user, now() as now');
    console.log('OK', JSON.stringify(r.rows, null, 2));
    const s = await client.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'pg_pgrst_no_exposed_schemas'");
    console.log('pg_pgrst_no_exposed_schemas exists:', s.rows.length > 0);
  } catch (e) {
    console.error('NODE-ERROR', e.message || e);
    console.error('Error code:', e.code);
    console.error('Error stack:', e.stack);
    process.exitCode = 1;
  } finally {
    try { await client.end(); } catch(e) {}
  }
})();
