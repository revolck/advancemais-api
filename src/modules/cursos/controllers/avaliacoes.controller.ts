import { Request, Response } from 'express';
import { ZodError } from 'zod';

import { prisma } from '@/config/prisma';

import { avaliacoesService } from '../services/avaliacoes.service';
import { avaliacoesRespostasService } from '../services/avaliacoes-respostas.service';
import {
  clonarAvaliacaoSchema,
  createAvaliacaoSchema,
  listAvaliacoesQuerySchema,
  publicarAvaliacaoSchema,
  putUpdateAvaliacaoSchema,
} from '../validators/avaliacoes.schema';
import {
  corrigirAvaliacaoRespostaSchema,
  listAvaliacaoHistoricoQuerySchema,
  listAvaliacaoRespostasQuerySchema,
} from '../validators/avaliacoes-respostas.schema';

const parseUuid = (raw: unknown) => {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  return raw.trim();
};

// Validação de UUID v4
const isValidUuid = (value: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

export class AvaliacoesController {
  static list = async (req: Request, res: Response) => {
    try {
      const query = listAvaliacoesQuerySchema.parse(req.query);
      const usuarioLogado = req.user!;
      const result = await avaliacoesService.list(query, usuarioLogado);
      res.json({ success: true, ...result });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para listagem de avaliações',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'FORBIDDEN') {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: error?.message || 'Sem permissão para listar avaliações desta turma',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AVALIACOES_LIST_ERROR',
        message: 'Erro ao listar avaliações',
        error: error?.message,
      });
    }
  };

  static get = async (req: Request, res: Response) => {
    const id = parseUuid(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de avaliação inválido',
      });
    }

    try {
      const usuarioLogado = req.user!;
      const avaliacao = await avaliacoesService.get(id, usuarioLogado);
      res.json({ success: true, data: avaliacao, avaliacao });
    } catch (error: any) {
      if (error?.code === 'AVALIACAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'AVALIACAO_NOT_FOUND',
          message: 'Avaliação não encontrada',
        });
      }

      if (error?.code === 'FORBIDDEN') {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: error?.message || 'Sem permissão para acessar esta avaliação',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AVALIACAO_GET_ERROR',
        message: 'Erro ao buscar avaliação',
        error: error?.message,
      });
    }
  };

  static listQuestoes = async (req: Request, res: Response) => {
    const id = parseUuid(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de avaliação inválido',
      });
    }

    try {
      const usuarioLogado = req.user!;
      const result = await avaliacoesService.getQuestoes(id, usuarioLogado);
      res.json({ success: true, data: result.questoes });
    } catch (error: any) {
      if (error?.code === 'AVALIACAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'AVALIACAO_NOT_FOUND',
          message: 'Avaliação não encontrada',
        });
      }

      if (error?.code === 'FORBIDDEN') {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: error?.message || 'Sem permissão para acessar esta avaliação',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AVALIACAO_QUESTOES_LIST_ERROR',
        message: 'Erro ao listar questões da avaliação',
        error: error?.message,
      });
    }
  };

  static listRespostas = async (req: Request, res: Response) => {
    const avaliacaoId = parseUuid(req.params.avaliacaoId);

    if (!avaliacaoId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de avaliação inválido',
      });
    }

    try {
      const query = listAvaliacaoRespostasQuerySchema.parse(req.query);
      const usuarioLogado = req.user!;
      const result = await avaliacoesRespostasService.list(avaliacaoId, query, usuarioLogado);
      res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para listagem de respostas',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'AVALIACAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'AVALIACAO_NOT_FOUND',
          message: 'Avaliação não encontrada',
        });
      }

      if (error?.code === 'FORBIDDEN') {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: error?.message || 'Sem permissão para acessar esta avaliação',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AVALIACAO_RESPOSTAS_LIST_ERROR',
        message: 'Erro ao listar respostas da avaliação',
        error: error?.message,
      });
    }
  };

  static listHistorico = async (req: Request, res: Response) => {
    try {
      const query = listAvaliacaoHistoricoQuerySchema.parse(req.query);
      const usuarioLogado = req.user!;
      const result = await avaliacoesRespostasService.listHistorico(query, usuarioLogado);
      res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para listagem de histórico da avaliação',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'AVALIACAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'AVALIACAO_NOT_FOUND',
          message: 'Avaliação não encontrada',
        });
      }

      if (error?.code === 'FORBIDDEN') {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: error?.message || 'Sem permissão para acessar esta avaliação',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AVALIACAO_HISTORICO_LIST_ERROR',
        message: 'Erro ao listar histórico da avaliação',
        error: error?.message,
      });
    }
  };

  static getResposta = async (req: Request, res: Response) => {
    const avaliacaoId = parseUuid(req.params.avaliacaoId);
    const respostaId = parseUuid(req.params.respostaId);

    if (!avaliacaoId || !respostaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de avaliação ou resposta inválidos',
      });
    }

    try {
      const usuarioLogado = req.user!;
      const result = await avaliacoesRespostasService.get(avaliacaoId, respostaId, usuarioLogado);
      res.json(result);
    } catch (error: any) {
      if (error?.code === 'AVALIACAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'AVALIACAO_NOT_FOUND',
          message: 'Avaliação não encontrada',
        });
      }

      if (error?.code === 'RESPOSTA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'RESPOSTA_NOT_FOUND',
          message: 'Resposta não encontrada para a avaliação informada',
        });
      }

      if (error?.code === 'FORBIDDEN') {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: error?.message || 'Sem permissão para acessar esta avaliação',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AVALIACAO_RESPOSTA_GET_ERROR',
        message: 'Erro ao buscar detalhe da resposta',
        error: error?.message,
      });
    }
  };

  static corrigirResposta = async (req: Request, res: Response) => {
    const avaliacaoId = parseUuid(req.params.avaliacaoId);
    const respostaId = parseUuid(req.params.respostaId);

    if (!avaliacaoId || !respostaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de avaliação ou resposta inválidos',
      });
    }

    try {
      const payload = corrigirAvaliacaoRespostaSchema.parse(req.body);
      const usuarioLogado = req.user!;
      const ip = req.ip || req.socket.remoteAddress || undefined;
      const userAgent = req.get('user-agent') || undefined;

      const result = await avaliacoesRespostasService.corrigir(
        avaliacaoId,
        respostaId,
        payload,
        usuarioLogado,
        { ip, userAgent },
      );
      res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para correção da resposta',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'AVALIACAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'AVALIACAO_NOT_FOUND',
          message: 'Avaliação não encontrada',
        });
      }

      if (error?.code === 'RESPOSTA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'RESPOSTA_NOT_FOUND',
          message: 'Resposta não encontrada para a avaliação informada',
        });
      }

      if (error?.code === 'VALIDATION_ERROR') {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: error?.message || 'Erro de validação da correção',
        });
      }

      if (error?.code === 'PROVA_AUTO_CORRECAO') {
        return res.status(400).json({
          success: false,
          code: 'PROVA_AUTO_CORRECAO',
          message: error?.message,
        });
      }

      if (error?.code === 'FORBIDDEN') {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: error?.message || 'Sem permissão para corrigir esta resposta',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AVALIACAO_RESPOSTA_CORRECAO_ERROR',
        message: 'Erro ao corrigir resposta da avaliação',
        error: error?.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const payload = createAvaliacaoSchema.parse(req.body);
      const userId = req.user?.id as string;
      const userRole = req.user?.role as string;

      // Se for INSTRUTOR, forçar instrutorId = userId
      if (userRole === 'INSTRUTOR') {
        payload.instrutorId = userId;

        // Validar que a turma (se fornecida) pertence ao instrutor
        if (payload.turmaId) {
          const turma = await prisma.cursosTurmas.findFirst({
            where: { id: payload.turmaId, instrutorId: userId },
          });

          if (!turma) {
            return res.status(403).json({
              success: false,
              code: 'INSTRUTOR_TURMA_NAO_VINCULADA',
              message: 'Você não está vinculado a esta turma',
            });
          }
        }
      }

      const avaliacao = await avaliacoesService.create(payload);
      res.status(201).json({ success: true, avaliacao });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para criação da avaliação',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'CURSO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'CURSO_NOT_FOUND',
          message: 'Curso não encontrado',
        });
      }
      if (error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'TURMA_NOT_FOUND',
          message: 'Turma não encontrada',
        });
      }
      if (error?.code === 'TURMA_NOT_BELONGS_TO_CURSO') {
        return res.status(400).json({
          success: false,
          code: 'TURMA_NOT_BELONGS_TO_CURSO',
          message: 'A turma selecionada não pertence ao curso informado',
        });
      }
      if (error?.code === 'INSTRUTOR_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'INSTRUTOR_NOT_FOUND',
          message: 'Instrutor não encontrado ou não é um instrutor válido',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AVALIACAO_CREATE_ERROR',
        message: 'Erro ao criar avaliação',
        error: error?.message,
      });
    }
  };

  /**
   * Lista turmas disponíveis para seleção no formulário
   * GET /api/v1/cursos/avaliacoes/turmas?cursoId={cursoId}
   * Suporta filtro opcional por cursoId
   */
  static listTurmas = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id as string;
      const userRole = req.user?.role as string;
      const cursoId = req.query.cursoId as string | undefined;

      // Validar cursoId se fornecido
      if (cursoId && !isValidUuid(cursoId)) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Identificador de curso inválido',
        });
      }

      const turmas = await avaliacoesService.listTurmasDisponiveis(userId, userRole, cursoId);

      res.json({
        success: true,
        turmas,
        total: turmas.length,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'TURMAS_LIST_ERROR',
        message: 'Erro ao listar turmas disponíveis',
        error: error?.message,
      });
    }
  };

  /**
   * Lista instrutores disponíveis para seleção no formulário
   * GET /api/v1/cursos/avaliacoes/instrutores
   */
  static listInstrutores = async (req: Request, res: Response) => {
    try {
      const instrutores = await avaliacoesService.listInstrutoresDisponiveis();

      res.json({
        success: true,
        instrutores,
        total: instrutores.length,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'INSTRUTORES_LIST_ERROR',
        message: 'Erro ao listar instrutores disponíveis',
        error: error?.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    const id = parseUuid(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de avaliação inválido',
      });
    }

    try {
      const payload = putUpdateAvaliacaoSchema.parse(req.body);
      const usuarioLogado = req.user!;

      const avaliacao = await avaliacoesService.update(id, payload, usuarioLogado);
      res.json({ success: true, avaliacao });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualização da avaliação',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'AVALIACAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'AVALIACAO_NOT_FOUND',
          message: 'Avaliação não encontrada',
        });
      }

      if (error?.code === 'FORBIDDEN') {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: error?.message || 'Sem permissão para editar esta avaliação',
        });
      }

      if (error?.code === 'AVALIACAO_PUBLICADA_LOCKED') {
        return res.status(409).json({
          success: false,
          code: 'AVALIACAO_PUBLICADA_LOCKED',
          message:
            error?.message || 'Não é possível editar atividade/prova publicada vinculada a turma',
        });
      }

      if (error?.code === 'AVALIACAO_JA_INICIADA_OU_REALIZADA') {
        return res.status(409).json({
          success: false,
          code: 'AVALIACAO_JA_INICIADA_OU_REALIZADA',
          message: error?.message || 'Não é possível editar avaliação que já aconteceu',
        });
      }

      if (error?.code === 'CAMPOS_OBRIGATORIOS_FALTANDO') {
        return res.status(400).json({
          success: false,
          code: 'CAMPOS_OBRIGATORIOS_FALTANDO',
          message: error?.message || 'Campos obrigatórios faltando para publicação',
          camposFaltando: error?.camposFaltando ?? [],
        });
      }

      if (error?.code === 'DATA_INVALIDA') {
        return res.status(400).json({
          success: false,
          code: 'DATA_INVALIDA',
          message: error?.message || 'Data inválida para publicação',
        });
      }

      if (error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'TURMA_NOT_FOUND',
          message: error?.message || 'Turma não encontrada',
        });
      }

      if (error?.code === 'TURMA_CURSO_MISMATCH') {
        return res.status(400).json({
          success: false,
          code: 'TURMA_CURSO_MISMATCH',
          message: error?.message || 'Turma não pertence ao curso informado',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AVALIACAO_UPDATE_ERROR',
        message: 'Erro ao atualizar avaliação',
        error: error?.message,
      });
    }
  };

  static delete = async (req: Request, res: Response) => {
    const id = parseUuid(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de avaliação inválido',
      });
    }

    try {
      const usuarioLogado = req.user!;
      const result = await avaliacoesService.remove(id, usuarioLogado);
      res.json(result);
    } catch (error: any) {
      if (error?.code === 'AVALIACAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'AVALIACAO_NOT_FOUND',
          message: 'Avaliação não encontrada',
        });
      }

      if (error?.code === 'FORBIDDEN') {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: error?.message || 'Sem permissão para remover esta avaliação',
        });
      }

      if (error?.code === 'AVALIACAO_JA_INICIADA_OU_REALIZADA') {
        return res.status(409).json({
          success: false,
          code: 'AVALIACAO_JA_INICIADA_OU_REALIZADA',
          message: error?.message || 'Não é possível excluir avaliação que já aconteceu',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AVALIACAO_DELETE_ERROR',
        message: 'Erro ao remover avaliação',
        error: error?.message,
      });
    }
  };

  static publicar = async (req: Request, res: Response) => {
    const id = parseUuid(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de avaliação inválido',
      });
    }

    try {
      const payload = publicarAvaliacaoSchema.parse(req.body);
      const usuarioLogado = req.user!;
      const avaliacao = await avaliacoesService.publicar(id, payload.publicar, usuarioLogado);
      res.json({ success: true, data: avaliacao, avaliacao });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para publicar/despublicar avaliação',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'AVALIACAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'AVALIACAO_NOT_FOUND',
          message: 'Avaliação não encontrada',
        });
      }

      if (error?.code === 'FORBIDDEN') {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: error?.message || 'Sem permissão para publicar/despublicar esta avaliação',
        });
      }

      if (error?.code === 'CAMPOS_OBRIGATORIOS_FALTANDO') {
        return res.status(400).json({
          success: false,
          code: 'CAMPOS_OBRIGATORIOS_FALTANDO',
          message: error?.message || 'Campos obrigatórios faltando para publicação',
          camposFaltando: error?.camposFaltando ?? [],
        });
      }

      if (error?.code === 'DATA_INVALIDA') {
        return res.status(400).json({
          success: false,
          code: 'DATA_INVALIDA',
          message: error?.message || 'Data inválida para publicação',
        });
      }

      if (error?.code === 'STATUS_INVALIDO') {
        return res.status(400).json({
          success: false,
          code: 'STATUS_INVALIDO',
          message: error?.message || 'Status inválido para publicação/despublicação',
        });
      }

      if (error?.code === 'AVALIACAO_PUBLICACAO_EXIGE_TURMA_VINCULADA') {
        return res.status(409).json({
          success: false,
          code: 'AVALIACAO_PUBLICACAO_EXIGE_TURMA_VINCULADA',
          message: error?.message || 'Vincule uma turma antes de publicar esta avaliação.',
        });
      }

      if (error?.code === 'AVALIACAO_JA_INICIADA_OU_REALIZADA') {
        return res.status(409).json({
          success: false,
          code: 'AVALIACAO_JA_INICIADA_OU_REALIZADA',
          message:
            error?.message ||
            'Não é possível publicar/despublicar avaliação que já foi iniciada ou já possui envios',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AVALIACAO_PUBLICAR_ERROR',
        message: 'Erro ao publicar/despublicar avaliação',
        error: error?.message,
      });
    }
  };

  static clonarParaTurma = async (req: Request, res: Response) => {
    const cursoId = parseUuid(req.params.cursoId);
    const turmaId = parseUuid(req.params.turmaId);

    if (!cursoId || !turmaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso ou turma inválidos',
      });
    }

    try {
      const payload = clonarAvaliacaoSchema.parse(req.body);
      const avaliacao = await avaliacoesService.clonarParaTurma(cursoId, turmaId, payload);
      res.status(201).json({ success: true, avaliacao });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para clonagem',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'TURMA_NOT_FOUND',
          message: 'Turma não encontrada para o curso informado',
        });
      }

      if (error?.code === 'MODULO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'MODULO_NOT_FOUND',
          message: 'Módulo não encontrado para a turma informada',
        });
      }

      if (error?.code === 'AVALIACAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'AVALIACAO_NOT_FOUND',
          message: 'Avaliação template não encontrada',
        });
      }

      if (error?.code === 'AVALIACAO_ETIQUETA_DUPLICADA') {
        return res.status(409).json({
          success: false,
          code: 'AVALIACAO_ETIQUETA_DUPLICADA',
          message: error?.message || 'Já existe uma avaliação com esta etiqueta na turma',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AVALIACAO_CLONE_ERROR',
        message: 'Erro ao clonar avaliação para a turma',
        error: error?.message,
      });
    }
  };
}
