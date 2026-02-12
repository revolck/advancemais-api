import { WebsiteScriptAplicacao, WebsiteStatus } from '@prisma/client';

import { WEBSITE_AGGREGATE_CACHE_TTL } from '@/modules/website/config';
import { advanceAjudaService } from '@/modules/website/services/advanceAjuda.service';
import { bannerService } from '@/modules/website/services/banner.service';
import { conexaoForteService } from '@/modules/website/services/conexaoForte.service';
import { consultoriaService } from '@/modules/website/services/consultoria.service';
import { depoimentosService } from '@/modules/website/services/depoimentos.service';
import { diferenciaisService } from '@/modules/website/services/diferenciais.service';
import { headerPagesService } from '@/modules/website/services/header-pages.service';
import { imagemLoginService } from '@/modules/website/services/imagem-login.service';
import { informacoesGeraisService } from '@/modules/website/services/informacoes-gerais.service';
import { logoEnterpriseService } from '@/modules/website/services/logoEnterprise.service';
import { planinhasService } from '@/modules/website/services/planinhas.service';
import { recrutamentoService } from '@/modules/website/services/recrutamento.service';
import { recrutamentoSelecaoService } from '@/modules/website/services/recrutamentoSelecao.service';
import { sistemaService } from '@/modules/website/services/sistema.service';
import { sliderService } from '@/modules/website/services/slider.service';
import { sobreService } from '@/modules/website/services/sobre.service';
import { sobreEmpresaService } from '@/modules/website/services/sobreEmpresa.service';
import { websiteScriptsService } from '@/modules/website/services/scripts.service';
import { teamService } from '@/modules/website/services/team.service';
import { treinamentoCompanyService } from '@/modules/website/services/treinamentoCompany.service';
import { treinamentosInCompanyService } from '@/modules/website/services/treinamentosInCompany.service';
import { generateCacheKey, getCachedOrFetch, invalidateCacheByPrefix } from '@/utils/cache';

const CACHE_PREFIX = 'website:site-data:list';

const SITE_DATA_SECTIONS = [
  'sobre',
  'slider',
  'banner',
  'logoEnterprises',
  'consultoria',
  'recrutamento',
  'sobreEmpresa',
  'team',
  'diferenciais',
  'planinhas',
  'advanceAjuda',
  'recrutamentoSelecao',
  'sistema',
  'treinamentoCompany',
  'conexaoForte',
  'treinamentosInCompany',
  'headerPages',
  'depoimentos',
  'informacoesGerais',
  'imagemLogin',
  'scripts',
] as const;

export type WebsiteSiteDataSection = (typeof SITE_DATA_SECTIONS)[number];

type WebsiteSiteDataPayload = {
  statusFilter: WebsiteStatus | 'ALL';
  sections: WebsiteSiteDataSection[];
  generatedAt: string;
  data: Partial<Record<WebsiteSiteDataSection, unknown>>;
};

type ListSiteDataInput = {
  sections: WebsiteSiteDataSection[];
  status?: WebsiteStatus;
};

const statusFilterableSections = new Set<WebsiteSiteDataSection>([
  'slider',
  'banner',
  'logoEnterprises',
]);

const getSectionData = async (
  section: WebsiteSiteDataSection,
  status?: WebsiteStatus,
): Promise<unknown> => {
  switch (section) {
    case 'sobre':
      return sobreService.list();
    case 'slider':
      return sliderService.list(status);
    case 'banner':
      return bannerService.list(status);
    case 'logoEnterprises':
      return logoEnterpriseService.list(status);
    case 'consultoria':
      return consultoriaService.list();
    case 'recrutamento':
      return recrutamentoService.list();
    case 'sobreEmpresa':
      return sobreEmpresaService.list();
    case 'team':
      return teamService.list(status);
    case 'diferenciais':
      return diferenciaisService.list();
    case 'planinhas':
      return planinhasService.list();
    case 'advanceAjuda':
      return advanceAjudaService.list();
    case 'recrutamentoSelecao':
      return recrutamentoSelecaoService.list();
    case 'sistema':
      return sistemaService.list();
    case 'treinamentoCompany':
      return treinamentoCompanyService.list();
    case 'conexaoForte':
      return conexaoForteService.list();
    case 'treinamentosInCompany':
      return treinamentosInCompanyService.list();
    case 'headerPages':
      return headerPagesService.list();
    case 'depoimentos':
      return depoimentosService.list(status);
    case 'informacoesGerais':
      return informacoesGeraisService.list();
    case 'imagemLogin':
      return imagemLoginService.list();
    case 'scripts':
      return websiteScriptsService.list({
        aplicacao: WebsiteScriptAplicacao.WEBSITE,
        ...(status ? { status } : {}),
      });
    default:
      return [];
  }
};

export const isWebsiteSiteDataSection = (value: string): value is WebsiteSiteDataSection =>
  SITE_DATA_SECTIONS.includes(value as WebsiteSiteDataSection);

export const allWebsiteSiteDataSections: readonly WebsiteSiteDataSection[] = SITE_DATA_SECTIONS;

export const websiteSiteDataService = {
  list: async ({ sections, status }: ListSiteDataInput): Promise<WebsiteSiteDataPayload> => {
    const cacheKey = generateCacheKey(
      CACHE_PREFIX,
      {
        status: status ?? 'ALL',
        sections: sections.join(','),
      },
      { excludeKeys: [] },
    );

    return getCachedOrFetch(
      cacheKey,
      async () => {
        const entries = await Promise.all(
          sections.map(
            async (section) => [section, await getSectionData(section, status)] as const,
          ),
        );

        const data: Partial<Record<WebsiteSiteDataSection, unknown>> = Object.fromEntries(entries);
        return {
          statusFilter: status ?? 'ALL',
          sections,
          generatedAt: new Date().toISOString(),
          data,
        };
      },
      WEBSITE_AGGREGATE_CACHE_TTL,
    );
  },

  invalidate: async () => {
    await invalidateCacheByPrefix(CACHE_PREFIX);
  },

  statusFilterableSections,
};
