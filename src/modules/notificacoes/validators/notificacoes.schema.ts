import { z } from 'zod';

// Enum de tipos de notificação (espelhando o Prisma)
export const NotificacaoTipoEnum = z.enum([
  'VAGA_REJEITADA',
  'VAGA_APROVADA',
  'NOVO_CANDIDATO',
  'VAGA_PREENCHIDA',
  'PLANO_EXPIRANDO',
  'PLANO_EXPIRADO',
  'ASSINATURA_RENOVADA',
  'PAGAMENTO_APROVADO',
  'PAGAMENTO_RECUSADO',
  'CANDIDATURA_VISUALIZADA',
  'CANDIDATURA_APROVADA',
  'CANDIDATURA_REJEITADA',
  'SISTEMA',
]);

export const NotificacaoStatusEnum = z.enum(['NAO_LIDA', 'LIDA', 'ARQUIVADA']);

export const NotificacaoPrioridadeEnum = z.enum(['BAIXA', 'NORMAL', 'ALTA', 'URGENTE']);

// Schema para listar notificações
export const listNotificacoesSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  status: z.array(NotificacaoStatusEnum).optional(),
  tipo: z.array(NotificacaoTipoEnum).optional(),
  prioridade: z.array(NotificacaoPrioridadeEnum).optional(),
  apenasNaoLidas: z.coerce.boolean().optional(),
});

export type ListNotificacoesQuery = z.infer<typeof listNotificacoesSchema>;

// Schema para marcar como lida
export const marcarComoLidaSchema = z.object({
  notificacaoIds: z.array(z.string().uuid()).min(1).max(100),
});

export type MarcarComoLidaInput = z.infer<typeof marcarComoLidaSchema>;

// Schema para marcar todas como lidas
export const marcarTodasComoLidasSchema = z.object({
  tipo: NotificacaoTipoEnum.optional(),
});

export type MarcarTodasComoLidasInput = z.infer<typeof marcarTodasComoLidasSchema>;

// Schema para arquivar notificações
export const arquivarNotificacoesSchema = z.object({
  notificacaoIds: z.array(z.string().uuid()).min(1).max(100),
});

export type ArquivarNotificacoesInput = z.infer<typeof arquivarNotificacoesSchema>;

// Schema para criar notificação (uso interno)
export const criarNotificacaoSchema = z.object({
  usuarioId: z.string().uuid(),
  tipo: NotificacaoTipoEnum,
  titulo: z.string().min(1).max(200),
  mensagem: z.string().min(1),
  prioridade: NotificacaoPrioridadeEnum.optional().default('NORMAL'),
  vagaId: z.string().uuid().optional(),
  candidaturaId: z.string().uuid().optional(),
  empresasPlanoId: z.string().uuid().optional(),
  dados: z.record(z.any()).optional(),
  linkAcao: z.string().max(500).optional(),
  expiraEm: z.coerce.date().optional(),
});

export type CriarNotificacaoInput = z.infer<typeof criarNotificacaoSchema>;


