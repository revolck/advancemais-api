import { Router } from "express";
import { criarUsuario } from "../register";
import {
  loginUsuario,
  logoutUsuario,
  refreshToken,
  obterPerfil,
} from "../controllers";
import { authMiddleware } from "../middlewares";
import { supabaseAuthMiddleware } from "../auth";
import { WelcomeEmailMiddleware } from "../../brevo/middlewares/welcome-email-middleware";
import { PaymentController } from "../controllers/payment-controller";
import passwordRecoveryRoutes from "./password-recovery";
import { prisma } from "../../../config/prisma";

/**
 * Rotas do módulo de usuários - CORRIGIDAS
 * Implementa todas as funcionalidades de gestão de usuários
 *
 * @author Sistema AdvanceMais
 * @version 3.0.1
 */
const router = Router();

// Instanciar o PaymentController
const paymentController = new PaymentController();

// =============================================
// ROTAS PÚBLICAS (sem autenticação)
// =============================================

/**
 * Informações do módulo de usuários
 * GET /usuarios
 */
router.get("/", (req, res) => {
  res.json({
    module: "Usuarios Module",
    version: "3.0.1",
    endpoints: {
      register: "POST /registrar",
      login: "POST /login",
      logout: "POST /logout",
      profile: "GET /perfil",
      passwordRecovery: "POST /recuperar-senha",
      payments: "POST /pagamentos/*",
      admin: "GET /admin",
    },
  });
});

/**
 * Registro de novo usuário (com email de boas-vindas)
 * POST /registrar
 */
router.post("/registrar", criarUsuario, WelcomeEmailMiddleware.create());

/**
 * Login de usuário
 * POST /login
 */
router.post("/login", loginUsuario);

/**
 * Validação de refresh token
 * POST /refresh
 */
router.post("/refresh", refreshToken);

/**
 * Rotas de recuperação de senha
 * /recuperar-senha/*
 */
router.use("/recuperar-senha", passwordRecoveryRoutes);

// =============================================
// ROTAS PROTEGIDAS (requerem autenticação)
// =============================================

/**
 * Logout de usuário
 * POST /logout
 */
router.post("/logout", authMiddleware(), logoutUsuario);

/**
 * Perfil do usuário autenticado
 * GET /perfil
 */
router.get("/perfil", supabaseAuthMiddleware(), obterPerfil);

// =============================================
// ROTAS DE PAGAMENTOS - MercadoPago
// =============================================

/**
 * Processar pagamento de curso individual
 * POST /pagamentos/curso
 */
router.post(
  "/pagamentos/curso",
  supabaseAuthMiddleware(),
  paymentController.processarPagamentoCurso
);

/**
 * Criar assinatura premium
 * POST /pagamentos/assinatura
 */
router.post(
  "/pagamentos/assinatura",
  supabaseAuthMiddleware(),
  paymentController.criarAssinaturaPremium
);

/**
 * Cancelar assinatura
 * PUT /pagamentos/assinatura/cancelar
 */
router.put(
  "/pagamentos/assinatura/cancelar",
  supabaseAuthMiddleware(),
  paymentController.cancelarAssinatura
);

/**
 * Histórico de pagamentos do usuário
 * GET /pagamentos/historico
 */
router.get(
  "/pagamentos/historico",
  supabaseAuthMiddleware(),
  paymentController.listarHistoricoPagamentos
);

// =============================================
// ROTAS ADMINISTRATIVAS
// =============================================

/**
 * Área administrativa (apenas ADMIN)
 * GET /admin
 */
router.get("/admin", supabaseAuthMiddleware(["ADMIN"]), (req, res) => {
  res.json({
    message: "Área administrativa",
    usuario: req.user,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Listar usuários (ADMIN e MODERADOR)
 * GET /listar
 */
router.get(
  "/listar",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  async (req, res) => {
    try {
      const { page = 1, limit = 50, status, role, tipoUsuario } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      // Construir filtros dinamicamente
      const where: any = {};
      if (status) where.status = status;
      if (role) where.role = role;
      if (tipoUsuario) where.tipoUsuario = tipoUsuario;

      const usuarios = await prisma.usuario.findMany({
        where,
        select: {
          id: true,
          email: true,
          nomeCompleto: true,
          role: true,
          status: true,
          tipoUsuario: true,
          criadoEm: true,
          ultimoLogin: true,
          emailBoasVindasEnviado: true,
          _count: {
            select: {
              mercadoPagoOrders: true,
              mercadoPagoSubscriptions: true,
            },
          },
        },
        orderBy: {
          criadoEm: "desc",
        },
        skip,
        take: Number(limit),
      });

      const total = await prisma.usuario.count({ where });

      res.json({
        message: "Lista de usuários",
        usuarios,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      console.error("Erro ao listar usuários:", error);
      res.status(500).json({
        message: "Erro ao listar usuários",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }
);

/**
 * Estatísticas do dashboard (ADMIN e MODERADOR)
 * GET /dashboard-stats
 */
router.get(
  "/dashboard-stats",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  async (req, res) => {
    try {
      const totalUsuarios = await prisma.usuario.count();
      const usuariosAtivos = await prisma.usuario.count({
        where: { status: "ATIVO" },
      });
      const usuariosHoje = await prisma.usuario.count({
        where: {
          criadoEm: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      });

      const totalOrders = await prisma.mercadoPagoOrder.count();
      const ordersAprovadas = await prisma.mercadoPagoOrder.count({
        where: { status: "closed" },
      });
      const totalAssinaturas = await prisma.mercadoPagoSubscription.count();
      const assinaturasAtivas = await prisma.mercadoPagoSubscription.count({
        where: { status: "authorized" },
      });

      const receitaOrders = await prisma.mercadoPagoOrder.aggregate({
        where: { status: "closed" },
        _sum: { paidAmount: true },
      });

      const receitaAssinaturas = await prisma.mercadoPagoSubscription.aggregate(
        {
          where: { status: "authorized" },
          _sum: { transactionAmount: true },
        }
      );

      res.json({
        message: "Estatísticas do dashboard",
        stats: {
          usuarios: {
            total: totalUsuarios,
            ativos: usuariosAtivos,
            hoje: usuariosHoje,
          },
          pagamentos: {
            totalOrders,
            ordersAprovadas,
            totalAssinaturas,
            assinaturasAtivas,
          },
          receita: {
            orders: receitaOrders._sum.paidAmount || 0,
            assinaturas: receitaAssinaturas._sum.transactionAmount || 0,
            total:
              (receitaOrders._sum.paidAmount || 0) +
              (receitaAssinaturas._sum.transactionAmount || 0),
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Erro ao obter estatísticas:", error);
      res.status(500).json({
        message: "Erro ao obter estatísticas",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }
);

// =============================================
// ROTAS COM PARÂMETROS - DEFINIDAS POR ÚLTIMO
// =============================================

/**
 * Buscar usuário por ID
 * GET /usuario/:userId
 */
router.get(
  "/usuario/:userId",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  async (req, res) => {
    try {
      const { userId } = req.params;

      if (!userId || userId.trim() === "") {
        return res.status(400).json({
          message: "ID do usuário é obrigatório",
        });
      }

      const usuario = await prisma.usuario.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          nomeCompleto: true,
          cpf: true,
          cnpj: true,
          telefone: true,
          dataNasc: true,
          genero: true,
          matricula: true,
          role: true,
          status: true,
          tipoUsuario: true,
          supabaseId: true,
          ultimoLogin: true,
          criadoEm: true,
          atualizadoEm: true,
          emailBoasVindasEnviado: true,
          dataEmailBoasVindas: true,
          empresa: {
            select: {
              id: true,
              nome: true,
            },
          },
          enderecos: {
            select: {
              id: true,
              logradouro: true,
              numero: true,
              bairro: true,
              cidade: true,
              estado: true,
              cep: true,
            },
          },
          mercadoPagoOrders: {
            select: {
              id: true,
              mercadoPagoOrderId: true,
              status: true,
              totalAmount: true,
              paidAmount: true,
              criadoEm: true,
            },
            orderBy: { criadoEm: "desc" },
            take: 10,
          },
          mercadoPagoSubscriptions: {
            select: {
              id: true,
              mercadoPagoSubscriptionId: true,
              status: true,
              reason: true,
              transactionAmount: true,
              criadoEm: true,
            },
            orderBy: { criadoEm: "desc" },
            take: 5,
          },
        },
      });

      if (!usuario) {
        return res.status(404).json({
          message: "Usuário não encontrado",
        });
      }

      res.json({
        message: "Usuário encontrado",
        usuario,
      });
    } catch (error) {
      console.error("Erro ao buscar usuário:", error);
      res.status(500).json({
        message: "Erro ao buscar usuário",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }
);

/**
 * Atualizar status de usuário
 * PATCH /usuario/:userId/status
 */
router.patch(
  "/usuario/:userId/status",
  supabaseAuthMiddleware(["ADMIN"]),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { status, motivo } = req.body;

      if (!userId || userId.trim() === "") {
        return res.status(400).json({
          message: "ID do usuário é obrigatório",
        });
      }

      const statusValidos = [
        "ATIVO",
        "INATIVO",
        "BANIDO",
        "PENDENTE",
        "SUSPENSO",
      ];

      if (!status || !statusValidos.includes(status)) {
        return res.status(400).json({
          message: "Status inválido",
          statusValidos,
        });
      }

      const usuarioAntes = await prisma.usuario.findUnique({
        where: { id: userId },
        select: { status: true, email: true, nomeCompleto: true },
      });

      if (!usuarioAntes) {
        return res.status(404).json({
          message: "Usuário não encontrado",
        });
      }

      const usuario = await prisma.usuario.update({
        where: { id: userId },
        data: { status },
        select: {
          id: true,
          email: true,
          nomeCompleto: true,
          status: true,
          atualizadoEm: true,
        },
      });

      // Se o status mudou para SUSPENSO ou BANIDO, cancelar assinatura ativa
      if (
        (status === "SUSPENSO" || status === "BANIDO") &&
        usuarioAntes.status === "ATIVO"
      ) {
        try {
          const assinaturaAtiva =
            await prisma.mercadoPagoSubscription.findFirst({
              where: {
                usuarioId: userId,
                status: "authorized",
              },
            });

          if (assinaturaAtiva) {
            const { SubscriptionService } = await import(
              "../../mercadopago/services/subscription-service"
            );
            const subscriptionService = new SubscriptionService();
            await subscriptionService.cancelSubscription(
              assinaturaAtiva.mercadoPagoSubscriptionId,
              userId
            );

            console.log(
              `Assinatura ${assinaturaAtiva.mercadoPagoSubscriptionId} cancelada devido à suspensão/banimento do usuário ${userId}`
            );
          }
        } catch (error) {
          console.error(
            "Erro ao cancelar assinatura do usuário suspenso/banido:",
            error
          );
        }
      }

      console.log(
        `Status do usuário ${userId} alterado de ${
          usuarioAntes.status
        } para ${status} ${motivo ? `(Motivo: ${motivo})` : ""}`
      );

      res.json({
        message: "Status do usuário atualizado com sucesso",
        usuario,
        statusAnterior: usuarioAntes.status,
      });
    } catch (error) {
      console.error("Erro ao atualizar status:", error);

      if (
        error instanceof Error &&
        error.message.includes("Record to update not found")
      ) {
        return res.status(404).json({
          message: "Usuário não encontrado",
        });
      }

      res.status(500).json({
        message: "Erro ao atualizar status do usuário",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }
);

/**
 * Atualizar role de usuário (apenas ADMIN)
 * PATCH /usuario/:userId/role
 */
router.patch(
  "/usuario/:userId/role",
  supabaseAuthMiddleware(["ADMIN"]),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { role, motivo } = req.body;

      if (!userId || !role) {
        return res.status(400).json({
          message: "ID do usuário e role são obrigatórios",
        });
      }

      const rolesValidas = [
        "ADMIN",
        "MODERADOR",
        "FINANCEIRO",
        "PROFESSOR",
        "EMPRESA",
        "PEDAGOGICO",
        "RECRUTADOR",
        "PSICOLOGO",
        "ALUNO_CANDIDATO",
      ];

      if (!rolesValidas.includes(role)) {
        return res.status(400).json({
          message: "Role inválida",
          rolesValidas,
        });
      }

      if (req.user?.id === userId && role !== "ADMIN") {
        return res.status(400).json({
          message:
            "Você não pode alterar sua própria role para uma função não-administrativa",
        });
      }

      const usuario = await prisma.usuario.update({
        where: { id: userId },
        data: { role },
        select: {
          id: true,
          email: true,
          nomeCompleto: true,
          role: true,
          atualizadoEm: true,
        },
      });

      console.log(
        `Role do usuário ${userId} alterada para ${role} ${
          motivo ? `(Motivo: ${motivo})` : ""
        }`
      );

      res.json({
        message: "Role do usuário atualizada com sucesso",
        usuario,
      });
    } catch (error) {
      console.error("Erro ao atualizar role:", error);
      res.status(500).json({
        message: "Erro ao atualizar role do usuário",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }
);

/**
 * Histórico de pagamentos de um usuário específico
 * GET /usuario/:userId/pagamentos
 */
router.get(
  "/usuario/:userId/pagamentos",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR", "FINANCEIRO"]),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      if (!userId) {
        return res.status(400).json({
          message: "ID do usuário é obrigatório",
        });
      }

      const orders = await prisma.mercadoPagoOrder.findMany({
        where: { usuarioId: userId },
        orderBy: { criadoEm: "desc" },
        skip,
        take: Number(limit),
        select: {
          id: true,
          mercadoPagoOrderId: true,
          status: true,
          totalAmount: true,
          paidAmount: true,
          refundedAmount: true,
          externalReference: true,
          processingMode: true,
          criadoEm: true,
          dateCreated: true,
          dateClosed: true,
        },
      });

      const subscriptions = await prisma.mercadoPagoSubscription.findMany({
        where: { usuarioId: userId },
        orderBy: { criadoEm: "desc" },
        select: {
          id: true,
          mercadoPagoSubscriptionId: true,
          status: true,
          reason: true,
          transactionAmount: true,
          frequency: true,
          frequencyType: true,
          nextPaymentDate: true,
          criadoEm: true,
          dateCreated: true,
        },
      });

      const refunds = await prisma.mercadoPagoRefund.findMany({
        where: { usuarioId: userId },
        orderBy: { criadoEm: "desc" },
        take: 10,
        select: {
          id: true,
          mercadoPagoRefundId: true,
          amount: true,
          status: true,
          reason: true,
          criadoEm: true,
        },
      });

      const totalOrders = await prisma.mercadoPagoOrder.count({
        where: { usuarioId: userId },
      });

      res.json({
        message: "Histórico de pagamentos do usuário",
        data: {
          orders,
          subscriptions,
          refunds,
          summary: {
            totalOrders: orders.length,
            totalSubscriptions: subscriptions.length,
            totalRefunds: refunds.length,
            totalPaid: orders.reduce((sum, order) => sum + order.paidAmount, 0),
            totalRefunded: refunds.reduce(
              (sum, refund) => sum + refund.amount,
              0
            ),
          },
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: totalOrders,
            pages: Math.ceil(totalOrders / Number(limit)),
          },
        },
      });
    } catch (error) {
      console.error("Erro ao buscar histórico de pagamentos:", error);
      res.status(500).json({
        message: "Erro ao buscar histórico de pagamentos",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }
);

export default router;
