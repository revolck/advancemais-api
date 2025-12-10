import { Router } from 'express';

import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { getVisaoGeral } from '../controllers/visao-geral.controller';

const router = Router();

/**
 * GET /api/v1/empresas/visao-geral
 * Retorna visão geral da empresa para o dashboard
 *
 * Autenticação: Requerida
 * Roles permitidos: EMPRESA, ADMIN, MODERADOR
 *
 * Query params:
 * - empresaId (opcional, apenas para ADMIN/MODERADOR): UUID da empresa
 *
 * Resposta inclui:
 * - Dados da empresa (nome, email, cnpj, telefone, cidade, estado)
 * - Plano atual (nome, status, vencimento, vagas disponíveis/utilizadas)
 * - Resumo de vagas (total, publicadas, rascunho, encerradas, em análise)
 * - Últimas 5 candidaturas (candidato, vaga, status, data)
 * - Últimas 5 notificações
 * - Estatísticas básicas (total candidaturas, novas na semana)
 */
router.get('/', supabaseAuthMiddleware(['EMPRESA', 'ADMIN', 'MODERADOR']), getVisaoGeral);

export { router as visaoGeralRoutes };
