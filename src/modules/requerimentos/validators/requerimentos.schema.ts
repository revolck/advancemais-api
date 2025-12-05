import { z } from 'zod';

// Tipos de requerimento
export const requerimentoTipoSchema = z.enum([
  'CANCELAMENTO_PLANO',
  'REEMBOLSO',
  'SUPORTE_TECNICO',
  'ALTERACAO_DADOS',
  'DENUNCIA',
  'RECLAMACAO',
  'OUTROS',
]);

// Status de requerimento
export const requerimentoStatusSchema = z.enum([
  'ABERTO',
  'EM_ANALISE',
  'AGUARDANDO_USUARIO',
  'RESOLVIDO',
  'CANCELADO',
  'RECUSADO',
]);

// Prioridade de requerimento
export const requerimentoPrioridadeSchema = z.enum(['BAIXA', 'MEDIA', 'ALTA', 'URGENTE']);

// Schema para criar requerimento (usuário)
export const criarRequerimentoSchema = z.object({
  tipo: requerimentoTipoSchema,
  titulo: z.string().min(5, 'Título deve ter no mínimo 5 caracteres').max(200),
  descricao: z.string().min(20, 'Descrição deve ter no mínimo 20 caracteres').max(5000),
  // Referências opcionais
  empresasPlanoId: z.string().uuid().optional(),
  empresasVagaId: z.string().uuid().optional(),
  // Para reembolso
  valorReembolso: z.number().positive().optional(),
  motivoReembolso: z.string().max(500).optional(),
  // Anexos (URLs)
  anexos: z.array(z.string().url()).max(5).optional(),
});

// Schema para atualizar requerimento (admin)
export const atualizarRequerimentoAdminSchema = z.object({
  status: requerimentoStatusSchema.optional(),
  prioridade: requerimentoPrioridadeSchema.optional(),
  atribuidoParaId: z.string().uuid().optional().nullable(),
  respostaAdmin: z.string().max(5000).optional(),
});

// Schema para adicionar comentário
export const adicionarComentarioSchema = z.object({
  comentario: z.string().min(1).max(2000),
});

// Schema para listar requerimentos
export const listarRequerimentosSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
  status: z.union([requerimentoStatusSchema, z.array(requerimentoStatusSchema)]).optional(),
  tipo: z.union([requerimentoTipoSchema, z.array(requerimentoTipoSchema)]).optional(),
  prioridade: requerimentoPrioridadeSchema.optional(),
  usuarioId: z.string().uuid().optional(),
  atribuidoParaId: z.string().uuid().optional(),
  search: z.string().optional(),
  criadoDe: z.coerce.date().optional(),
  criadoAte: z.coerce.date().optional(),
});

// Schema para solicitar reembolso (direito de arrependimento - 7 dias)
export const solicitarReembolsoSchema = z.object({
  empresasPlanoId: z.string().uuid(),
  motivo: z.string().min(20, 'Motivo deve ter no mínimo 20 caracteres').max(500),
});

export type CriarRequerimentoInput = z.infer<typeof criarRequerimentoSchema>;
export type AtualizarRequerimentoAdminInput = z.infer<typeof atualizarRequerimentoAdminSchema>;
export type AdicionarComentarioInput = z.infer<typeof adicionarComentarioSchema>;
export type ListarRequerimentosInput = z.infer<typeof listarRequerimentosSchema>;
export type SolicitarReembolsoInput = z.infer<typeof solicitarReembolsoSchema>;

