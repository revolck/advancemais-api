// Setup file para Jest - carrega variáveis de ambiente e configura NODE_ENV
import dotenv from 'dotenv';

// Carregar variáveis de ambiente do .env
dotenv.config();

// Garantir que NODE_ENV seja 'test' durante os testes
process.env.NODE_ENV = 'test';
