import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { aulasService } from '../services/aulas.service';
import {
  createAulaSchema,
  updateAulaSchema,
  listAulasQuerySchema,
  updateProgressoSchema,
  registrarPresencaSchema,
} from '../validators/aulas.schema';
import { logger } from '@/utils/logger';

export class AulasController {
  /**
   * GET /api/v1/cursos/aulas
   * Listar aulas com filtros
   */
  static list = async (req: Request, res: Response) => {
    try {
      const query = listAulasQuerySchema.parse(req.query);
      const usuarioLogado = req.user!;

      const result = await aulasService.list(query, usuarioLogado);

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          issues: error.flatten().fieldErrors,
        });
      }

      // ✅ Tratar erros de conexão do Prisma (P1001/P2024) como 503 Service Unavailable
      const errorCode = (error as any)?.code;
      const errorMessage = String((error as any)?.message || '').toLowerCase();
      const isPrismaConnectionError =
        (error instanceof PrismaClientKnownRequestError &&
          (error.code === 'P1001' || error.code === 'P2024')) ||
        errorCode === 'P1001' ||
        errorCode === 'P2024' ||
        errorMessage.includes("can't reach database") ||
        errorMessage.includes('database server') ||
        errorMessage.includes('connection') ||
        errorMessage.includes("can't reach");

      if (isPrismaConnectionError) {
        return res.status(503).json({
          success: false,
          code: 'DATABASE_CONNECTION_ERROR',
          message: 'Serviço temporariamente indisponível. Por favor, tente novamente mais tarde.',
        });
      }

      logger.error('[AULAS_LIST_ERROR]', { error: error?.message });
      res.status(500).json({
        success: false,
        code: 'AULAS_LIST_ERROR',
        message: error?.message || 'Erro ao listar aulas',
      });
    }
  };

  /**
   * GET /api/v1/cursos/aulas/:id
   * Buscar aula por ID
   */
  static get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const usuarioLogado = req.user!;

      const aula = await aulasService.getById(id, usuarioLogado);

      res.json({
        success: true,
        aula,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        code: 'AULA_NOT_FOUND',
        message: error?.message || 'Aula não encontrada',
      });
    }
  };

  /**
   * POST /api/v1/cursos/aulas
   * Criar nova aula
   */
  static create = async (req: Request, res: Response) => {
    try {
      const payload = createAulaSchema.parse(req.body);
      const usuarioLogado = req.user!;

      const aula = await aulasService.create(payload, usuarioLogado);

      res.status(201).json({
        success: true,
        aula,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          issues: error.flatten().fieldErrors,
        });
      }

      logger.error('[AULAS_CREATE_ERROR]', { error: error?.message });
      res.status(500).json({
        success: false,
        code: 'AULAS_CREATE_ERROR',
        message: error?.message || 'Erro ao criar aula',
      });
    }
  };

  /**
   * PUT /api/v1/cursos/aulas/:id
   * Atualizar aula
   */
  static update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const payload = updateAulaSchema.parse(req.body);
      const usuarioLogado = req.user!;

      const aula = await aulasService.update(id, payload, usuarioLogado);

      res.json({
        success: true,
        aula,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          issues: error.flatten().fieldErrors,
        });
      }

      // Tratar erros específicos de publicação
      if (error?.code === 'FORBIDDEN') {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: error?.message || 'Sem permissão para editar esta aula',
        });
      }

      if (error?.code === 'CAMPOS_OBRIGATORIOS_FALTANDO') {
        return res.status(400).json({
          success: false,
          code: 'CAMPOS_OBRIGATORIOS_FALTANDO',
          message: error?.message || 'Campos obrigatórios faltando',
          camposFaltando: error?.camposFaltando || [],
          modalidade: error?.modalidade,
        });
      }

      if (error?.code === 'DATA_INVALIDA') {
        return res.status(400).json({
          success: false,
          code: 'DATA_INVALIDA',
          message: error?.message || 'Data inválida',
        });
      }

      if (error?.code === 'STATUS_INVALIDO' || error?.code === 'NAO_PODE_DESPUBLICAR') {
        return res.status(400).json({
          success: false,
          code: error?.code || 'STATUS_INVALIDO',
          message: error?.message || 'Não é possível alterar o status desta aula',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AULAS_UPDATE_ERROR',
        message: error?.message || 'Erro ao atualizar aula',
      });
    }
  };

  /**
   * DELETE /api/v1/cursos/aulas/:id
   * Soft delete de aula
   */
  static delete = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const usuarioLogado = req.user!;

      const result = await aulasService.delete(id, usuarioLogado);

      res.json(result);
    } catch (error: any) {
      // Tratar erros específicos
      if (error?.code === 'AULA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'AULA_NOT_FOUND',
          message: error?.message || 'Aula não encontrada',
        });
      }

      if (error?.code === 'FORBIDDEN') {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: error?.message || 'Sem permissão para excluir esta aula',
        });
      }

      if (error?.code === 'AULA_JA_REALIZADA') {
        return res.status(400).json({
          success: false,
          code: 'AULA_JA_REALIZADA',
          message: error?.message || 'Não é possível excluir aulas que já foram realizadas',
        });
      }

      if (error?.code === 'PRAZO_INSUFICIENTE') {
        return res.status(400).json({
          success: false,
          code: 'PRAZO_INSUFICIENTE',
          message: error?.message || 'Prazo insuficiente para exclusão',
          diasRestantes: error?.diasRestantes,
          dataAula: error?.dataAula,
        });
      }

      if (error?.code === 'AULA_EM_ANDAMENTO') {
        return res.status(400).json({
          success: false,
          code: 'AULA_EM_ANDAMENTO',
          message: error?.message || 'Não é possível excluir uma aula em andamento',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AULAS_DELETE_ERROR',
        message: error?.message || 'Erro ao remover aula',
      });
    }
  };

  /**
   * PATCH /api/v1/cursos/aulas/:id/publicar
   * Publicar ou despublicar aula
   */
  static publicar = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { publicar } = req.body; // true = publicar, false = despublicar
      const usuarioLogado = req.user!;

      if (typeof publicar !== 'boolean') {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Campo "publicar" deve ser um booleano',
        });
      }

      // Buscar aula atual
      const aulaAtual = await aulasService.getById(id, usuarioLogado);
      const statusAtual = aulaAtual.status;
      const statusNovo = publicar ? 'PUBLICADA' : 'RASCUNHO';

      // Se já está no status desejado, retornar sucesso
      if (statusAtual === statusNovo) {
        return res.json({
          success: true,
          message: `Aula já está ${publicar ? 'publicada' : 'em rascunho'}`,
          aula: aulaAtual,
        });
      }

      // Atualizar status
      const aulaAtualizada = await aulasService.update(
        id,
        { status: statusNovo },
        usuarioLogado,
      );

      // Buscar aula atualizada completa
      const aulaCompleta = await aulasService.getById(id, usuarioLogado);

      res.json({
        success: true,
        message: `Aula ${publicar ? 'publicada' : 'despublicada'} com sucesso`,
        aula: aulaCompleta,
        acoesRealizadas: {
          eventoCalendarCriado: !!aulaCompleta.meetEventId,
          meetEventId: aulaCompleta.meetEventId || null,
          notificacoesEnviadas: aulaAtual.turmaId ? 'sim' : 'não',
        },
      });
    } catch (error: any) {
      // Tratar erros específicos
      if (error?.code === 'FORBIDDEN') {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: error?.message || 'Você não tem permissão para publicar/despublicar esta aula',
        });
      }

      if (error?.code === 'CAMPOS_OBRIGATORIOS_FALTANDO') {
        return res.status(400).json({
          success: false,
          code: 'CAMPOS_OBRIGATORIOS_FALTANDO',
          message: error?.message || 'Campos obrigatórios faltando',
          camposFaltando: error?.camposFaltando || [],
          modalidade: error?.modalidade,
        });
      }

      if (error?.code === 'DATA_INVALIDA') {
        return res.status(400).json({
          success: false,
          code: 'DATA_INVALIDA',
          message: error?.message || 'Data inválida',
          dataInicio: error?.dataInicio,
          hoje: new Date().toISOString(),
        });
      }

      if (error?.code === 'STATUS_INVALIDO' || error?.code === 'NAO_PODE_DESPUBLICAR') {
        return res.status(400).json({
          success: false,
          code: error?.code || 'STATUS_INVALIDO',
          message: error?.message || 'Não é possível alterar o status desta aula',
          statusAtual: error?.statusAtual,
        });
      }

      if (error?.code === 'AULA_JA_REALIZADA') {
        return res.status(400).json({
          success: false,
          code: 'AULA_JA_REALIZADA',
          message: error?.message || 'Não é possível despublicar uma aula que já foi realizada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AULAS_PUBLICAR_ERROR',
        message: error?.message || 'Erro ao publicar/despublicar aula',
      });
    }
  };

  /**
   * POST /api/v1/cursos/aulas/:id/progresso
   * Atualizar progresso do aluno
   */
  static updateProgresso = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const payload = updateProgressoSchema.parse(req.body);
      const alunoId = req.user!.id;

      const progresso = await aulasService.updateProgresso(id, payload, alunoId);

      res.json({
        success: true,
        progresso: {
          percentualAssistido: Number(progresso.percentualAssistido),
          concluida: progresso.concluida,
        },
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          issues: error.flatten().fieldErrors,
        });
      }

      res.status(500).json({
        success: false,
        code: 'PROGRESSO_ERROR',
        message: error?.message || 'Erro ao atualizar progresso',
      });
    }
  };

  /**
   * POST /api/v1/cursos/aulas/:id/presenca
   * Registrar entrada/saída em aula ao vivo
   */
  static registrarPresenca = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const payload = registrarPresencaSchema.parse(req.body);
      const usuarioId = req.user!.id;

      const result = await aulasService.registrarPresenca(
        id,
        payload.tipo,
        payload.inscricaoId,
        usuarioId,
      );

      res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          issues: error.flatten().fieldErrors,
        });
      }

      res.status(500).json({
        success: false,
        code: 'PRESENCA_ERROR',
        message: error?.message || 'Erro ao registrar presença',
      });
    }
  };

  /**
   * GET /api/v1/cursos/aulas/:id/historico
   * Buscar histórico de alterações
   */
  static getHistorico = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const usuarioLogado = req.user!;

      const historico = await aulasService.getHistorico(id, usuarioLogado);

      res.json({
        success: true,
        historico,
      });
    } catch (error: any) {
      // Verificar se é erro de permissão
      if (error?.message?.includes('permissão') || error?.message?.includes('Sem permissão')) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: error?.message || 'Você não tem permissão para acessar o histórico desta aula',
        });
      }

      // Verificar se é erro de aula não encontrada
      if (error?.message?.includes('não encontrada') || error?.message?.includes('não encontrado')) {
        return res.status(404).json({
          success: false,
          code: 'AULA_NOT_FOUND',
          message: error?.message || 'Aula não encontrada',
        });
      }

      // Erro genérico
      logger.error('[AULAS_HISTORICO_ERROR]', { error: error?.message, aulaId: req.params.id });
      res.status(500).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: error?.message || 'Erro ao buscar histórico da aula',
      });
    }
  };

  /**
   * GET /api/v1/cursos/aulas/:id/progresso
   * Buscar progresso da aula
   */
  static getProgresso = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { alunoId } = req.query;
      const usuarioLogado = req.user!;

      const progressos = await aulasService.getProgresso(id, usuarioLogado, alunoId as string);

      res.json({
        success: true,
        progressos,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'PROGRESSO_ERROR',
        message: error?.message || 'Erro ao buscar progresso',
      });
    }
  };

  /**
   * GET /api/v1/cursos/aulas/:id/presenca
   * Listar presenças da aula
   */
  static getPresencas = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const usuarioLogado = req.user!;

      const presencas = await aulasService.getPresencas(id, usuarioLogado);

      res.json({
        success: true,
        presencas,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'PRESENCA_ERROR',
        message: error?.message || 'Erro ao buscar presenças',
      });
    }
  };
}
