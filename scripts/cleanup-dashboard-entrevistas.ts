import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

import { googleCalendarService } from '@/modules/cursos/aulas/services/google-calendar.service';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

const prisma = new PrismaClient();

const MARKER = 'FRONT_ENTREVISTAS_20260330';
const SEEDED_VAGA_CODES = ['F92001', 'F92002'] as const;

async function main() {
  console.log(`🧹 Limpando dados do dashboard de entrevistas (${MARKER})...\n`);
  const googleMeetSystemUserId =
    process.env.GOOGLE_MEET_SYSTEM_USER_ID?.trim() ||
    process.env.GOOGLE_CALENDAR_SYSTEM_USER_ID?.trim() ||
    null;

  const users = await prisma.usuarios.findMany({
    where: {
      email: {
        startsWith: 'front.entrevistas.',
      },
    },
    select: { id: true, email: true },
  });

  const userIds = users.map((user) => user.id);

  const vagas = await prisma.empresasVagas.findMany({
    where: {
      codigo: { in: [...SEEDED_VAGA_CODES] },
    },
    select: { id: true, codigo: true },
  });

  const vagaIds = vagas.map((vaga) => vaga.id);

  const candidaturas = await prisma.empresasCandidatos.findMany({
    where: {
      OR: [
        { vagaId: { in: vagaIds } },
        { candidatoId: { in: userIds } },
        { empresaUsuarioId: { in: userIds } },
      ],
    },
    select: { id: true },
  });

  const candidaturaIds = candidaturas.map((item) => item.id);

  const entrevistas = await prisma.empresasVagasEntrevistas.findMany({
    where: {
      OR: [
        { empresaUsuarioId: { in: userIds } },
        { recrutadorId: { in: userIds } },
        { candidatoId: { in: userIds } },
        {
          titulo: {
            startsWith: MARKER,
          },
        },
      ],
    },
    select: {
      id: true,
      meetEventId: true,
    },
  });

  let deletedCalendarEvents = 0;

  if (googleMeetSystemUserId) {
    for (const entrevista of entrevistas) {
      if (!entrevista.meetEventId) {
        continue;
      }

      try {
        await googleCalendarService.deleteEvent(entrevista.meetEventId, googleMeetSystemUserId);
        deletedCalendarEvents++;
      } catch (error: any) {
        console.warn(
          `  ⚠️ Não foi possível remover o evento do Google Calendar ${entrevista.meetEventId}: ${error?.message ?? error}`,
        );
      }
    }
  }

  await prisma.notificacoes.deleteMany({
    where: {
      OR: [
        { usuarioId: { in: userIds } },
        { vagaId: { in: vagaIds } },
        { candidaturaId: { in: candidaturaIds } },
      ],
    },
  });

  await prisma.notificacoesEnviadas.deleteMany({
    where: {
      usuarioId: { in: userIds },
    },
  });

  const entrevistasResult = await prisma.empresasVagasEntrevistas.deleteMany({
    where: {
      OR: [
        { empresaUsuarioId: { in: userIds } },
        { recrutadorId: { in: userIds } },
        { candidatoId: { in: userIds } },
        {
          titulo: {
            startsWith: MARKER,
          },
        },
      ],
    },
  });

  const candidaturasResult = await prisma.empresasCandidatos.deleteMany({
    where: {
      id: { in: candidaturaIds },
    },
  });

  const vagaVinculosResult = await prisma.usuariosVagasVinculos.deleteMany({
    where: {
      OR: [{ vagaId: { in: vagaIds } }, { recrutadorId: { in: userIds } }],
    },
  });

  const empresaVinculosResult = await prisma.usuariosEmpresasVinculos.deleteMany({
    where: {
      OR: [{ recrutadorId: { in: userIds } }, { empresaUsuarioId: { in: userIds } }],
    },
  });

  const vagasResult = await prisma.empresasVagas.deleteMany({
    where: {
      id: { in: vagaIds },
    },
  });

  await prisma.usuariosSessoes.deleteMany({
    where: {
      usuarioId: { in: userIds },
    },
  });

  await prisma.usuariosEnderecos.deleteMany({
    where: {
      usuarioId: { in: userIds },
    },
  });

  await prisma.usuariosVerificacaoEmail.deleteMany({
    where: {
      usuarioId: { in: userIds },
    },
  });

  await prisma.usuariosInformation.deleteMany({
    where: {
      usuarioId: { in: userIds },
    },
  });

  const usersResult = await prisma.usuarios.deleteMany({
    where: {
      id: { in: userIds },
    },
  });

  console.log('✅ Limpeza concluída.\n');
  console.log(`  entrevistas removidas: ${entrevistasResult.count}`);
  console.log(`  eventos do Google Calendar removidos: ${deletedCalendarEvents}`);
  console.log(`  candidaturas removidas: ${candidaturasResult.count}`);
  console.log(`  vínculos recrutador/empresa removidos: ${empresaVinculosResult.count}`);
  console.log(`  vínculos recrutador/vaga removidos: ${vagaVinculosResult.count}`);
  console.log(`  vagas removidas: ${vagasResult.count}`);
  console.log(`  usuários removidos: ${usersResult.count}`);
}

main()
  .catch((error) => {
    console.error('❌ Erro ao limpar dados do dashboard de entrevistas:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
