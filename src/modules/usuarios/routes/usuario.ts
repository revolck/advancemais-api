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

const router = Router();

// Instanciar o PaymentController
const paymentController = new PaymentController();

/**
 * Rotas públicas (sem autenticação)
 */

// POST /registrar - Registro de novo usuário (com email de boas-vindas)
router.post("/registrar", criarUsuario, WelcomeEmailMiddleware.create());

// POST /login - Login de usuário
router.post("/login", loginUsuario);

// POST /refresh - Validação de refresh token
router.post("/refresh", refreshToken);

// Rotas de recuperação de senha
router.use("/recuperar-senha", passwordRecoveryRoutes);

/**
 * Rotas protegidas (requerem autenticação)
 */

// POST /logout - Logout de usuário
router.post("/logout", authMiddleware(), logoutUsuario);

// GET /perfil - Perfil do usuário autenticado
router.get("/perfil", supabaseAuthMiddleware(), obterPerfil);

/**
 * Rotas de Pagamentos - Integração com MercadoPago
 */

// POST /pagamentos/curso - Processar pagamento de curso individual
router.post(
  "/pagamentos/curso",
  supabaseAuthMiddleware(),
  paymentController.processarPagamentoCurso
);

// POST /pagamentos/assinatura - Criar assinatura premium
router.post(
  "/pagamentos/assinatura",
  supabaseAuthMiddleware(),
  paymentController.criarAssinaturaPremium
);

// PUT /pagamentos/assinatura/cancelar - Cancelar assinatura
router.put(
  "/pagamentos/assinatura/cancelar",
  supabaseAuthMiddleware(),
  paymentController.cancelarAssinatura
);

// GET /pagamentos/historico - Listar histórico de pagamentos do usuário
router.get(
  "/pagamentos/historico",
  supabaseAuthMiddleware(),
  paymentController.listarHistoricoPagamentos
);

/**
 * Rotas administrativas
 */

// GET /admin - Rota apenas para administradores
router.get("/admin", supabaseAuthMiddleware(["ADMIN"]), (req, res) => {
  res.json({
    message: "Área administrativa",
    usuario: req.user,
    timestamp: new Date().toISOString(),
  });
});

// GET /listar - Listar usuários (ADMIN e MODERADOR)
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
          // Incluir contadores de pagamentos
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

      // Contar total para paginação
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

// GET /dashboard-stats - Estatísticas do dashboard (ADMIN e MODERADOR)
router.get(
  "/dashboard-stats",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  async (req, res) => {
    try {
      // Estatísticas básicas de usuários
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

      // Estatísticas de pagamentos
      const totalOrders = await prisma.mercadoPagoOrder.count();
      const ordersAprovadas = await prisma.mercadoPagoOrder.count({
        where: { status: "closed" },
      });
      const totalAssinaturas = await prisma.mercadoPagoSubscription.count();
      const assinaturasAtivas = await prisma.mercadoPagoSubscription.count({
        where: { status: "authorized" },
      });

      // Receita total (aproximada)
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

/**
 * Rotas com parâmetros - definidas por último para evitar conflitos
 */

// GET /usuario/:userId - Buscar usuário por ID
router.get(
  "/usuario/:userId",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  async (req, res) => {
    try {
      const { userId } = req.params;

      // Validação básica do parâmetro
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
          // Incluir dados de pagamentos
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

// PATCH /usuario/:userId/status - Atualizar status de usuário
router.patch(
  "/usuario/:userId/status",
  supabaseAuthMiddleware(["ADMIN"]),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { status, motivo } = req.body;

      // Validação básica dos parâmetros
      if (!userId || userId.trim() === "") {
        return res.status(400).json({
          message: "ID do usuário é obrigatório",
        });
      }

      // Validação de status válido
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

      // Buscar dados do usuário antes da atualização
      const usuarioAntes = await prisma.usuario.findUnique({
        where: { id: userId },
        select: { status: true, email: true, nomeCompleto: true },
      });

      if (!usuarioAntes) {
        return res.status(404).json({
          message: "Usuário não encontrado",
        });
      }

      // Atualizar status
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
            // Cancelar assinatura via MercadoPago
            const subscriptionService =
              new (require("../../mercadopago/services/subscription-service").SubscriptionService)();
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
          // Não falha o processo principal
        }
      }

      // Log da alteração
      console.log(
        `Status do usuário ${userId} alterado de ${usuarioAntes.status} para ${status} ${motivo ? `(Motivo: ${motivo})` : ""}`
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

// PATCH /usuario/:userId/role - Atualizar role de usuário (apenas ADMIN)
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

      // Validação de role válida
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

      // Prevenir que o usuário altere sua própria role para não-ADMIN
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
        `Role do usuário ${userId} alterada para ${role} ${motivo ? `(Motivo: ${motivo})` : ""}`
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

// GET /usuario/:userId/pagamentos - Histórico de pagamentos de um usuário específico (ADMIN/MODERADOR)
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

      // Buscar orders
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

      // Buscar assinaturas
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

      // Buscar reembolsos
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
