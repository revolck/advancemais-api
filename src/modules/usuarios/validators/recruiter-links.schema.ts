import { z } from 'zod';

export const recruiterLinkUserParamsSchema = z.object({
  userId: z.string().uuid(),
});

export const recruiterLinkDeleteParamsSchema = z.object({
  userId: z.string().uuid(),
  vinculoId: z.string().uuid(),
});

export const recruiterLinkVagaOptionsQuerySchema = z.object({
  empresaUsuarioId: z.string().uuid(),
});

export const recruiterLinkCreateBodySchema = z
  .object({
    tipoVinculo: z.enum(['EMPRESA', 'VAGA']),
    empresaUsuarioId: z.string().uuid(),
    vagaId: z.string().uuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.tipoVinculo === 'EMPRESA' && value.vagaId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['vagaId'],
        message: 'vagaId não deve ser enviado para vínculo por empresa',
      });
    }

    if (value.tipoVinculo === 'VAGA' && !value.vagaId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['vagaId'],
        message: 'vagaId é obrigatório para vínculo por vaga',
      });
    }
  });

export type RecruiterLinkCreateBody = z.infer<typeof recruiterLinkCreateBodySchema>;
