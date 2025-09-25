import { EmpresasPlanoModo, EmpresasPlanoStatus } from '@prisma/client';
import { z } from 'zod';

export const clientePlanoModoSchema = z
  .string({ required_error: 'Informe o modo do plano' })
  .trim()
  .min(1, 'Informe o modo do plano')
  .transform((value) => value.toUpperCase())
  .pipe(z.nativeEnum(EmpresasPlanoModo));

const uuidSchema = z.string().uuid('Informe um identificador válido');

const diasTesteSchema = z
  .number({ invalid_type_error: 'Informe um número de dias válido' })
  .int('Informe um número inteiro de dias')
  .positive('Dias de teste deve ser maior que zero')
  .max(365, 'Máximo de 365 dias')
  .optional();

export const createClientePlanoSchema = z
  .object({
    usuarioId: uuidSchema,
    planosEmpresariaisId: uuidSchema,
    modo: clientePlanoModoSchema,
    iniciarEm: z.coerce.date({ invalid_type_error: 'Informe uma data válida' }).optional(),
    diasTeste: diasTesteSchema,
  })
  .refine(
    (val) => (val.modo !== EmpresasPlanoModo.TESTE ? true : typeof val.diasTeste === 'number'),
    {
      message: 'Informe diasTeste para o modo teste',
      path: ['diasTeste'],
    },
  );

export const updateClientePlanoSchema = z.object({
  planosEmpresariaisId: uuidSchema.optional(),
  modo: clientePlanoModoSchema.optional(),
  iniciarEm: z.coerce.date({ invalid_type_error: 'Informe uma data válida' }).optional(),
  diasTeste: diasTesteSchema,
});

export const listClientePlanoQuerySchema = z.object({
  usuarioId: uuidSchema.optional(),
  status: z
    .nativeEnum(EmpresasPlanoStatus)
    .or(
      z
        .string()
        .trim()
        .toUpperCase()
        .transform((v) => v as any),
    )
    .optional(),
  modo: clientePlanoModoSchema.optional(),
});

export type CreateClientePlanoInput = z.infer<typeof createClientePlanoSchema>;
export type UpdateClientePlanoInput = z.infer<typeof updateClientePlanoSchema>;
export type ListClientePlanoQuery = z.infer<typeof listClientePlanoQuerySchema>;
export type ClientePlanoModo = z.infer<typeof clientePlanoModoSchema>;
