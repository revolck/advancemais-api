import { Router } from 'express';
import { supabaseAuthMiddleware } from '../auth';
import { obterContexto } from './assistente.service';

/**
 * Assistente Advance+ do painel. Montado em /api/v1/usuarios/assistente.
 */
const router = Router();

/**
 * @openapi
 * /api/v1/usuarios/assistente/contexto:
 *   get:
 *     summary: Fatos do dia para o assistente (conforme a função do usuário logado)
 *     description: |
 *       Empresa: plano ativo, limite e uso de vagas, candidatos novos, entrevistas.
 *       Aluno/candidato: cursos em andamento, pagamentos pendentes, certificados,
 *       currículos, candidaturas, entrevistas. Equipe: pendências da função
 *       (vagas em análise, acessos a liberar, aulas de hoje, provas para corrigir...).
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "{ role, empresa | aluno | equipe }"
 */
router.get('/contexto', supabaseAuthMiddleware(), async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await obterContexto({ id: req.user!.id, role: String(req.user!.role) }),
    });
  } catch (error) {
    next(error);
  }
});

export { router as assistenteRoutes };
