import { PrismaClient } from '@prisma/client';

import { seedCandidateInterestAreas } from './candidato/AreasDeInteresses';

const prisma = new PrismaClient();

async function main() {
  await seedCandidateInterestAreas(prisma);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.info('Seed concluído com sucesso.');
  })
  .catch(async (error) => {
    console.error('Erro ao executar seed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
