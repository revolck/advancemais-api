import { z } from 'zod';

export const curriculoCreateSchema = z.object({
  titulo: z.string().trim().max(255).optional(),
  resumo: z.string().trim().max(5000).optional(),
  objetivo: z.string().trim().max(1000).optional(),
  areasInteresse: z.any().optional(),
  preferencias: z.any().optional(),
  habilidades: z.any().optional(),
  idiomas: z.any().optional(),
  experiencias: z.any().optional(),
  formacao: z.any().optional(),
  cursosCertificacoes: z.any().optional(),
  premiosPublicacoes: z.any().optional(),
  acessibilidade: z.any().optional(),
  consentimentos: z.any().optional(),
});

export const curriculoUpdateSchema = curriculoCreateSchema.partial();

export type CurriculoCreateInput = z.infer<typeof curriculoCreateSchema>;
export type CurriculoUpdateInput = z.infer<typeof curriculoUpdateSchema>;
