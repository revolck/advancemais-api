import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { assinaturasService } from '@/modules/mercadopago/assinaturas/services/assinaturas.service';
import { mercadopagoConfig } from '@/config/env';
import crypto from 'crypto';
import {
  startCheckoutSchema,
  cancelSchema,
  changePlanSchema,
} from '@/modules/mercadopago/assinaturas/validators/assinaturas.schema';

export class AssinaturasController {
  static checkout = async (req: Request, res: Response) => {
    try {
      const payload = startCheckoutSchema.parse(req.body);
      const result = await assinaturasService.startCheckout(payload);
      res.status(201).json({ success: true, ...result });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res
          .status(400)
          .json({ success: false, code: 'VALIDATION_ERROR', issues: error.flatten().fieldErrors });
      }
      res.status(500).json({
        success: false,
        code: 'CHECKOUT_ERROR',
        message: 'Erro ao iniciar checkout',
        error: error?.message,
      });
    }
  };

  static webhook = async (req: Request, res: Response) => {
    try {
      const secret = mercadopagoConfig.webhookSecret;
      const signature =
        (req.headers['x-signature'] as string) || (req.headers['x-hub-signature'] as string) || '';
      if (secret && signature) {
        const raw = (req as any).rawBody || JSON.stringify(req.body || {});
        const computed = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
        if (computed !== signature) {
          return res.status(401).json({ success: false, code: 'INVALID_SIGNATURE' });
        }
      }

      await assinaturasService.handleWebhook({
        type: (req.body as any)?.type,
        action: (req.body as any)?.action,
        data: (req.body as any)?.data || req.body,
      });
      res.status(200).json({ received: true });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'WEBHOOK_ERROR',
        message: 'Erro ao processar webhook',
        error: error?.message,
      });
    }
  };

  static cancel = async (req: Request, res: Response) => {
    try {
      const payload = cancelSchema.parse(req.body);
      const result = await assinaturasService.cancel(payload.usuarioId, payload.motivo);
      res.json({ success: true, ...result });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res
          .status(400)
          .json({ success: false, code: 'VALIDATION_ERROR', issues: error.flatten().fieldErrors });
      }
      res.status(500).json({
        success: false,
        code: 'CANCEL_ERROR',
        message: 'Erro ao cancelar assinatura',
        error: error?.message,
      });
    }
  };

  static upgrade = async (req: Request, res: Response) => {
    try {
      const payload = changePlanSchema.parse(req.body);
      const result = await assinaturasService.upgrade(
        payload.usuarioId,
        payload.novoPlanosEmpresariaisId,
      );
      res.json({ success: true, assinatura: result });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res
          .status(400)
          .json({ success: false, code: 'VALIDATION_ERROR', issues: error.flatten().fieldErrors });
      }
      res.status(500).json({
        success: false,
        code: 'UPGRADE_ERROR',
        message: 'Erro no upgrade',
        error: error?.message,
      });
    }
  };

  static downgrade = async (req: Request, res: Response) => {
    try {
      const payload = changePlanSchema.parse(req.body);
      const result = await assinaturasService.downgrade(
        payload.usuarioId,
        payload.novoPlanosEmpresariaisId,
      );
      res.json({ success: true, assinatura: result });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res
          .status(400)
          .json({ success: false, code: 'VALIDATION_ERROR', issues: error.flatten().fieldErrors });
      }
      res.status(500).json({
        success: false,
        code: 'DOWNGRADE_ERROR',
        message: 'Erro no downgrade',
        error: error?.message,
      });
    }
  };

  static remindPayment = async (req: Request, res: Response) => {
    try {
      const { usuarioId } = req.body as { usuarioId?: string };
      if (!usuarioId)
        return res
          .status(400)
          .json({ success: false, code: 'VALIDATION_ERROR', message: 'usuarioId é obrigatório' });
      const result = await assinaturasService.remindPayment(usuarioId);
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'REMIND_ERROR',
        message: 'Erro ao reemitir cobrança',
        error: error?.message,
      });
    }
  };

  static reconcile = async (_req: Request, res: Response) => {
    try {
      const result = await assinaturasService.reconcile();
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'RECONCILE_ERROR',
        message: 'Erro na reconciliação',
        error: error?.message,
      });
    }
  };

  // Admin: reemitir cobrança por plano específico para um usuário
  static adminRemindPaymentForPlan = async (req: Request, res: Response) => {
    try {
      const {
        usuarioId,
        planosEmpresariaisId,
        metodoPagamento,
        successUrl,
        failureUrl,
        pendingUrl,
      } = req.body as any;
      if (!usuarioId || !planosEmpresariaisId) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'usuarioId e planosEmpresariaisId são obrigatórios',
        });
      }
      const result = await assinaturasService.adminRemindPaymentForPlan({
        usuarioId,
        planosEmpresariaisId,
        metodoPagamento,
        successUrl,
        failureUrl,
        pendingUrl,
      });
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'ADMIN_REMIND_ERROR',
        message: 'Erro ao reemitir cobrança para o plano',
        error: error?.message,
      });
    }
  };

  // Admin: sincronizar todos os planos empresariais como PreApprovalPlan no MP
  static adminSyncPlans = async (_req: Request, res: Response) => {
    try {
      // Busca todos os planos e cria/garante preapprovalPlan
      const { prisma } = await import('../../../../config/prisma.js');
      const planos = await prisma.planosEmpresariais.findMany({
        select: { id: true, mpPreapprovalPlanId: true },
      });
      const results: Record<string, string> = {};
      for (const p of planos) {
        try {
          const id = await assinaturasService.ensurePlanPreapproval(p.id);
          results[p.id] = id;
        } catch (e: any) {
          results[p.id] = `ERROR: ${e?.message || 'unknown'}`;
        }
      }
      res.json({ success: true, count: planos.length, results });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'SYNC_PLANS_ERROR',
        message: 'Erro ao sincronizar planos',
        error: error?.message,
      });
    }
  };

  static adminSyncPlan = async (req: Request, res: Response) => {
    try {
      const { planosEmpresariaisId } = req.body as any;
      if (!planosEmpresariaisId) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'planosEmpresariaisId é obrigatório',
        });
      }
      const mpPreapprovalPlanId =
        await assinaturasService.ensurePlanPreapproval(planosEmpresariaisId);
      res.json({ success: true, planosEmpresariaisId, mpPreapprovalPlanId });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'SYNC_PLAN_ERROR',
        message: 'Erro ao sincronizar plano',
        error: error?.message,
      });
    }
  };
}
