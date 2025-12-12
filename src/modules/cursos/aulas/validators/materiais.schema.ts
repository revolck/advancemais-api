import { z } from 'zod';

// Enum de tipo de material
const tipoMaterialEnum = z.enum(['ARQUIVO', 'LINK', 'TEXTO']);

/**
 * Schema para criar material via URL do blob storage
 */
export const createMaterialArquivoSchema = z.object({
  tipo: z.literal('ARQUIVO'),
  titulo: z.string().min(3, 'Título deve ter no mínimo 3 caracteres').max(255),
  descricao: z.string().max(500).optional(),
  obrigatorio: z.boolean().optional().default(false),
  // Campos do arquivo (fornecidos pelo frontend após upload no blob)
  arquivoUrl: z.string().url('URL do arquivo inválida'),
  arquivoNome: z.string().min(1, 'Nome do arquivo é obrigatório'),
  arquivoTamanho: z
    .number()
    .int()
    .positive('Tamanho deve ser maior que 0')
    .max(5 * 1024 * 1024, 'Arquivo excede 5MB'),
  arquivoMimeType: z.string().min(1, 'MIME type é obrigatório'),
});

/**
 * Schema para criar material tipo LINK
 */
export const createMaterialLinkSchema = z.object({
  tipo: z.literal('LINK'),
  titulo: z.string().min(3).max(255),
  descricao: z.string().max(500).optional(),
  obrigatorio: z.boolean().optional().default(false),
  linkUrl: z.string().url('URL inválida'),
});

/**
 * Schema para criar material tipo TEXTO
 */
export const createMaterialTextoSchema = z.object({
  tipo: z.literal('TEXTO'),
  titulo: z.string().min(3).max(255),
  descricao: z.string().max(500).optional(),
  obrigatorio: z.boolean().optional().default(false),
  conteudoHtml: z.string().min(10, 'Conteúdo deve ter no mínimo 10 caracteres'),
});

/**
 * Union schema - aceita qualquer tipo
 */
export const createMaterialSchema = z.discriminatedUnion('tipo', [
  createMaterialArquivoSchema,
  createMaterialLinkSchema,
  createMaterialTextoSchema,
]);

/**
 * Schema para atualizar material
 */
export const updateMaterialSchema = z.object({
  titulo: z.string().min(3).max(255).optional(),
  descricao: z.string().max(500).optional(),
  obrigatorio: z.boolean().optional(),
  ordem: z.number().int().min(0).optional(),
});

/**
 * Schema para reordenar materiais
 */
export const reordenarMateriaisSchema = z.object({
  ordens: z
    .array(
      z.object({
        id: z.string().uuid(),
        ordem: z.number().int().min(0),
      }),
    )
    .min(1),
});

// Tipos exportados
export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;
export type ReordenarMateriaisInput = z.infer<typeof reordenarMateriaisSchema>;
