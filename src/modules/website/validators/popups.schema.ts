import { z } from 'zod';

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
};

const optionalUrlSchema = z.preprocess(
  emptyStringToUndefined,
  z.string().url('Informe uma URL absoluta válida').max(2048).optional().nullable(),
);

const popupImageUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    if (!value) return true;
    if (value.startsWith('/')) return true;

    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }, 'Informe uma URL válida ou um caminho iniciando com "/"');

export const popupStatusSchema = z.enum(['PUBLICADO', 'RASCUNHO']);
export const popupDispositivoSchema = z.enum(['AMBOS', 'MOBILE', 'DESKTOP']);
export const popupEscopoSchema = z.enum(['WEBSITE', 'DASHBOARD', 'AMBOS']);
export const popupPosicaoSchema = z.enum([
  'CENTRO',
  'ESQUERDA_SUPERIOR',
  'DIREITA_SUPERIOR',
  'ESQUERDA_INFERIOR',
  'DIREITA_INFERIOR',
]);
export const popupGatilhoSchema = z.enum([
  'IMEDIATAMENTE',
  'ATRASO',
  'INATIVIDADE',
  'SCROLL',
  'SAIDA',
  'CLIQUE',
  'HOVER',
]);
export const popupCronogramaSchema = z.enum(['EXIBIR_AGORA', 'PERIODO']);
export const popupFrequenciaSchema = z.enum([
  'SEM_LIMITE',
  'UMA_VEZ_POR_SESSAO',
  'UMA_VEZ_A_CADA_HORA',
  'UMA_VEZ_A_CADA_6_HORAS',
  'UMA_VEZ_A_CADA_24_HORAS',
]);
export const popupTriggerTargetSchema = z.enum([
  'website-logo',
  'website-nav-home',
  'website-nav-about',
  'website-nav-courses',
  'website-nav-vagas',
  'website-nav-recruitment',
  'website-nav-training',
  'website-user-menu',
  'website-recrutamento-cta',
  'website-footer-about',
  'website-footer-how-it-works',
  'website-footer-how-to-buy',
  'website-footer-cookie-preferences',
  'website-footer-courses',
  'website-footer-for-business',
  'website-footer-for-candidates',
  'website-footer-faq',
  'website-footer-help-center',
  'website-footer-ombudsman',
  'dashboard-user-menu',
  'dashboard-sidebar-item',
  'dashboard-vagas-create-button',
  'dashboard-popup-new-button',
  'dashboard-popup-save-draft-button',
  'dashboard-popup-publish-button',
]);

export const popupSpecificPageSchema = z.enum([
  'HOME',
  'ABOUT',
  'COURSES',
  'RECRUITMENT',
  'TRAINING',
  'JOBS',
  'FAQ',
  'PRIVACY',
  'TERMS',
]);

const popupBuilderStructureSchema = z.enum(['SINGLE', 'ROW_2', 'ROW_3', 'COLUMN_2', 'COLUMN_3']);

const popupBuilderAtomicTypeSchema = z.enum([
  'TITLE',
  'PARAGRAPH',
  'IMAGE',
  'BUTTON',
  'CONSENT',
  'INPUT',
  'VIDEO',
  'TIMER',
  'ROULETTE',
  'COUPON',
  'SOCIAL_LINKS',
]);

const popupBuilderInputKindSchema = z.enum(['NAME', 'EMAIL', 'PHONE']);
const popupBuilderHeadingLevelSchema = z.enum(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const popupBuilderSocialPlatformSchema = z.enum([
  'FACEBOOK',
  'INSTAGRAM',
  'LINKEDIN',
  'YOUTUBE',
  'WHATSAPP',
  'X',
]);
const popupBuilderSocialIconSizeSchema = z.enum(['SM', 'MD', 'LG']);
const popupBuilderSocialIconShapeSchema = z.enum(['ROUNDED', 'CIRCLE', 'SQUARE']);
const popupBuilderSocialThemeSchema = z.enum(['COLOR', 'DARK', 'LIGHT']);
const popupBuilderSocialAlignSchema = z.enum(['LEFT', 'CENTER', 'RIGHT']);
const popupBuilderCouponVariantSchema = z.enum(['ALPHA', 'OMEGA', 'SIGMA', 'DELTA']);
const popupBuilderCouponToneSchema = z.enum(['PRIMARY', 'SECONDARY', 'LIGHT', 'DARK']);
const popupBuilderCouponScopeSchema = z.enum(['COURSES', 'SUBSCRIPTIONS']);

const popupRouletteContactFieldSchema = z.enum(['NAME', 'EMAIL', 'PHONE']);

const popupRouletteItemSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().trim().min(1).max(120),
  weight: z.coerce.number().min(0).max(100).optional(),
  couponId: z.string().uuid().optional().nullable(),
  couponCode: z.string().trim().max(120).optional().nullable(),
  couponValue: z.string().trim().max(120).optional().nullable(),
  couponValidity: z.string().trim().max(120).optional().nullable(),
  caption: z.string().trim().max(120).optional().nullable(),
  color: z.string().trim().max(40).optional(),
  textColor: z.string().trim().max(40).optional(),
  isNoPrize: z.boolean().optional(),
  noPrizeMessage: z.string().trim().max(500).optional().nullable(),
  noPrizeContactFields: z.array(popupRouletteContactFieldSchema).max(3).optional(),
});

const popupBuilderSocialLinkSchema = z.object({
  id: z.string().min(1).max(80),
  platform: popupBuilderSocialPlatformSchema,
  url: z.string().trim().max(2048).optional().nullable(),
});

const popupBuilderAtomicNodeSchema = z
  .object({
    id: z.string().min(1).max(80),
    kind: z.literal('ATOMIC'),
    type: popupBuilderAtomicTypeSchema,
    content: z.string().trim().max(500).optional().nullable(),
    className: z.string().trim().max(1400).optional().nullable(),
    textColor: z.string().trim().max(40).optional().nullable(),
    buttonBackgroundColor: z.string().trim().max(40).optional().nullable(),
    headingLevel: popupBuilderHeadingLevelSchema.optional().nullable(),
    consentCheckbox: z.boolean().optional(),
    url: z.string().trim().max(2048).optional().nullable(),
    alt: z.string().trim().max(160).optional().nullable(),
    inputKind: popupBuilderInputKindSchema.optional(),
    label: z.string().trim().max(120).optional().nullable(),
    placeholder: z.string().trim().max(160).optional().nullable(),
    required: z.boolean().optional(),
    timerDurationSeconds: z.coerce.number().int().min(1).max(86400).optional(),
    couponCode: z.string().trim().max(120).optional().nullable(),
    couponValue: z.string().trim().max(120).optional().nullable(),
    couponCaption: z.string().trim().max(120).optional().nullable(),
    couponValidity: z.string().trim().max(120).optional().nullable(),
    couponVariant: popupBuilderCouponVariantSchema.optional(),
    couponTone: popupBuilderCouponToneSchema.optional(),
    couponId: z.string().uuid().optional().nullable(),
    couponScope: popupBuilderCouponScopeSchema.optional().nullable(),
    rouletteScope: popupBuilderCouponScopeSchema.optional().nullable(),
    rouletteCouponIds: z.array(z.string().uuid()).max(24).optional(),
    rouletteItems: z.array(popupRouletteItemSchema).max(24).optional(),
    rouletteNoPrizeTitle: z.string().trim().max(120).optional().nullable(),
    rouletteNoPrizeMessage: z.string().trim().max(500).optional().nullable(),
    rouletteNoPrizeButtonText: z.string().trim().max(80).optional().nullable(),
    rouletteNoPrizeContactFields: z.array(popupRouletteContactFieldSchema).max(3).optional(),
    socialLinks: z.array(popupBuilderSocialLinkSchema).max(12).optional(),
    socialIconSize: popupBuilderSocialIconSizeSchema.optional(),
    socialIconShape: popupBuilderSocialIconShapeSchema.optional(),
    socialTheme: popupBuilderSocialThemeSchema.optional(),
    socialGap: z.coerce.number().int().min(0).max(40).optional(),
    socialAlign: popupBuilderSocialAlignSchema.optional(),
    socialWidthPercent: z.coerce.number().int().min(40).max(100).optional(),
  })
  .superRefine((node, ctx) => {
    if (node.type === 'INPUT' && !node.inputKind) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['inputKind'],
        message: 'Defina o tipo do campo de entrada.',
      });
    }

    if (node.type === 'COUPON' && node.couponScope && !node.couponId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['couponId'],
        message: 'Selecione um cupom válido para este bloco.',
      });
    }

    if (node.type === 'ROULETTE') {
      if (node.rouletteItems && node.rouletteItems.length > 0) {
        const hasPrizeSegment = node.rouletteItems.some((item) => !item.isNoPrize);
        const hasInvalidPrizeSegment = node.rouletteItems.some(
          (item) => !item.isNoPrize && !item.couponId,
        );

        if (hasPrizeSegment && !node.rouletteScope) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['rouletteScope'],
            message: 'Defina o tipo de cupom da roleta.',
          });
        }

        if (hasInvalidPrizeSegment) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['rouletteItems'],
            message: 'Todo segmento premiado precisa ter um cupom vinculado.',
          });
        }
      }
    }
  });

const popupBuilderAreaNodeSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.literal('AREA'),
  children: z.array(popupBuilderAtomicNodeSchema).max(24),
});

const popupBuilderRootNodeSchema = z
  .object({
    id: z.string().min(1).max(80),
    kind: z.literal('ROOT'),
    structure: popupBuilderStructureSchema,
    reverse: z.boolean().optional(),
    areas: z.array(popupBuilderAreaNodeSchema).min(1).max(3),
  })
  .superRefine((root, ctx) => {
    const expectedAreaCount =
      root.structure === 'SINGLE'
        ? 1
        : root.structure === 'ROW_2' || root.structure === 'COLUMN_2'
          ? 2
          : 3;

    if (root.areas.length !== expectedAreaCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['areas'],
        message: `A estrutura ${root.structure} exige exatamente ${expectedAreaCount} área(s).`,
      });
    }
  });

export const popupContentSchema = z
  .object({
    titulo: z.string().max(140).default('Entre para nossa lista'),
    subtitulo: z.string().max(500).default('Receba novidades e oportunidades da Advance+.'),
    botaoTexto: z.string().max(60).default('Cadastrar'),
    textoLegal: z.string().max(500).optional().nullable(),
    builderTree: popupBuilderRootNodeSchema.optional().nullable(),
  })
  .passthrough();

export const popupFormFieldSchema = z.object({
  id: z.string().min(1).max(60),
  type: z.enum(['text', 'email', 'tel', 'whatsapp', 'checkbox', 'select']),
  label: z.string().min(1).max(120),
  placeholder: z.string().max(140).optional().nullable(),
  required: z.boolean().default(false),
  order: z.coerce.number().int().min(0).max(50).default(0),
  options: z.array(z.string().max(80)).max(20).optional(),
});

export const popupDesignSchema = z
  .object({
    backgroundColor: z.string().max(40).default('#ffffff'),
    layout: z
      .enum([
        'SEM_PLANO_DE_FUNDO',
        'PLANO_DE_FUNDO',
        'IMAGEM_ESQUERDA',
        'IMAGEM_DIREITA',
        'IMAGEM_TOPO',
        'IMAGEM_EMBAIXO',
        'DUAS_COLUNAS',
      ])
      .default('IMAGEM_ESQUERDA'),
    imageUrl: popupImageUrlSchema.optional().nullable(),
    imageAlt: z.string().max(160).optional().nullable(),
    imageDisposition: z
      .enum(['PREENCHER', 'REPETIR', 'CENTRALIZAR', 'ESTICAR'])
      .default('PREENCHER'),
    imagePosition: z.enum(['CENTRO', 'TOPO', 'ESQUERDA', 'DIREITA', 'BASE']).default('CENTRO'),
    imageProportion: z.enum(['50', '33', '25']).default('50'),
    showImageOnMobile: z.boolean().default(true),
  })
  .passthrough();

export const popupSubscriptionSchema = z
  .object({
    email: z.string().max(80).default('DESCADASTRADOS_E_DESCONHECIDOS'),
    sms: z.string().max(80).optional().nullable(),
    whatsapp: z.string().max(80).default('QUALQUER_UM'),
  })
  .passthrough();

export const popupPageRulesSchema = z
  .object({
    mode: z
      .enum(['ALL_PAGES', 'HOME', 'COURSES', 'URL_CONTAINS', 'HTML_SELECTOR', 'SPECIFIC_PAGE'])
      .default('ALL_PAGES'),
    urlContains: z.string().max(500).optional().nullable(),
    htmlSelector: z.string().max(255).optional().nullable(),
    pageKey: popupSpecificPageSchema.optional().nullable(),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    if (value.mode === 'URL_CONTAINS') {
      const snippet = value.urlContains?.trim();
      if (!snippet) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['urlContains'],
          message: 'Informe o trecho da rota.',
        });
      } else if (!/^\/[^\s]*$/.test(snippet)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['urlContains'],
          message: 'Informe uma rota válida iniciando com "/".',
        });
      }
    }

    if (value.mode === 'SPECIFIC_PAGE' && !value.pageKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pageKey'],
        message: 'Selecione uma página específica.',
      });
    }
  });

const popupBaseSchema = z.object({
  nome: z.string().trim().min(1, 'Digite o nome do pop-up').max(100),
  templateSlug: z.string().trim().max(80).optional().nullable(),
  status: popupStatusSchema.default('RASCUNHO'),
  dispositivo: popupDispositivoSchema.default('AMBOS'),
  escopo: popupEscopoSchema.default('WEBSITE'),
  posicaoDesktop: popupPosicaoSchema.default('CENTRO'),
  posicaoMobile: popupPosicaoSchema.default('CENTRO'),
  gatilho: popupGatilhoSchema.default('ATRASO'),
  atrasoSegundos: z.coerce.number().int().min(0).max(3600).default(5),
  inatividadeSegundos: z.coerce.number().int().min(1).max(3600).optional().nullable(),
  scrollPercentual: z.coerce.number().int().min(1).max(100).optional().nullable(),
  seletorAlvo: z.string().trim().max(255).optional().nullable(),
  triggerTarget: popupTriggerTargetSchema.optional().nullable(),
  cronograma: popupCronogramaSchema.default('EXIBIR_AGORA'),
  inicioEm: z.coerce.date().optional().nullable(),
  fimEm: z.coerce.date().optional().nullable(),
  frequencia: popupFrequenciaSchema.default('UMA_VEZ_A_CADA_6_HORAS'),
  tag: z.string().trim().max(80).optional().nullable(),
  redirectUrl: optionalUrlSchema,
  redirectNovaAba: z.boolean().default(false),
  prioridade: z.coerce.number().int().min(0).max(1000).default(0),
  contentConfig: popupContentSchema.default({}),
  formFields: z.array(popupFormFieldSchema).max(12).default([]),
  designConfig: popupDesignSchema.default({}),
  subscriptionConfig: popupSubscriptionSchema.default({}),
  pageRules: popupPageRulesSchema.default({}),
});

function applyPopupConditionalValidation<
  T extends {
    gatilho?: string | null;
    triggerTarget?: string | null;
    seletorAlvo?: string | null;
    cronograma?: string | null;
    inicioEm?: Date | null;
    fimEm?: Date | null;
    status?: string | null;
    contentConfig?: {
      builderTree?: {
        areas?: {
          children?: Record<string, unknown>[];
        }[];
      } | null;
    } | null;
  },
>(value: T, ctx: z.RefinementCtx) {
  if (
    (value.gatilho === 'CLIQUE' || value.gatilho === 'HOVER') &&
    !value.triggerTarget &&
    !value.seletorAlvo?.trim()
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['triggerTarget'],
      message: 'Selecione um alvo do gatilho.',
    });
  }

  if (value.cronograma === 'PERIODO') {
    if (!value.inicioEm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['inicioEm'],
        message: 'Selecione a data inicial.',
      });
    }

    if (!value.fimEm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fimEm'],
        message: 'Selecione a data final.',
      });
    }

    if (value.inicioEm && value.fimEm && value.fimEm < value.inicioEm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fimEm'],
        message: 'A data final não pode ser anterior à inicial.',
      });
    }
  }

  if (!value.contentConfig?.builderTree || value.status !== 'PUBLICADO') {
    return;
  }

  const atomicNodes =
    value.contentConfig.builderTree.areas?.flatMap((area) => area.children ?? []) ?? [];

  const couponNodes = atomicNodes.filter((node) => node.type === 'COUPON');
  couponNodes.forEach((node, index) => {
    if (!node.couponScope || !node.couponId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contentConfig', 'builderTree', 'areas', index],
        message: 'Blocos de cupom publicados exigem tipo de cupom e cupom ativo.',
      });
    }
  });

  const rouletteNodes = atomicNodes.filter((node) => node.type === 'ROULETTE');
  rouletteNodes.forEach((node, index) => {
    const items = Array.isArray(node.rouletteItems) ? node.rouletteItems : [];
    const totalWeight = items.reduce((sum, item) => sum + Number(item.weight ?? 0), 0);
    const hasNoPrizeSegment = items.some((item) => item.isNoPrize);
    const hasPrizeSegment = items.some((item) => !item.isNoPrize);
    const hasInvalidPrizeSegment = items.some((item) => !item.isNoPrize && !item.couponId);

    if (items.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contentConfig', 'builderTree', 'areas', index],
        message: 'A roleta publicada precisa ter pelo menos dois segmentos.',
      });
    }

    if (totalWeight !== 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contentConfig', 'builderTree', 'areas', index],
        message: 'A soma das chances da roleta precisa totalizar 100%.',
      });
    }

    if (hasPrizeSegment && !node.rouletteScope) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contentConfig', 'builderTree', 'areas', index],
        message: 'Defina o tipo de cupom da roleta antes de publicar.',
      });
    }

    if (hasInvalidPrizeSegment) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contentConfig', 'builderTree', 'areas', index],
        message: 'Todo segmento premiado precisa ter um cupom válido.',
      });
    }

    if (hasNoPrizeSegment && !String(node.rouletteNoPrizeMessage ?? '').trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contentConfig', 'builderTree', 'areas', index],
        message: 'Defina a mensagem global exibida quando o usuário não ganhar.',
      });
    }
  });
}

export const createPopupSchema = popupBaseSchema.superRefine(applyPopupConditionalValidation);

export const updatePopupSchema = popupBaseSchema
  .partial()
  .superRefine(applyPopupConditionalValidation);

export const listPopupsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(10),
  search: z.string().trim().max(120).optional(),
  status: popupStatusSchema.optional(),
  dispositivo: popupDispositivoSchema.optional(),
  escopo: popupEscopoSchema.optional(),
});

export const activePopupsQuerySchema = z.object({
  scope: popupEscopoSchema.exclude(['AMBOS']).default('WEBSITE'),
  path: z.string().max(2048).default('/'),
  device: popupDispositivoSchema.exclude(['AMBOS']).default('DESKTOP'),
});

export const createPopupContactSchema = z.object({
  nome: z.string().trim().max(160).optional().nullable(),
  email: z.string().trim().email().max(255).optional().nullable(),
  telefone: z.string().trim().max(30).optional().nullable(),
  whatsapp: z.string().trim().max(30).optional().nullable(),
  tag: z.string().trim().max(80).optional().nullable(),
  origemPath: z.string().max(2048).optional().nullable(),
  payload: z.record(z.union([z.string().max(1000), z.boolean(), z.number(), z.null()])).default({}),
});

export const listPopupContactsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(10),
  search: z.string().trim().max(120).optional(),
  popupId: z.string().uuid().optional(),
  origemPath: z.string().trim().max(2048).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const updatePopupContactSchema = z.object({
  nome: z.string().trim().max(160).optional().nullable(),
  email: z.string().trim().email().max(255).optional().nullable(),
  telefone: z.string().trim().max(30).optional().nullable(),
  whatsapp: z.string().trim().max(30).optional().nullable(),
  tag: z.string().trim().max(80).optional().nullable(),
});

export const popupLeadStatusSchema = z.enum([
  'NOVO',
  'EM_ATENDIMENTO',
  'QUALIFICANDO',
  'QUALIFICADO',
  'CONVERTIDO',
  'PERDIDO',
  'ARQUIVADO',
]);

export const popupLeadOpportunityStatusSchema = z.enum([
  'ABERTA',
  'EM_ANDAMENTO',
  'GANHA',
  'PERDIDA',
]);

export const popupLeadListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(10),
  search: z.string().trim().max(120).optional(),
  popupId: z.string().uuid().optional(),
  origemPath: z.string().trim().max(2048).optional(),
  status: popupLeadStatusSchema.optional(),
  ownerUsuarioId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const updatePopupLeadSchema = z.object({
  nome: z.string().trim().max(250).optional().nullable(),
  email: z.string().trim().email().max(255).optional().nullable(),
  telefone: z.string().trim().max(30).optional().nullable(),
  whatsapp: z.string().trim().max(30).optional().nullable(),
  empresa: z.string().trim().max(160).optional().nullable(),
  idade: z.coerce.number().int().min(0).max(120).optional().nullable(),
  dataNascimento: z.coerce.date().optional().nullable(),
  endereco: z.string().trim().max(255).optional().nullable(),
  cidade: z.string().trim().max(120).optional().nullable(),
  estado: z.string().trim().max(80).optional().nullable(),
  status: popupLeadStatusSchema.optional(),
  ownerUsuarioId: z.string().uuid().optional().nullable(),
  tag: z.string().trim().max(80).optional().nullable(),
});

export const createPopupLeadNoteSchema = z.object({
  conteudo: z.string().trim().min(1).max(4000),
});

export const updatePopupLeadNoteSchema = createPopupLeadNoteSchema;

export const createPopupLeadInterestSchema = z.object({
  label: z.string().trim().min(1).max(120),
});

export const createPopupLeadOpportunitySchema = z.object({
  titulo: z.string().trim().min(1).max(160),
  status: popupLeadOpportunityStatusSchema.default('ABERTA'),
  valorEsperado: z.coerce.number().min(0).max(999999999).optional().nullable(),
  closeDate: z.coerce.date().optional().nullable(),
  descricao: z.string().trim().max(4000).optional().nullable(),
  ownerUsuarioId: z.string().uuid().optional().nullable(),
});

export const updatePopupLeadOpportunitySchema = createPopupLeadOpportunitySchema.partial();

export type CreatePopupInput = z.infer<typeof createPopupSchema>;
export type UpdatePopupInput = z.infer<typeof updatePopupSchema>;
export type ListPopupsQuery = z.infer<typeof listPopupsQuerySchema>;
export type ActivePopupsQuery = z.infer<typeof activePopupsQuerySchema>;
export type CreatePopupContactInput = z.infer<typeof createPopupContactSchema>;
export type ListPopupContactsQuery = z.infer<typeof listPopupContactsQuerySchema>;
export type UpdatePopupContactInput = z.infer<typeof updatePopupContactSchema>;
export type PopupLeadListQuery = z.infer<typeof popupLeadListQuerySchema>;
export type UpdatePopupLeadInput = z.infer<typeof updatePopupLeadSchema>;
export type CreatePopupLeadNoteInput = z.infer<typeof createPopupLeadNoteSchema>;
export type UpdatePopupLeadNoteInput = z.infer<typeof updatePopupLeadNoteSchema>;
export type CreatePopupLeadInterestInput = z.infer<typeof createPopupLeadInterestSchema>;
export type CreatePopupLeadOpportunityInput = z.infer<typeof createPopupLeadOpportunitySchema>;
export type UpdatePopupLeadOpportunityInput = z.infer<typeof updatePopupLeadOpportunitySchema>;
