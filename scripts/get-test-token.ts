/**
 * Script para obter token de teste
 */

import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

async function main() {
  console.log('🔐 Obtendo token de teste...\n');

  try {
    // Buscar usuário admin
    const admin = await prisma.usuarios.findFirst({
      where: {
        role: { in: ['ADMIN', 'SUPER_ADMINISTRADOR', 'MODERADOR'] },
        status: 'ATIVO',
      },
      select: {
        id: true,
        email: true,
        nomeCompleto: true,
        role: true,
        authId: true,
      },
    });

    if (!admin) {
      console.log('❌ Nenhum usuário admin encontrado');
      return;
    }

    console.log('✅ Usuário encontrado:');
    console.log('   Email:', admin.email);
    console.log('   Nome:', admin.nomeCompleto);
    console.log('   Role:', admin.role);
    console.log('   ID:', admin.id);

    // Gerar token JWT
    const JWT_SECRET = process.env.JWT_SECRET || 'secret';
    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        authId: admin.authId,
      },
      JWT_SECRET,
      { expiresIn: '7d' },
    );

    console.log('\n🎟️  TOKEN GERADO:');
    console.log('═'.repeat(80));
    console.log(token);
    console.log('═'.repeat(80));

    console.log('\n📋 Use este token nos testes:');
    console.log(`   Authorization: Bearer ${token}\n`);

    console.log('🧪 Exemplo de teste:');
    console.log(
      `   curl -H "Authorization: Bearer ${token}" http://localhost:3000/api/v1/cursos/aulas\n`,
    );
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
