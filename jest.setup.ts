// Setup file para Jest - carrega variáveis de ambiente e configura NODE_ENV
import dotenv from 'dotenv';

// Carregar variáveis de ambiente do .env; um .env.test, se existir, vence (ex.: banco de
// testes em DATABASE_URL e DIRECT_URL — o Prisma usa DIRECT_URL primeiro)
dotenv.config();
dotenv.config({ path: '.env.test', override: true });

// Garantir que NODE_ENV seja 'test' durante os testes
process.env.NODE_ENV = 'test';
