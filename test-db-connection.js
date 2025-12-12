require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

async function testConnection() {
  try {
    console.log('🔍 Testando conexão com o banco...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Definida' : 'NÃO definida');
    console.log('DIRECT_URL:', process.env.DIRECT_URL ? 'Definida' : 'NÃO definida');

    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Conexão bem-sucedida!', result);

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro na conexão:', error.message);
    console.error('Código do erro:', error.code);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testConnection();
