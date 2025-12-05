import { Request, Response } from 'express';
import { requerimentosService } from '../services/requerimentos.service';
import {
  criarRequerimentoSchema,
  atualizarRequerimentoAdminSchema,
  adicionarComentarioSchema,
  listarRequerimentosSchema,
  solicitarReembolsoSchema,
} from '../validators/requerimentos.schema';
import { Roles } from '@prisma/client';

// Roles de admin
const ADMIN_ROLES: Roles[] = [Roles.ADMIN, Roles.MODERADOR];

export class RequerimentosController {
  /**
   * POST /requerimentos - Criar novo requerimento (usuário)
   */
  static async criar(req: Request, res: Response) {
    const usuarioId = req.user?.id;
    if (!usuarioId) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }

    const parsed = criarRequerimentoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const requerimento = await requerimentosService.criar(usuarioId, parsed.data);
      return res.status(201).json({ success: true, data: requerimento });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao criar requerimento',
      });
    }
  }

  /**
   * POST /requerimentos/reembolso - Solicitar reembolso (direito de arrependimento)
   */
  static async solicitarReembolso(req: Request, res: Response) {
    const usuarioId = req.user?.id;
    if (!usuarioId) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }

    const parsed = solicitarReembolsoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const requerimento = await requerimentosService.solicitarReembolso(usuarioId, parsed.data);
      return res.status(201).json({ success: true, data: requerimento });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao solicitar reembolso',
      });
    }
  }

  /**
   * GET /requerimentos/elegibilidade-reembolso/:planoId - Verificar elegibilidade para reembolso
   */
  static async verificarElegibilidadeReembolso(req: Request, res: Response) {
    const usuarioId = req.user?.id;
    if (!usuarioId) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }

    const { planoId } = req.params;
    if (!planoId) {
      return res.status(400).json({ success: false, message: 'ID do plano é obrigatório' });
    }

    try {
      const resultado = await requerimentosService.verificarElegibilidadeReembolso(usuarioId, planoId);
      return res.json({ success: true, data: resultado });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao verificar elegibilidade',
      });
    }
  }

  /**
   * GET /requerimentos - Listar requerimentos do usuário
   */
  static async listar(req: Request, res: Response) {
    const usuarioId = req.user?.id;
    if (!usuarioId) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }

    const parsed = listarRequerimentosSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const resultado = await requerimentosService.listarPorUsuario(usuarioId, parsed.data);
      return res.json({ success: true, ...resultado });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao listar requerimentos',
      });
    }
  }

  /**
   * GET /requerimentos/admin - Listar todos os requerimentos (admin)
   */
  static async listarAdmin(req: Request, res: Response) {
    const userRole = req.user?.role;
    if (!userRole || !ADMIN_ROLES.includes(userRole as Roles)) {
      return res.status(403).json({ success: false, message: 'Acesso negado' });
    }

    const parsed = listarRequerimentosSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const resultado = await requerimentosService.listarAdmin(parsed.data);
      return res.json({ success: true, ...resultado });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao listar requerimentos',
      });
    }
  }

  /**
   * GET /requerimentos/metricas - Métricas de requerimentos (admin)
   */
  static async metricas(req: Request, res: Response) {
    const userRole = req.user?.role;
    if (!userRole || !ADMIN_ROLES.includes(userRole as Roles)) {
      return res.status(403).json({ success: false, message: 'Acesso negado' });
    }

    try {
      const metricas = await requerimentosService.metricas();
      return res.json({ success: true, data: metricas });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao obter métricas',
      });
    }
  }

  /**
   * GET /requerimentos/:id - Obter requerimento por ID
   */
  static async obterPorId(req: Request, res: Response) {
    const usuarioId = req.user?.id;
    const userRole = req.user?.role;
    if (!usuarioId) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }

    const { id } = req.params;
    const isAdmin = userRole && ADMIN_ROLES.includes(userRole as Roles);

    try {
      // Se não for admin, verificar se o requerimento pertence ao usuário
      const requerimento = await requerimentosService.obterPorId(id, isAdmin ? undefined : usuarioId);
      return res.json({ success: true, data: requerimento });
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: error instanceof Error ? error.message : 'Requerimento não encontrado',
      });
    }
  }

  /**
   * PUT /requerimentos/:id/admin - Atualizar requerimento (admin)
   */
  static async atualizarAdmin(req: Request, res: Response) {
    const adminId = req.user?.id;
    const userRole = req.user?.role;
    if (!adminId || !userRole || !ADMIN_ROLES.includes(userRole as Roles)) {
      return res.status(403).json({ success: false, message: 'Acesso negado' });
    }

    const { id } = req.params;
    const parsed = atualizarRequerimentoAdminSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const requerimento = await requerimentosService.atualizarAdmin(id, adminId, parsed.data);
      return res.json({ success: true, data: requerimento });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao atualizar requerimento',
      });
    }
  }

  /**
   * POST /requerimentos/:id/comentario - Adicionar comentário
   */
  static async adicionarComentario(req: Request, res: Response) {
    const usuarioId = req.user?.id;
    const userRole = req.user?.role;
    if (!usuarioId) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }

    const { id } = req.params;
    const parsed = adicionarComentarioSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      // Verificar se o usuário pode comentar (dono ou admin)
      const isAdmin = userRole && ADMIN_ROLES.includes(userRole as Roles);
      if (!isAdmin) {
        // Verificar se é o dono do requerimento
        const requerimento = await requerimentosService.obterPorId(id, usuarioId);
        if (!requerimento) {
          return res.status(403).json({ success: false, message: 'Acesso negado' });
        }
      }

      const historico = await requerimentosService.adicionarComentario(id, usuarioId, parsed.data);
      return res.status(201).json({ success: true, data: historico });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao adicionar comentário',
      });
    }
  }

  /**
   * PUT /requerimentos/:id/cancelar - Cancelar requerimento (usuário)
   */
  static async cancelar(req: Request, res: Response) {
    const usuarioId = req.user?.id;
    if (!usuarioId) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }

    const { id } = req.params;

    try {
      const requerimento = await requerimentosService.cancelar(id, usuarioId);
      return res.json({ success: true, data: requerimento });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao cancelar requerimento',
      });
    }
  }
}

