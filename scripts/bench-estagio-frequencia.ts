import { prisma } from '@/config/prisma';
import { estagiosProgramasService } from '@/modules/cursos/services/estagios-programas.service';

async function main() {
  const estagio = await prisma.cursosEstagiosProgramas.findFirst({
    where: {
      titulo: { contains: 'Demo Front', mode: 'insensitive' },
      CursosEstagiosProgramasAlunos: { some: {} },
    },
    orderBy: { atualizadoEm: 'desc' },
  });

  if (!estagio) {
    console.log('Nenhum estágio demo encontrado');
    return;
  }

  const participante = await prisma.cursosEstagiosProgramasAlunos.findFirst({
    where: { estagioId: estagio.id },
  });

  if (!participante) {
    console.log('Nenhum participante encontrado no estágio', estagio.id);
    return;
  }

  const date = new Date('2026-04-01T00:00:00.000Z');

  const listSamples: number[] = [];
  for (let i = 0; i < 5; i += 1) {
    const t0 = Date.now();
    const result = await estagiosProgramasService.listFrequencias(estagio.id, {
      data: date,
      page: 1,
      pageSize: 10,
    } as any);
    listSamples.push(Date.now() - t0);

    if (i === 0) {
      console.log('list sample payload:', {
        items: result.data.items.length,
        total: result.data.pagination.total,
      });
    }
  }

  const upsertSamples: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const status = i % 2 === 0 ? 'PRESENTE' : 'AUSENTE';
    const t0 = Date.now();
    await estagiosProgramasService.upsertFrequencia(
      estagio.id,
      {
        estagioAlunoId: participante.id,
        dataReferencia: date,
        status: status as any,
        motivo: status === 'AUSENTE' ? 'Benchmark de performance' : null,
      } as any,
      undefined,
    );
    upsertSamples.push(Date.now() - t0);
  }

  console.log('Benchmark estágio', estagio.id);
  console.log('listFrequencias(ms):', listSamples);
  console.log('upsertFrequencia(ms):', upsertSamples);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
