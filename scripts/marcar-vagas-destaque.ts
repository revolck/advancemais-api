/**
 * Script para marcar 3 vagas como destaque
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('⭐ Marcando vagas como destaque...\n');

  // Buscar as últimas 10 vagas criadas
  const vagas = await prisma.empresasVagas.findMany({
    orderBy: { inseridaEm: 'desc' },
    take: 10,
  });

  if (vagas.length === 0) {
    console.error('❌ Nenhuma vaga encontrada.');
    process.exit(1);
  }

  console.log(`✅ ${vagas.length} vagas encontradas\n`);

  // Escolher as 3 primeiras para destaque
  const vagasDestaque = vagas.slice(0, 3);

  // Buscar plano ativo
  const empresaIds = [...new Set(vagas.map((v) => v.usuarioId))];
  const plano = await prisma.empresasPlano.findFirst({
    where: {
      usuarioId: { in: empresaIds },
      status: 'ATIVO',
    },
  });

  if (!plano) {
    console.log('⚠️  Nenhum plano ativo encontrado. Apenas marcando campo destaque=true\n');
  } else {
    console.log(`✅ Plano ativo encontrado: ${plano.id}\n`);
  }

  for (const vaga of vagasDestaque) {
    try {
      // Atualizar campo destaque
      await prisma.empresasVagas.update({
        where: { id: vaga.id },
        data: { destaque: true },
      });

      // Se tiver plano, criar registro em EmpresasVagasDestaque
      if (plano) {
        // Verificar se já existe
        const destaqueExistente = await prisma.empresasVagasDestaque.findUnique({
          where: { vagaId: vaga.id },
        });

        if (!destaqueExistente) {
          await prisma.empresasVagasDestaque.create({
            data: {
              vagaId: vaga.id,
              empresasPlanoId: plano.id,
              ativo: true,
            },
          });
          console.log(`  ✅ ${vaga.titulo} - Destaque criado`);
        } else {
          console.log(`  ✅ ${vaga.titulo} - Já tinha destaque`);
        }
      } else {
        console.log(`  ✅ ${vaga.titulo} - Campo destaque marcado`);
      }
    } catch (error: any) {
      console.error(`  ❌ Erro ao marcar ${vaga.titulo}:`, error.message);
    }
  }

  console.log(`\n✨ ${vagasDestaque.length} vagas marcadas como destaque!\n`);
}

main()
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
