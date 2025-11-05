/**
 * Seed Principal - Orquestra todos os seeds
 * Execute: npx ts-node prisma/seed.ts
 */

import { PrismaClient } from '@prisma/client';
import { seedUsuarios } from './seeds/seed-usuarios';
import { seedAreasInteresse } from './seeds/seed-areas-interesse';
import { seedVagas } from './seeds/seed-vagas';
import { seedCurriculosCandidaturas } from './seeds/seed-curriculos-candidaturas';
import { seedCursos } from './seeds/seed-cursos';
import { seedStatusProcesso } from './seeds/seed-status-processo';

// Usar DIRECT_URL para seeds (conexão direta, sem pooler)
const datasourceUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
const prisma = new PrismaClient({
  datasourceUrl,
});

async function main() {
  console.log('🚀 Iniciando seed completo do banco de dados...\n');
  console.log('═══════════════════════════════════════════════════\n');

  try {
    // 1. Usuários (todas as roles)
    console.log('👥 ETAPA 1/6: Usuários');
    console.log('───────────────────────────────────────────────────');
    await seedUsuarios(prisma);

    // 2. Status Processo
    console.log('\n📊 ETAPA 2/6: Status Processo');
    console.log('───────────────────────────────────────────────────');
    await seedStatusProcesso(prisma);

    // 3. Áreas de Interesse
    console.log('\n🏷️  ETAPA 3/6: Áreas de Interesse');
    console.log('───────────────────────────────────────────────────');
    await seedAreasInteresse(prisma);

    // 4. Vagas
    console.log('\n💼 ETAPA 4/6: Vagas');
    console.log('───────────────────────────────────────────────────');
    await seedVagas(prisma);

    // 5. Currículos e Candidaturas
    console.log('\n📄 ETAPA 5/6: Currículos e Candidaturas');
    console.log('───────────────────────────────────────────────────');
    await seedCurriculosCandidaturas(prisma);

    // 6. Cursos e Turmas
    console.log('\n📚 ETAPA 6/6: Cursos e Turmas');
    console.log('───────────────────────────────────────────────────');
    await seedCursos(prisma);

    console.log('\n═══════════════════════════════════════════════════');
    console.log('✨ Seed completo finalizado com sucesso!');
    console.log('═══════════════════════════════════════════════════\n');

    // Estatísticas
    const stats = await getStats();
    console.log('📊 ESTATÍSTICAS DO BANCO DE DADOS:');
    console.log('───────────────────────────────────────────────────');
    console.log(`  👥 Usuários: ${stats.usuarios}`);
    console.log(`     - Admin/Moderadores: ${stats.admins}`);
    console.log(`     - Empresas: ${stats.empresas}`);
    console.log(`     - Candidatos: ${stats.candidatos}`);
    console.log(`     - Outros: ${stats.outros}\n`);
    console.log(`  🏷️  Áreas de Interesse: ${stats.areas}`);
    console.log(`  💼 Vagas Publicadas: ${stats.vagas}`);
    console.log(`  📄 Currículos: ${stats.curriculos}`);
    console.log(`  📮 Candidaturas: ${stats.candidaturas}`);
    console.log(`  📚 Cursos: ${stats.cursos}`);
    console.log(`  🎓 Turmas: ${stats.turmas}`);
    console.log('───────────────────────────────────────────────────\n');

    console.log('📝 CREDENCIAIS DE ACESSO:');
    console.log('───────────────────────────────────────────────────');
    console.log('  🔑 Admin:');
    console.log('     Email: admin@advancemais.com.br');
    console.log('     Senha: Admin@123\n');
    console.log('  🔑 Moderador:');
    console.log('     Email: moderador@advancemais.com.br');
    console.log('     Senha: Moderador@123\n');
    console.log('  🔑 Setor de Vagas:');
    console.log('     Email: setor.vagas@advancemais.com.br');
    console.log('     Senha: SetorVagas@123\n');
    console.log('  🔑 Empresa:');
    console.log('     Email: empresa1@example.com');
    console.log('     Senha: Empresa@123\n');
    console.log('  🔑 Candidato:');
    console.log('     Email: joao.silva@example.com');
    console.log('     Senha: Candidato@123');
    console.log('───────────────────────────────────────────────────\n');

    console.log('🎯 Próximos passos:');
    console.log('   1. Inicie o servidor: pnpm run dev');
    console.log('   2. Acesse o Swagger: http://localhost:3000/docs');
    console.log('   3. Faça login com as credenciais acima\n');
  } catch (error) {
    console.error('\n❌ Erro durante o seed:', error);
    throw error;
  }
}

async function getStats() {
  const [
    usuarios,
    admins,
    empresas,
    candidatos,
    outros,
    areas,
    vagas,
    curriculos,
    candidaturas,
    cursos,
    turmas,
  ] = await Promise.all([
    prisma.usuarios.count(),
    prisma.usuarios.count({ where: { role: { in: ['ADMIN', 'MODERADOR'] } } }),
    prisma.usuarios.count({ where: { role: 'EMPRESA' } }),
    prisma.usuarios.count({ where: { role: 'ALUNO_CANDIDATO' } }),
    prisma.usuarios.count({
      where: {
        role: {
          in: ['INSTRUTOR', 'PEDAGOGICO', 'FINANCEIRO', 'SETOR_DE_VAGAS', 'RECRUTADOR'],
        },
      },
    }),
    prisma.candidatosAreasInteresse.count(),
    prisma.empresasVagas.count({ where: { status: 'PUBLICADO' } }),
    prisma.usuariosCurriculos.count(),
    prisma.empresasCandidatos.count(),
    prisma.cursos.count(),
    prisma.cursosTurmas.count(),
  ]);

  return {
    usuarios,
    admins,
    empresas,
    candidatos,
    outros,
    areas,
    vagas,
    curriculos,
    candidaturas,
    cursos,
    turmas,
  };
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
