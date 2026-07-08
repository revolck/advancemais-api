import {
  createPopupContactSchema,
  createPopupSchema,
  updatePopupSchema,
} from '../validators/popups.schema';

const basePopupPayload = {
  nome: 'Newsletter principal',
  status: 'RASCUNHO',
  dispositivo: 'AMBOS',
  escopo: 'WEBSITE',
  contentConfig: {
    titulo: 'Entre para nossa lista',
    subtitulo: 'Receba novidades da Advance+.',
    botaoTexto: 'Cadastrar',
  },
  formFields: [
    {
      id: 'email',
      type: 'email',
      label: 'Email',
      required: true,
      order: 0,
    },
  ],
  designConfig: {
    backgroundColor: '#ffffff',
    layout: 'IMAGEM_ESQUERDA',
    imageDisposition: 'PREENCHER',
    imagePosition: 'CENTRO',
    imageProportion: '50',
    showImageOnMobile: true,
  },
};

describe('website popups schema', () => {
  it('accepts a valid popup draft payload and applies defaults', () => {
    const parsed = createPopupSchema.safeParse(basePopupPayload);

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.gatilho).toBe('ATRASO');
    expect(parsed.data.atrasoSegundos).toBe(5);
    expect(parsed.data.frequencia).toBe('UMA_VEZ_A_CADA_6_HORAS');
  });

  it('accepts root-relative asset paths for popup image configuration', () => {
    const parsed = createPopupSchema.safeParse({
      ...basePopupPayload,
      designConfig: {
        ...basePopupPayload.designConfig,
        imageUrl: '/images/marketing/popups/desconto.svg',
      },
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.designConfig.imageUrl).toBe('/images/marketing/popups/desconto.svg');
  });

  it('accepts a fixed trigger target for click and hover flows', () => {
    const parsed = createPopupSchema.safeParse({
      ...basePopupPayload,
      gatilho: 'CLIQUE',
      triggerTarget: 'website-nav-courses',
      seletorAlvo: null,
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.triggerTarget).toBe('website-nav-courses');
  });

  it('rejects an unknown trigger target option', () => {
    const parsed = createPopupSchema.safeParse({
      ...basePopupPayload,
      gatilho: 'HOVER',
      triggerTarget: 'custom-free-selector',
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects invalid redirect URLs when provided', () => {
    const parsed = createPopupSchema.safeParse({
      ...basePopupPayload,
      redirectUrl: 'google.com',
    });

    expect(parsed.success).toBe(false);
  });

  it('accepts a specific page rule with fixed page key', () => {
    const parsed = createPopupSchema.safeParse({
      ...basePopupPayload,
      pageRules: {
        mode: 'SPECIFIC_PAGE',
        pageKey: 'ABOUT',
      },
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.pageRules?.mode).toBe('SPECIFIC_PAGE');
    expect(parsed.data.pageRules?.pageKey).toBe('ABOUT');
  });

  it('rejects url-based page rules when the route snippet is invalid', () => {
    const parsed = createPopupSchema.safeParse({
      ...basePopupPayload,
      pageRules: {
        mode: 'URL_CONTAINS',
        urlContains: 'google.com',
      },
    });

    expect(parsed.success).toBe(false);
  });

  it('allows empty redirect URL on update', () => {
    const parsed = updatePopupSchema.safeParse({
      redirectUrl: '',
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.redirectUrl).toBeUndefined();
  });

  it('limits form field count to avoid heavy runtime payloads', () => {
    const parsed = createPopupSchema.safeParse({
      ...basePopupPayload,
      formFields: Array.from({ length: 13 }).map((_, index) => ({
        id: `field_${index}`,
        type: 'text',
        label: `Campo ${index}`,
        required: false,
        order: index,
      })),
    });

    expect(parsed.success).toBe(false);
  });

  it('accepts builderTree payload with known atomic nodes', () => {
    const parsed = createPopupSchema.safeParse({
      ...basePopupPayload,
      contentConfig: {
        ...basePopupPayload.contentConfig,
        builderTree: {
          id: 'root_1',
          kind: 'ROOT',
          structure: 'COLUMN_2',
          reverse: false,
          areas: [
            {
              id: 'area_1',
              kind: 'AREA',
              children: [
                {
                  id: 'title_1',
                  kind: 'ATOMIC',
                  type: 'TITLE',
                  content: 'Título principal',
                  headingLevel: 'h1',
                  textColor: '#FFFFFF',
                  className: 'mx-auto max-w-[11ch] text-[2.7rem]! leading-[1.04]!',
                },
                {
                  id: 'coupon_1',
                  kind: 'ATOMIC',
                  type: 'COUPON',
                  couponScope: 'COURSES',
                  couponId: '4c9e5fd5-a0eb-41a1-95ea-a3be11351fa1',
                  couponCode: 'ADVANCE100',
                },
              ],
            },
            {
              id: 'area_2',
              kind: 'AREA',
              children: [
                {
                  id: 'roulette_1',
                  kind: 'ATOMIC',
                  type: 'ROULETTE',
                  rouletteScope: 'COURSES',
                  rouletteNoPrizeMessage: 'Quase lá!',
                  rouletteItems: [
                    {
                      id: 'item_1',
                      label: 'Prêmio',
                      weight: 60,
                      couponId: '4c9e5fd5-a0eb-41a1-95ea-a3be11351fa1',
                    },
                    {
                      id: 'item_2',
                      label: 'Tente novamente',
                      weight: 40,
                      isNoPrize: true,
                    },
                  ],
                },
                {
                  id: 'social_1',
                  kind: 'ATOMIC',
                  type: 'SOCIAL_LINKS',
                  socialLinks: [
                    {
                      id: 'social_link_1',
                      platform: 'FACEBOOK',
                      url: 'https://facebook.com/advance',
                    },
                    {
                      id: 'social_link_2',
                      platform: 'LINKEDIN',
                      url: 'https://linkedin.com/company/advance',
                    },
                  ],
                  socialIconSize: 'MD',
                  socialIconShape: 'CIRCLE',
                  socialTheme: 'COLOR',
                  socialGap: 12,
                  socialAlign: 'CENTER',
                  socialWidthPercent: 100,
                },
              ],
            },
          ],
        },
      },
      status: 'PUBLICADO',
    });

    expect(parsed.success).toBe(true);
  });

  it('accepts builderTree payload with visual presentation fields', () => {
    const parsed = createPopupSchema.safeParse({
      ...basePopupPayload,
      contentConfig: {
        ...basePopupPayload.contentConfig,
        builderTree: {
          id: 'root_1',
          kind: 'ROOT',
          structure: 'SINGLE',
          areas: [
            {
              id: 'area_1',
              kind: 'AREA',
              children: [
                {
                  id: 'title_1',
                  kind: 'ATOMIC',
                  type: 'TITLE',
                  content: 'Receba oportunidades personalizadas',
                  headingLevel: 'h2',
                  textColor: '#FFFFFF',
                  className: 'mx-auto max-w-[11ch] text-[2.7rem]! leading-[1.04]! tracking-0!',
                },
                {
                  id: 'paragraph_1',
                  kind: 'ATOMIC',
                  type: 'PARAGRAPH',
                  content: 'Cadastre seu e-mail para acompanhar vagas.',
                  textColor: '#F8FAFC',
                  className: 'mx-auto max-w-[34rem] text-[18px]! leading-8!',
                },
                {
                  id: 'input_1',
                  kind: 'ATOMIC',
                  type: 'INPUT',
                  inputKind: 'EMAIL',
                  placeholder: 'Email corporativo *',
                  className: 'min-h-[3.7rem]! rounded-full! border-0! bg-white! px-5! shadow-none!',
                },
                {
                  id: 'button_1',
                  kind: 'ATOMIC',
                  type: 'BUTTON',
                  content: 'Acessar oportunidades',
                  className:
                    'min-h-[3.9rem]! rounded-full! border-0! bg-[#2FD48F]! text-white! shadow-none!',
                },
              ],
            },
          ],
        },
      },
      status: 'PUBLICADO',
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects published coupon blocks without real coupon reference', () => {
    const parsed = createPopupSchema.safeParse({
      ...basePopupPayload,
      status: 'PUBLICADO',
      contentConfig: {
        ...basePopupPayload.contentConfig,
        builderTree: {
          id: 'root_1',
          kind: 'ROOT',
          structure: 'SINGLE',
          areas: [
            {
              id: 'area_1',
              kind: 'AREA',
              children: [
                {
                  id: 'coupon_1',
                  kind: 'ATOMIC',
                  type: 'COUPON',
                  couponScope: 'COURSES',
                  couponId: null,
                },
              ],
            },
          ],
        },
      },
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects published roulettes with inconsistent total chance', () => {
    const parsed = createPopupSchema.safeParse({
      ...basePopupPayload,
      status: 'PUBLICADO',
      contentConfig: {
        ...basePopupPayload.contentConfig,
        builderTree: {
          id: 'root_1',
          kind: 'ROOT',
          structure: 'SINGLE',
          areas: [
            {
              id: 'area_1',
              kind: 'AREA',
              children: [
                {
                  id: 'roulette_1',
                  kind: 'ATOMIC',
                  type: 'ROULETTE',
                  rouletteScope: 'COURSES',
                  rouletteNoPrizeMessage: 'Quase lá!',
                  rouletteItems: [
                    {
                      id: 'item_1',
                      label: 'Prêmio',
                      weight: 90,
                      couponId: '4c9e5fd5-a0eb-41a1-95ea-a3be11351fa1',
                    },
                    {
                      id: 'item_2',
                      label: 'Sem prêmio',
                      weight: 5,
                      isNoPrize: true,
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    });

    expect(parsed.success).toBe(false);
  });

  it('accepts contact submission with bounded payload values', () => {
    const parsed = createPopupContactSchema.safeParse({
      email: 'lead@example.com',
      origemPath: '/cursos',
      payload: {
        email: 'lead@example.com',
        aceite: true,
      },
    });

    expect(parsed.success).toBe(true);
  });
});
