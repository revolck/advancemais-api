import { Router, type NextFunction, type Request, type Response } from 'express';
import { supabaseAuthMiddleware } from '../../usuarios/auth';
import {
  executarCicloComunicado,
  iniciarValidacaoEmSegundoPlano,
  sincronizarSemEnviar,
} from '../comunicados/primeiro-acesso.cron';
import {
  listarPendencias,
  obterPainel,
  TIPOS_PENDENCIA,
  type TipoPendencia,
} from '../comunicados/primeiro-acesso.painel';
import { revogarSenhaProvisoria } from '../comunicados/primeiro-acesso.service';
import {
  corrigirEmailDoAluno,
  garantirAlunoDaCampanha,
  reenviarParaAluno,
  type ContextoSuporte,
} from '../comunicados/primeiro-acesso.suporte';

/**
 * Comunicado "A nova Advance+ está no ar" para os alunos migrados.
 * Montado em /api/v1/email/comunicados/primeiro-acesso.
 */
const router = Router();

const SUPORTE = ['ADMIN', 'MODERADOR'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_POR_CODIGO: Record<string, number> = {
  INVALID_EMAIL: 400,
  USER_NOT_FOUND: 404,
  EMAIL_ALREADY_EXISTS: 409,
};

function responderErro(res: Response, next: NextFunction, error: unknown) {
  const { statusCode, code, message } = (error ?? {}) as {
    statusCode?: number;
    code?: string;
    message?: string;
  };
  const status = statusCode ?? (code ? STATUS_POR_CODIGO[code] : undefined);
  if (status && status >= 400 && status < 500) {
    return res.status(status).json({ success: false, code, message });
  }
  return next(error);
}

const contexto = (req: Request): ContextoSuporte => ({
  actorId: req.user?.id ?? null,
  actorRole: req.user?.role ?? null,
  ip: req.ip ?? null,
  userAgent: req.get('user-agent') ?? null,
});

const inteiro = (valor: unknown, min: number, max: number, padrao?: number) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.min(Math.max(Math.trunc(numero), min), max) : padrao;
};

function validarUsuarioId(req: Request, res: Response) {
  if (UUID.test(req.params.usuarioId)) return true;
  res.status(400).json({ success: false, code: 'INVALID_ID', message: 'ID do aluno inválido' });
  return false;
}

/**
 * @openapi
 * /api/v1/email/comunicados/primeiro-acesso:
 *   get:
 *     summary: Painel do comunicado de primeiro acesso
 *     description: Situação (motivo de pausa e condições para retomar), validação dos e-mails, envios, entregas, devoluções, taxa das últimas 24h, aquecimento e créditos da Brevo.
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Painel
 * /api/v1/email/comunicados/primeiro-acesso/pendencias:
 *   get:
 *     summary: Alunos que precisam de correção de e-mail ou revisão
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: tipo, schema: { type: string } }
 *       - { in: query, name: busca, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: pageSize, schema: { type: integer, maximum: 100 } }
 *     responses:
 *       200:
 *         description: Lista paginada (CPF mascarado; nenhuma senha é exposta)
 * /api/v1/email/comunicados/primeiro-acesso/ciclo:
 *   post:
 *     summary: Executa um ciclo do comunicado agora (sincroniza, valida e envia o que for permitido)
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               limite: { type: integer, minimum: 1, maximum: 500 }
 *     responses:
 *       200:
 *         description: Resultado do ciclo
 *       409:
 *         description: Já existe um ciclo em execução
 * /api/v1/email/comunicados/primeiro-acesso/sincronizar:
 *   post:
 *     summary: Consulta a Brevo (bloqueios, devoluções, entregas) sem enviar nada
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resultado da sincronização
 *       502:
 *         description: A Brevo não respondeu
 * /api/v1/email/comunicados/primeiro-acesso/validar:
 *   post:
 *     summary: Valida em segundo plano os e-mails da fila (não envia nada)
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               limite: { type: integer, minimum: 1, maximum: 5000 }
 *     responses:
 *       202:
 *         description: Validação iniciada; acompanhe pelo painel
 *       409:
 *         description: Já existe uma validação em execução
 * /api/v1/email/comunicados/primeiro-acesso/alunos/{usuarioId}/corrigir-email:
 *   post:
 *     summary: Corrige o e-mail do aluno, valida e (opcionalmente) envia o comunicado
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *               enviarAgora: { type: boolean, default: true }
 *     responses:
 *       200:
 *         description: E-mail corrigido; resultado da validação e do envio
 * /api/v1/email/comunicados/primeiro-acesso/alunos/{usuarioId}/reenviar:
 *   post:
 *     summary: Reenvia o comunicado (nova senha provisória) se o e-mail estiver validado
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resultado da validação e do envio
 *       409:
 *         description: O endereço voltou e precisa de correção, ou o aluno já trocou a senha
 * /api/v1/email/comunicados/primeiro-acesso/alunos/{usuarioId}/revogar-senha:
 *   post:
 *     summary: Invalida a senha provisória ainda não usada (ex.: possivelmente exposta)
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               motivo: { type: string, maxLength: 200 }
 *     responses:
 *       200:
 *         description: Senha revogada
 *       409:
 *         description: O aluno já trocou a senha provisória
 */
router.get('/', supabaseAuthMiddleware(SUPORTE), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await obterPainel() });
  } catch (error) {
    next(error);
  }
});

router.get('/pendencias', supabaseAuthMiddleware(SUPORTE), async (req, res, next) => {
  try {
    const tipo = typeof req.query.tipo === 'string' ? req.query.tipo : undefined;
    if (tipo && !TIPOS_PENDENCIA.includes(tipo as TipoPendencia)) {
      return res
        .status(400)
        .json({ success: false, code: 'INVALID_TIPO', message: 'Tipo inválido' });
    }
    const data = await listarPendencias({
      tipo: tipo as TipoPendencia | undefined,
      busca: typeof req.query.busca === 'string' ? req.query.busca.slice(0, 120) : undefined,
      page: inteiro(req.query.page, 1, 10_000, 1),
      pageSize: inteiro(req.query.pageSize, 1, 100, 20),
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/ciclo', supabaseAuthMiddleware(['ADMIN']), async (req, res, next) => {
  try {
    const resultado = await executarCicloComunicado({ limite: inteiro(req.body?.limite, 1, 500) });
    if (!resultado) {
      return res.status(409).json({
        success: false,
        message: 'Já existe um ciclo do comunicado em execução',
        code: 'CICLO_EM_EXECUCAO',
      });
    }
    res.json({ success: true, data: resultado });
  } catch (error) {
    next(error);
  }
});

router.post('/sincronizar', supabaseAuthMiddleware(['ADMIN']), async (_req, res) => {
  try {
    res.json({ success: true, data: await sincronizarSemEnviar() });
  } catch (error) {
    res.status(502).json({
      success: false,
      code: 'BREVO_INDISPONIVEL',
      message: error instanceof Error ? error.message : 'A Brevo não respondeu',
    });
  }
});

router.post('/validar', supabaseAuthMiddleware(['ADMIN']), (req, res) => {
  const iniciado = iniciarValidacaoEmSegundoPlano(inteiro(req.body?.limite, 1, 5000, 500) ?? 500);
  if (!iniciado) {
    return res.status(409).json({
      success: false,
      code: 'VALIDACAO_EM_EXECUCAO',
      message: 'Já existe uma validação em execução',
    });
  }
  res.status(202).json({ success: true, data: { iniciado: true } });
});

router.post(
  '/alunos/:usuarioId/corrigir-email',
  supabaseAuthMiddleware(SUPORTE),
  async (req, res, next) => {
    if (!validarUsuarioId(req, res)) return;
    const email = typeof req.body?.email === 'string' ? req.body.email : '';
    if (!email.trim()) {
      return res
        .status(400)
        .json({ success: false, code: 'INVALID_EMAIL', message: 'Informe o e-mail' });
    }
    try {
      const data = await corrigirEmailDoAluno(req.params.usuarioId, email, {
        enviarAgora: req.body?.enviarAgora !== false,
        contexto: contexto(req),
      });
      res.json({ success: true, data });
    } catch (error) {
      responderErro(res, next, error);
    }
  },
);

router.post(
  '/alunos/:usuarioId/reenviar',
  supabaseAuthMiddleware(SUPORTE),
  async (req, res, next) => {
    if (!validarUsuarioId(req, res)) return;
    try {
      res.json({
        success: true,
        data: await reenviarParaAluno(req.params.usuarioId, contexto(req)),
      });
    } catch (error) {
      responderErro(res, next, error);
    }
  },
);

router.post(
  '/alunos/:usuarioId/revogar-senha',
  supabaseAuthMiddleware(SUPORTE),
  async (req, res, next) => {
    if (!validarUsuarioId(req, res)) return;
    try {
      await garantirAlunoDaCampanha(req.params.usuarioId);
      const motivo =
        typeof req.body?.motivo === 'string' && req.body.motivo.trim()
          ? req.body.motivo.trim().slice(0, 200)
          : 'senha provisória possivelmente exposta';
      await revogarSenhaProvisoria(req.params.usuarioId, { motivo, ...contexto(req) });
      res.json({ success: true, data: { revogada: true } });
    } catch (error) {
      responderErro(res, next, error);
    }
  },
);

export { router as comunicadoPrimeiroAcessoRoutes };
