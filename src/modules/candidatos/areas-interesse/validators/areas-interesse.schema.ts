import { z } from 'zod';

export const createAreaInteresseSchema = z.object({
  categoria: z
    .string({ required_error: 'Categoria é obrigatória' })
    .trim()
    .min(1, 'Categoria é obrigatória')
    .max(120, 'Categoria deve ter no máximo 120 caracteres'),
  subareas: z
    .array(
      z
        .string({ required_error: 'Subárea é obrigatória' })
        .trim()
        .min(1, 'Subárea não pode ser vazia')
        .max(120, 'Subárea deve ter no máximo 120 caracteres'),
    )
    .nonempty('Informe ao menos uma subárea'),
});

export const updateAreaInteresseSchema = createAreaInteresseSchema.partial({
  categoria: true,
  subareas: true,
});

export type CreateAreaInteresseInput = z.infer<typeof createAreaInteresseSchema>;
export type UpdateAreaInteresseInput = z.infer<typeof updateAreaInteresseSchema>;
