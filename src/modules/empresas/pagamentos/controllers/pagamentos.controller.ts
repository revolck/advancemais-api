import type { Request, Response } from 'express';
import { Roles } from '@prisma/client';

import { asyncHandler } from '@/utils/asyncHandler';
import { pagamentosService } from '../services/pagamentos.service';
import { listarPagamentosSchema } from '../validators/pagamentos.schema';

/**
 * GET /api/v1/empresas/pagamentos
 *
 * Retorna histórico de pagamentos da empresa.
 *
 * Permissões:
 * - EMPRESA: Apenas pagamentos próprios
 * - ADMIN/MODERADOR: Pode passar empresaId como query param
 */
export const listarPagamentos = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Não autenticado',
    });
  }

  const { role, id: usuarioId } = req.user;

  // Validar query params
  const validacao = listarPagamentosSchema.safeParse(req.query);

  if (!validacao.success) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetros inválidos',
      errors: validacao.error.errors,
    });
  }

  const { empresaId: queryEmpresaId, ...params } = req.query as any;

  // Determinar ID da empresa baseado na role
  let targetEmpresaId = usuarioId;

  const isAdmin = role === Roles.ADMIN || role === Roles.MODERADOR;
  const isEmpresa = role === Roles.EMPRESA;

  // Se é admin e passou empresaId, usar o empresaId fornecido
  if (isAdmin && queryEmpresaId && typeof queryEmpresaId === 'string') {
    targetEmpresaId = queryEmpresaId;
  } else if (!isEmpresa && !isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Sem permissão para acessar histórico de pagamentos',
    });
  }

  const data = await pagamentosService.listar(targetEmpresaId, validacao.data);

  return res.json({
    success: true,
    data,
  });
});

/**
 * GET /api/v1/empresas/pagamentos/planos
 *
 * Retorna lista de planos da empresa (histórico de planos contratados).
 *
 * Permissões:
 * - EMPRESA: Apenas planos próprios
 * - ADMIN/MODERADOR: Pode passar empresaId como query param
 */
export const listarPlanos = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Não autenticado',
    });
  }

  const { role, id: usuarioId } = req.user;

  const { empresaId: queryEmpresaId } = req.query as any;

  // Determinar ID da empresa baseado na role
  let targetEmpresaId = usuarioId;

  const isAdmin = role === Roles.ADMIN || role === Roles.MODERADOR;
  const isEmpresa = role === Roles.EMPRESA;

  // Se é admin e passou empresaId, usar o empresaId fornecido
  if (isAdmin && queryEmpresaId && typeof queryEmpresaId === 'string') {
    targetEmpresaId = queryEmpresaId;
  } else if (!isEmpresa && !isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Sem permissão para acessar planos da empresa',
    });
  }

  const planos = await pagamentosService.listarPlanos(targetEmpresaId);

  return res.json({
    success: true,
    data: planos,
  });
});

