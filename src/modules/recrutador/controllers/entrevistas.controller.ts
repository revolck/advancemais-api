import type { Request, Response } from 'express';
import { prisma } from '@/config/prisma';
import { StatusDeVagas } from '@prisma/client';
import { googleCalendarService } from '@/modules/cursos/aulas/services/google-calendar.service';
import { recrutadorEmpresasService } from '@/modules/usuarios/services/recrutador-empresas.service';
import { recrutadorVagasService } from '@/modules/usuarios/services/recrutador-vagas.service';
import { z } from 'zod';

const createEntrevistaSchema = z.object({
  dataInicio: z.string().datetime(),
  dataFim: z.string().datetime(),
  descricao: z.string().trim().max(5000).optional(),
});

export class RecrutadorEntrevistasController {
  static create = async (req: Request, res: Response) => {
    try {
      const recruiterId = (req as any).user?.id as string | undefined;
      if (!recruiterId) {
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      }

      const { vagaId, candidatoId } = req.params as { vagaId: string; candidatoId: string };
      const payload = createEntrevistaSchema.parse(req.body);
      const dataInicio = new Date(payload.dataInicio);
      const dataFim = new Date(payload.dataFim);

      if (
        Number.isNaN(dataInicio.getTime()) ||
        Number.isNaN(dataFim.getTime()) ||
        dataFim <= dataInicio
      ) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'dataInicio/dataFim inválidos',
        });
      }

      const vaga = await prisma.empresasVagas.findUnique({
        where: { id: vagaId },
        select: { id: true, titulo: true, status: true, usuarioId: true },
      });

      if (!vaga || vaga.status === StatusDeVagas.RASCUNHO) {
        return res.status(404).json({
          success: false,
          code: 'VAGA_NOT_FOUND',
          message: 'Vaga não encontrada',
        });
      }

      await recrutadorVagasService.assertVinculo(recruiterId, vagaId);
      await recrutadorEmpresasService.assertVinculo(recruiterId, vaga.usuarioId);

      const candidatura = await prisma.empresasCandidatos.findFirst({
        where: {
          vagaId,
          candidatoId,
          empresaUsuarioId: vaga.usuarioId,
        },
        select: { id: true },
      });

      if (!candidatura) {
        return res.status(404).json({
          success: false,
          code: 'CANDIDATO_NOT_FOUND',
          message: 'Candidato não está relacionado a esta vaga',
        });
      }

      const [recrutador, candidato] = await prisma.$transaction([
        prisma.usuarios.findUnique({
          where: { id: recruiterId },
          select: { id: true, email: true, nomeCompleto: true },
        }),
        prisma.usuarios.findUnique({
          where: { id: candidatoId },
          select: { id: true, email: true, nomeCompleto: true },
        }),
      ]);

      if (!recrutador || !candidato || !candidato.email) {
        return res.status(404).json({
          success: false,
          code: 'USUARIO_NOT_FOUND',
          message: 'Recrutador ou candidato não encontrado',
        });
      }

      const titulo = `Entrevista ${candidato.nomeCompleto} - ${vaga.titulo}`;
      const descricao =
        payload.descricao ??
        `Entrevista agendada para a vaga "${vaga.titulo}".\n\nRecrutador: ${recrutador.nomeCompleto}\nCandidato: ${candidato.nomeCompleto}`;

      const { eventId, meetUrl } = await googleCalendarService.createMeetEvent({
        titulo,
        descricao,
        dataInicio,
        dataFim,
        instrutorId: recruiterId,
        alunoEmails: [candidato.email],
      });

      const entrevista = await prisma.empresasVagasEntrevistas.create({
        data: {
          vagaId,
          candidatoId,
          empresaUsuarioId: vaga.usuarioId,
          recrutadorId: recruiterId,
          titulo,
          descricao,
          dataInicio,
          dataFim,
          meetUrl,
          meetEventId: eventId,
        },
        select: {
          id: true,
          vagaId: true,
          candidatoId: true,
          empresaUsuarioId: true,
          recrutadorId: true,
          titulo: true,
          descricao: true,
          dataInicio: true,
          dataFim: true,
          meetUrl: true,
          meetEventId: true,
          status: true,
          criadoEm: true,
        },
      });

      return res.status(201).json({ success: true, entrevista });
    } catch (error: any) {
      if (error?.status === 403) {
        return res.status(403).json({
          success: false,
          code: error?.code ?? 'FORBIDDEN',
          message: error?.message ?? 'Acesso negado',
        });
      }

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para agendar entrevista',
          issues: error.flatten().fieldErrors,
        });
      }

      return res.status(500).json({
        success: false,
        code: 'RECRUTADOR_ENTREVISTA_CREATE_ERROR',
        message: 'Erro ao agendar entrevista',
        error: error?.message,
      });
    }
  };

  static get = async (req: Request, res: Response) => {
    try {
      const recruiterId = (req as any).user?.id as string | undefined;
      if (!recruiterId) {
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      }

      const { id } = req.params;

      const entrevista = await prisma.empresasVagasEntrevistas.findFirst({
        where: { id, recrutadorId: recruiterId },
        select: {
          id: true,
          vagaId: true,
          candidatoId: true,
          empresaUsuarioId: true,
          recrutadorId: true,
          titulo: true,
          descricao: true,
          dataInicio: true,
          dataFim: true,
          meetUrl: true,
          meetEventId: true,
          status: true,
          criadoEm: true,
          atualizadoEm: true,
        },
      });

      if (!entrevista) {
        return res.status(404).json({
          success: false,
          code: 'ENTREVISTA_NOT_FOUND',
          message: 'Entrevista não encontrada',
        });
      }

      return res.json({ success: true, entrevista });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        code: 'RECRUTADOR_ENTREVISTA_GET_ERROR',
        message: 'Erro ao buscar entrevista',
        error: error?.message,
      });
    }
  };
}
