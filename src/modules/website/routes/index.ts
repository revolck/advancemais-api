import { Router } from 'express';
import { publicCache } from '../../../middlewares/cache-control';
import { sobreRoutes } from './sobre';
import { sliderRoutes } from './slider';
import { bannerRoutes } from './banner';
import { logoEnterpriseRoutes } from './logo-enterprises';
import { consultoriaRoutes } from './consultoria';
import { recrutamentoRoutes } from './recrutamento';
import { sobreEmpresaRoutes } from './sobre-empresa';
import { teamRoutes } from './team';
import { diferenciaisRoutes } from './diferenciais';
import { planinhasRoutes } from './planinhas';
import { advanceAjudaRoutes } from './advance-ajuda';
import { recrutamentoSelecaoRoutes } from './recrutamento-selecao';
import { sistemaRoutes } from './sistema';
import { treinamentoCompanyRoutes } from './treinamento-company';
import { conexaoForteRoutes } from './conexao-forte';
import { treinamentosInCompanyRoutes } from './treinamentos-in-company';
import { headerPagesRoutes } from './header-pages';
import { depoimentosRoutes } from './depoimentos';
import { informacoesGeraisRoutes } from './informacoes-gerais';
import { imagemLoginRoutes } from './imagem-login';
import { websiteScriptsRoutes } from './scripts';
import { websiteSiteDataRoutes } from './site-data';
import {
  invalidateWebsiteGetResponseCache,
  websiteGetResponseCache,
} from '@/modules/website/middlewares/response-cache';
import { websiteSiteDataService } from '@/modules/website/services/site-data.service';

const router = Router();
router.use(websiteGetResponseCache);

/**
 * @openapi
 * /api/v1/website:
 *   get:
 *     summary: Informações do módulo Website
 *     tags: [Website]
 *     responses:
 *       200:
 *         description: Detalhes do módulo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteModuleInfo'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/website"
 */
router.get('/', publicCache, (req, res) => {
  res.json({
    message: 'Website Module API',
    version: 'v1',
    timestamp: new Date().toISOString(),
    endpoints: {
      sobre: '/sobre',
      slider: '/slider',
      banner: '/banner',
      logoEnterprises: '/logo-enterprises',
      consultoria: '/consultoria',
      recrutamento: '/recrutamento',
      sobreEmpresa: '/sobre-empresa',
      team: '/team',
      diferenciais: '/diferenciais',
      planinhas: '/planinhas',
      advanceAjuda: '/advance-ajuda',
      recrutamentoSelecao: '/recrutamento-selecao',
      sistema: '/sistema',
      treinamentoCompany: '/treinamento-company',
      conexaoForte: '/conexao-forte',
      treinamentosInCompany: '/treinamentos-in-company',
      headerPages: '/header-pages',
      depoimentos: '/depoimentos',
      informacoesGerais: '/informacoes-gerais',
      imagemLogin: '/imagem-login',
      scripts: '/scripts',
      siteData: '/site-data',
    },
    status: 'operational',
  });
});

router.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 400) {
      void Promise.all([websiteSiteDataService.invalidate(), invalidateWebsiteGetResponseCache()]);
    }
  });

  return next();
});

router.use('/sobre', sobreRoutes);
router.use('/slider', sliderRoutes);
router.use('/banner', bannerRoutes);
router.use('/logo-enterprises', logoEnterpriseRoutes);
router.use('/consultoria', consultoriaRoutes);
router.use('/recrutamento', recrutamentoRoutes);
router.use('/sobre-empresa', sobreEmpresaRoutes);
router.use('/team', teamRoutes);
router.use('/diferenciais', diferenciaisRoutes);
router.use('/planinhas', planinhasRoutes);
router.use('/advance-ajuda', advanceAjudaRoutes);
router.use('/recrutamento-selecao', recrutamentoSelecaoRoutes);
router.use('/sistema', sistemaRoutes);
router.use('/treinamento-company', treinamentoCompanyRoutes);
router.use('/conexao-forte', conexaoForteRoutes);
router.use('/treinamentos-in-company', treinamentosInCompanyRoutes);
router.use('/header-pages', headerPagesRoutes);
router.use('/depoimentos', depoimentosRoutes);
router.use('/informacoes-gerais', informacoesGeraisRoutes);
router.use('/imagem-login', imagemLoginRoutes);
router.use('/scripts', websiteScriptsRoutes);
router.use('/site-data', websiteSiteDataRoutes);

export { router as websiteRoutes };
