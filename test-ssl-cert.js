const { Client } = require('pg');
const tls = require('tls');

// Configurar para capturar detalhes do certificado
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Temporariamente desabilitar para capturar cert

const cs = process.env.DATABASE_URL;
if (!cs) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

console.log('=== Tentando conexão PostgreSQL com captura de certificado ===\n');

const client = new Client({ 
  connectionString: cs,
  statement_timeout: 15000,
  connectionTimeoutMillis: 10000,
  ssl: {
    rejectUnauthorized: false, // Temporariamente para capturar cert
  }
});

// Hook no evento de conexão TLS para capturar certificado
const originalConnect = client.connect.bind(client);

client.connect = async function() {
  try {
    // Criar socket TLS customizado para capturar certificado
    const url = new URL(cs);
    const host = url.hostname;
    const port = parseInt(url.port || '5432');
    
    console.log(`Conectando a ${host}:${port}...`);
    
    // Tentar conexão direta TLS (não funciona com PostgreSQL)
    // Vamos usar a conexão pg normal mas capturar erros detalhados
    
    await originalConnect();
    console.log('✅ Conectado com sucesso');
    
    const result = await client.query('SELECT current_database() as db, current_user as user');
    console.log('Query result:', result.rows);
    
  } catch (error) {
    console.error('\n=== ERRO DETALHADO ===');
    console.error('Mensagem:', error.message);
    console.error('Código:', error.code);
    console.error('Stack:', error.stack);
    
    // Tentar extrair informações do certificado do erro
    if (error.cert) {
      console.error('\n=== CERTIFICADO CAPTURADO ===');
      console.error('Subject:', error.cert.subject);
      console.error('Issuer:', error.cert.issuer);
      console.error('Valid from:', error.cert.valid_from);
      console.error('Valid to:', error.cert.valid_to);
    }
    
    // Verificar se há informações de socket TLS
    if (error.socket) {
      console.error('\n=== INFORMAÇÕES DO SOCKET ===');
      const socket = error.socket;
      if (socket.getPeerCertificate) {
        try {
          const cert = socket.getPeerCertificate(true); // true = incluir cadeia completa
          if (cert) {
            console.error('Peer Certificate Subject:', cert.subject);
            console.error('Peer Certificate Issuer:', cert.issuer);
            console.error('Peer Certificate Serial:', cert.serialNumber);
            
            // Verificar se issuer == subject (autoassinado)
            if (cert.subject && cert.issuer && cert.subject === cert.issuer) {
              console.error('⚠️ CERTIFICADO AUTOASSINADO DETECTADO!');
            }
          }
        } catch (e) {
          console.error('Erro ao obter certificado do socket:', e.message);
        }
      }
    }
    
    process.exitCode = 1;
  } finally {
    try {
      await client.end();
    } catch (e) {}
  }
};

client.connect().catch(() => {});

