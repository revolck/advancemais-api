import type { Request, Response } from 'express';
import { Roles } from '@prisma/client';

import { asyncHandler } from '@/utils/asyncHandler';
import { visaoGeralService } from '../services/visao-geral.service';

/**
 * GET /api/v1/empresas/visao-geral
 *
 * Retorna visão geral da empresa para o dashboard.
 *
 * Permissões:
 * - EMPRESA: Apenas dados próprios
 * - ADMIN/MODERADOR: Pode passar empresaId como query param
 */
export const getVisaoGeral = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Não autenticado',
    });
  }

  const { role, id: usuarioId } = req.user;

  // Query param opcional para admins
  const { empresaId: queryEmpresaId } = req.query;

  // Determinar ID da empresa baseado na role
  let targetEmpresaId = usuarioId;

  const isAdmin = role === Roles.ADMIN || role === Roles.MODERADOR;
  const isEmpresa = role === Roles.EMPRESA;

  // Se é admin e passou empresaId, usar o empresaId fornecido
  if (isAdmin && queryEmpresaId && typeof queryEmpresaId === 'string') {
    targetEmpresaId = queryEmpresaId;
  } else if (!isEmpresa && !isAdmin) {
    // Se não é empresa nem admin, não tem permissão
    return res.status(403).json({
      success: false,
      message: 'Sem permissão para acessar visão geral da empresa',
    });
  }

  const data = await visaoGeralService.getVisaoGeral(targetEmpresaId);

  return res.json({
    success: true,
    data,
  });
});

