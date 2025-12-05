import { Router, type Request } from 'express';

import redis from '@/config/redis';
import { publicCache } from '@/middlewares/cache-control';
import { docsRoutes } from '@/modules/docs';
import { getBloqueiosWatcherMetrics } from '@/modules/usuarios/bloqueios/cron/bloqueio-watcher';
import { brevoRoutes } from '@/modules/brevo/routes';
import { mercadopagoRoutes } from '@/modules/mercadopago';
import { EmailVerificationController } from '@/modules/brevo/controllers/email-verification-controller';
import { usuarioRoutes } from '@/modules/usuarios';
import { websiteRoutes } from '@/modules/website';
import { empresasRoutes } from '@/modules/empresas';
import { candidatosRoutes } from '@/modules/candidatos';
import { cursosRoutes } from '@/modules/cursos';
import { cuponsRoutes } from '@/modules/cupons';
import { auditoriaRoutes } from '@/modules/auditoria';
import { statusProcessoRoutes } from '@/modules/status-processo/routes';
import dashboardRoutes from '@/modules/dashboard/routes';
import { vagasSolicitacoesRoutes } from '@/modules/empresas/vagas-solicitacoes/routes';
import { requerimentosRoutes } from '@/modules/requerimentos/routes';
import { notificacoesRoutes } from '@/modules/notificacoes/routes';
import { setCacheHeaders, DEFAULT_TTL } from '@/utils/cache';
import { logger } from '@/utils/logger';
import { checkDatabaseHealth } from '@/utils/database-health';

/**
 * Router principal da aplicação
 */
const router = Router();
const UsuariosVerificacaoEmailController = new EmailVerificationController();
const routesLogger = logger.child({ module: 'Router' });

const parseEtags = (header: Request['headers']['if-none-match']) => {
  if (!header) return [] as string[];
  const values = Array.isArray(header) ? header : header.split(',');
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.replace(/^W\//, '').replace(/"/g, ''));
};

const normalizeTimestamp = (ttl: number) => {
  if (ttl <= 0) {
    return new Date().toISOString();
  }
  const bucket = Math.floor(Date.now() / (ttl * 1000)) * ttl * 1000;
  return new Date(bucket).toISOString();
};

/**
 * @openapi
 * /:
 *   get:
 *     summary: Rota raiz da API
 *     tags: [Default]
 *     responses:
 *       200:
 *         description: Informações básicas e endpoints disponíveis
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiRootInfo'
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
 *           curl -X GET "http://localhost:3000/"
 */
router.get('/', publicCache, (req, res) => {
  const ttl = Number(process.env.WEBSITE_CACHE_TTL || DEFAULT_TTL);
  const timestamp = normalizeTimestamp(ttl);
  const data = {
    message: 'Advance+ API',
    version: 'v3.0.3',
    timestamp,
    environment: process.env.NODE_ENV,
    status: 'operational',
    express_version: '4.x',
    endpoints: {
      usuarios: '/api/v1/usuarios',
      brevo: '/api/v1/brevo',
      website: '/api/v1/website',
      empresas: '/api/v1/empresas',
      candidatos: '/api/v1/candidatos',
      cursos: '/api/v1/cursos',
      cursosTurmasAulas: '/api/v1/cursos/{cursoId}/turmas/{turmaId}/aulas',
      candidatosAreasInteresse: '/api/v1/candidatos/areas-interesse',
      cuponsDesconto: '/api/v1/cupons',
      planosEmpresariais: '/api/v1/empresas/planos-empresariais',
      clientesEmpresas: '/api/v1/empresas/clientes',
      vagasEmpresariais: '/api/v1/empresas/vagas',
      vagasCategoriasEmpresariais: '/api/v1/empresas/vagas/categorias',
      mercadopagoAssinaturas: '/api/v1/mercadopago/assinaturas',
      mercadopagoLogs: '/api/v1/mercadopago/logs',
      auditoria: '/api/v1/auditoria',
      statusProcesso: '/api/v1/status-processo',
      health: '/health',
    },
  };

  const etag = setCacheHeaders(res, data, ttl);
  if (parseEtags(req.headers['if-none-match']).includes(etag)) {
    return res.status(304).end();
  }

  if (req.headers['accept']?.includes('application/json')) {
    return res.json(data);
  }

  const baseUrl = `${req.protocol}://${req.get('host')}`;

  const endpointCategories = {
    'Autenticação & Usuários': [
      {
        icon: '👥',
        name: 'Usuários',
        path: data.endpoints.usuarios,
        description: 'Gestão de usuários, autenticação e perfis',
      },
      {
        icon: '📧',
        name: 'E-mail (Brevo)',
        path: data.endpoints.brevo,
        description: 'Serviço de envio de e-mails e verificação',
      },
    ],
    'Conteúdo do Website': [
      {
        icon: '🌐',
        name: 'Website',
        path: data.endpoints.website,
        description: 'Conteúdo e configurações do site público',
      },
    ],
    'Empresas & Vagas': [
      {
        icon: '🏢',
        name: 'Empresas',
        path: data.endpoints.usuarios,
        description: 'Gestão de empresas parceiras',
      },
      {
        icon: '💼',
        name: 'Vagas Empresariais',
        path: data.endpoints.vagasEmpresariais,
        description: 'Vagas de emprego publicadas',
      },
      {
        icon: '🗂️',
        name: 'Categorias de Vagas',
        path: data.endpoints.vagasCategoriasEmpresariais,
        description: 'Categorização de vagas',
      },
      {
        icon: '📦',
        name: 'Planos Empresariais',
        path: data.endpoints.planosEmpresariais,
        description: 'Planos e assinaturas corporativas',
      },
      {
        icon: '🧾',
        name: 'Clientes (Planos)',
        path: data.endpoints.clientesEmpresas,
        description: 'Gestão de clientes empresariais',
      },
    ],
    Candidatos: [
      {
        icon: '🎯',
        name: 'Candidatos',
        path: data.endpoints.candidatos,
        description: 'Perfis e dados dos candidatos',
      },
      {
        icon: '🏷️',
        name: 'Áreas de Interesse',
        path: data.endpoints.candidatosAreasInteresse,
        description: 'Interesses profissionais dos candidatos',
      },
    ],
    'Cursos & Educação': [
      {
        icon: '📚',
        name: 'Cursos',
        path: data.endpoints.cursos,
        description: 'Catálogo de cursos e treinamentos',
      },
      {
        icon: '🎓',
        name: 'Turmas e Aulas',
        path: data.endpoints.cursosTurmasAulas,
        description: 'Gestão de turmas e conteúdo das aulas',
      },
    ],
    'Pagamentos & Cupons': [
      {
        icon: '💳',
        name: 'Assinaturas (MercadoPago)',
        path: data.endpoints.mercadopagoAssinaturas,
        description: 'Pagamentos e assinaturas via MercadoPago',
      },
      {
        icon: '📊',
        name: 'Logs de Pagamento',
        path: data.endpoints.mercadopagoLogs,
        description: 'Histórico de transações',
      },
      {
        icon: '🎟️',
        name: 'Cupons de Desconto',
        path: data.endpoints.cuponsDesconto,
        description: 'Cupons promocionais e descontos',
      },
    ],
    'Sistema & Administração': [
      {
        icon: '🔍',
        name: 'Auditoria',
        path: data.endpoints.auditoria,
        description: 'Logs de auditoria e rastreamento',
      },
      {
        icon: '📈',
        name: 'Status de Processo',
        path: data.endpoints.statusProcesso,
        description: 'Status e fluxos de processos',
      },
      {
        icon: '💚',
        name: 'Health Check',
        path: data.endpoints.health,
        description: 'Status de saúde da API',
      },
    ],
  };

  const html = `<!DOCTYPE html>
  <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${data.message} - ${data.version}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        
        @keyframes glow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.05); opacity: 1; }
        }
        
        body { 
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background: #0a0a0f;
          background-image: 
            radial-gradient(ellipse at 20% 10%, rgba(0, 37, 125, 0.2) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 90%, rgba(220, 38, 38, 0.15) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, rgba(0, 37, 125, 0.1) 0%, transparent 80%);
          color: #ffffff;
          min-height: 100vh;
          padding: 0;
          position: relative;
          overflow-x: hidden;
        }
        
        body::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: 
            linear-gradient(rgba(0, 37, 125, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 37, 125, 0.03) 1px, transparent 1px);
          background-size: 50px 50px;
          pointer-events: none;
          z-index: 0;
        }
        
        .hero-section {
          padding: 5rem 2rem 8rem;
          position: relative;
          overflow: hidden;
        }
        
        .hero-section::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle at center, rgba(0, 37, 125, 0.15) 0%, transparent 70%);
          animation: float 20s ease-in-out infinite;
          pointer-events: none;
        }
        
        .hero-section::after {
          content: '';
          position: absolute;
          top: 50%;
          right: -10%;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(220, 38, 38, 0.1) 0%, transparent 70%);
          border-radius: 50%;
          filter: blur(80px);
          animation: pulse 8s ease-in-out infinite;
          pointer-events: none;
        }
        
        .container {
          max-width: 1280px;
          margin: 0 auto;
          position: relative;
          z-index: 1;
        }
        
        .header {
          text-align: center;
          position: relative;
          animation: fadeIn 1s ease-out;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .header h1 {
          font-size: 4rem;
          font-weight: 800;
          background: linear-gradient(135deg, #ffffff 0%, #00d4ff 50%, #dc2626 100%);
          background-size: 200% 200%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 1.5rem;
          letter-spacing: -0.04em;
          line-height: 1;
          animation: gradientShift 8s ease infinite;
          text-shadow: 0 0 80px rgba(0, 212, 255, 0.3);
        }
        
        .header p.tagline {
          font-size: 1.25rem;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 3rem;
          font-weight: 300;
          max-width: 700px;
          margin-left: auto;
          margin-right: auto;
          line-height: 1.6;
        }
        
        .badge-container {
          display: flex;
          gap: 0.75rem;
          justify-content: center;
          margin-bottom: 2rem;
        }
        
        .badge {
          display: inline-flex;
          align-items: center;
          padding: 0.5rem 1rem;
          background: rgba(0, 212, 255, 0.1);
          border: 1px solid rgba(0, 212, 255, 0.3);
          border-radius: 50px;
          font-size: 0.85rem;
          font-weight: 600;
          color: #00d4ff;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .badge.success {
          background: rgba(0, 255, 136, 0.1);
          border-color: rgba(0, 255, 136, 0.3);
          color: #00ff88;
        }
        
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          margin-top: 4rem;
          max-width: 1000px;
          margin-left: auto;
          margin-right: auto;
        }
        
        .stat-card {
          background: rgba(15, 15, 25, 0.5);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(0, 212, 255, 0.15);
          border-radius: 16px;
          padding: 1.5rem;
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        
        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(0, 212, 255, 0.2), rgba(0, 37, 125, 0.2));
          display: flex;
          align-items: center;
          justify-content: center;
          color: #00d4ff;
          flex-shrink: 0;
        }
        
        .stat-content {
          flex: 1;
        }
        
        .stat-label {
          font-size: 0.85rem;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 0.25rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 500;
        }
        
        .stat-value {
          font-size: 1.5rem;
          font-weight: 800;
          color: #ffffff;
          line-height: 1;
        }
        
        .content-section {
          padding: 6rem 2rem;
          background: transparent;
          position: relative;
        }
        
        .section-header {
          text-align: center;
          margin-bottom: 4rem;
        }
        
        .section-title {
          font-size: 2.5rem;
          font-weight: 800;
          color: #ffffff;
          margin-bottom: 1rem;
          letter-spacing: -0.02em;
        }
        
        .section-description {
          font-size: 1.1rem;
          color: rgba(255, 255, 255, 0.6);
          max-width: 600px;
          margin: 0 auto;
        }
        
        
        .docs-links {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
          margin-top: 3rem;
        }
        
        .docs-link {
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem 2rem;
          background: rgba(15, 15, 25, 0.6);
          backdrop-filter: blur(20px);
          color: #ffffff;
          text-decoration: none;
          border-radius: 50px;
          font-weight: 600;
          font-size: 1rem;
          transition: all 0.3s ease;
          border: 1px solid rgba(0, 212, 255, 0.2);
          position: relative;
        }
        
        .docs-link svg {
          /* Sem animação no ícone */
        }
        
        .docs-link:hover {
          transform: translateY(-2px);
          border-color: rgba(0, 212, 255, 0.5);
        }
        
        .docs-link.primary {
          background: linear-gradient(135deg, #00257d, #003ba8);
          border-color: rgba(0, 37, 125, 0.5);
        }
        
        .docs-link.primary:hover {
          background: linear-gradient(135deg, #003399, #004dd9);
          box-shadow: 0 4px 20px rgba(0, 37, 125, 0.5);
        }
        
        .docs-link.secondary {
          background: rgba(15, 15, 25, 0.8);
          border-color: rgba(0, 212, 255, 0.25);
        }
        
        .docs-link.secondary:hover {
          background: rgba(0, 37, 125, 0.25);
          border-color: rgba(0, 212, 255, 0.4);
          box-shadow: 0 4px 20px rgba(0, 212, 255, 0.15);
        }
        
        .docs-link:not(.primary):not(.secondary):hover {
          background: rgba(0, 212, 255, 0.08);
          border-color: rgba(0, 212, 255, 0.4);
          box-shadow: 0 4px 20px rgba(0, 212, 255, 0.1);
        }
        
        .category {
          margin-bottom: 5rem;
          position: relative;
        }
        
        .category h2 {
          font-size: 1.75rem;
          margin-bottom: 2.5rem;
          color: #ffffff;
          font-weight: 700;
          letter-spacing: -0.01em;
          padding-bottom: 1rem;
          border-bottom: 2px solid transparent;
          border-image: linear-gradient(90deg, #00d4ff, #00257d, transparent) 1;
          display: inline-block;
          position: relative;
        }
        
        .category h2::before {
          content: '';
          position: absolute;
          left: 0;
          bottom: -2px;
          width: 0;
          height: 2px;
          background: linear-gradient(90deg, #00d4ff, #dc2626);
          transition: width 0.6s;
        }
        
        .category:hover h2::before {
          width: 100%;
        }
        
        .endpoints-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 2rem;
        }
        
        .endpoint-card {
          background: rgba(15, 15, 25, 0.5);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(0, 212, 255, 0.15);
          border-radius: 20px;
          padding: 2rem;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          cursor: pointer;
          position: relative;
          overflow: hidden;
        }
        
        .endpoint-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 3px;
          height: 0;
          background: linear-gradient(180deg, #00d4ff, #00257d, #dc2626);
          border-radius: 20px 0 0 20px;
          transition: height 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 0 20px rgba(0, 212, 255, 0.5);
        }
        
        .endpoint-card::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(0, 37, 125, 0.15), transparent);
          transform: translate(-50%, -50%);
          transition: width 0.6s, height 0.6s;
        }
        
        .endpoint-card:hover::after {
          width: 500px;
          height: 500px;
        }
        
        .endpoint-card:hover {
          background: rgba(0, 37, 125, 0.2);
          border-color: rgba(0, 212, 255, 0.4);
          transform: translateY(-8px);
          box-shadow: 0 20px 60px rgba(0, 37, 125, 0.4), 0 0 40px rgba(0, 212, 255, 0.2);
        }
        
        .endpoint-card:hover::before {
          height: 100%;
        }
        
        .endpoint-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
          position: relative;
          z-index: 1;
        }
        
        .endpoint-icon {
          font-size: 2rem;
          filter: drop-shadow(0 0 10px rgba(0, 212, 255, 0.3));
        }
        
        .endpoint-name {
          font-size: 1.2rem;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -0.01em;
        }
        
        .endpoint-description {
          color: rgba(255, 255, 255, 0.6);
          font-size: 0.9rem;
          margin-bottom: 1.25rem;
          line-height: 1.6;
          position: relative;
          z-index: 1;
        }
        
        .endpoint-path {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: rgba(0, 0, 0, 0.4);
          padding: 1rem;
          border-radius: 12px;
          border: 1px solid rgba(0, 212, 255, 0.2);
          font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
          font-size: 0.85rem;
          color: #00d4ff;
          font-weight: 500;
          word-break: break-all;
          position: relative;
          z-index: 1;
          box-shadow: 0 0 20px rgba(0, 212, 255, 0.1);
        }
        
        .copy-btn {
          background: linear-gradient(135deg, #00257d, #003ba8);
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.75rem;
          font-weight: 600;
          transition: all 0.3s;
          white-space: nowrap;
          flex-shrink: 0;
          border: 1px solid rgba(0, 212, 255, 0.3);
          box-shadow: 0 0 15px rgba(0, 37, 125, 0.3);
        }
        
        .copy-btn:hover {
          background: linear-gradient(135deg, #003ba8, #00257d);
          transform: scale(1.05);
          box-shadow: 0 0 25px rgba(0, 212, 255, 0.5);
        }
        
        .copy-btn.copied {
          background: linear-gradient(135deg, #00ff88, #00cc6a);
          box-shadow: 0 0 25px rgba(0, 255, 136, 0.5);
        }
        
        .endpoint-link {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 1rem;
          color: #00d4ff;
          text-decoration: none;
          font-weight: 600;
          font-size: 0.9rem;
          transition: all 0.3s;
          position: relative;
          z-index: 1;
        }
        
        .endpoint-link:hover {
          gap: 0.85rem;
          color: #ffffff;
          text-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
        }
        
        footer {
          text-align: center;
          padding: 5rem 2rem 3rem;
          background: rgba(5, 5, 10, 0.8);
          backdrop-filter: blur(20px);
          border-top: 1px solid rgba(0, 212, 255, 0.1);
          position: relative;
        }
        
        footer::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.5), transparent);
        }
        
        footer p {
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 0.75rem;
        }
        
        footer p:first-child {
          font-weight: 700;
          font-size: 1.25rem;
          color: #ffffff;
          margin-bottom: 1rem;
          text-shadow: 0 0 20px rgba(0, 212, 255, 0.3);
        }
        
        footer a {
          color: #00d4ff;
          text-decoration: none;
          font-weight: 600;
          transition: all 0.3s;
          position: relative;
        }
        
        footer a::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          width: 0;
          height: 2px;
          background: linear-gradient(90deg, #00d4ff, #dc2626);
          transition: width 0.3s;
        }
        
        footer a:hover {
          color: #ffffff;
          text-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
        }
        
        footer a:hover::after {
          width: 100%;
        }
        
        @media (max-width: 768px) {
          .hero-section { padding: 4rem 1.5rem 6rem; }
          .header h1 { font-size: 2.5rem; }
          .header p.tagline { font-size: 1.1rem; }
          .content-section { padding: 4rem 1.5rem; }
          .section-title { font-size: 2rem; }
          .stats-grid { grid-template-columns: 1fr; gap: 1rem; }
          .stat-card { padding: 1.25rem; }
          .endpoints-grid { grid-template-columns: 1fr; }
          .docs-links { flex-direction: column; align-items: stretch; }
          .docs-link { justify-content: center; }
          .badge-container { flex-wrap: wrap; }
        }
      </style>
    </head>
    <body>
      <div class="hero-section">
        <div class="container">
          <div class="header">
            <div class="badge-container">
              <span class="badge">${data.version}</span>
              <span class="badge success">${data.status.toUpperCase()}</span>
            </div>
      <h1>${data.message}</h1>
            <p class="tagline">Plataforma completa para gestão empresarial, cursos e recrutamento<br/>Conectando talentos e empresas há mais de 20 anos</p>
            
            <div class="docs-links">
              <a href="/docs" class="docs-link primary">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
                Documentação Swagger
              </a>
              <a href="/redoc" class="docs-link secondary">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                ReDoc
              </a>
              <a href="${data.endpoints.health}" class="docs-link">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                </svg>
                Health Check
              </a>
            </div>
            
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                </div>
                <div class="stat-content">
                  <div class="stat-label">Uptime</div>
                  <div class="stat-value">99.9%</div>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                  </svg>
                </div>
                <div class="stat-content">
                  <div class="stat-label">Endpoints</div>
                  <div class="stat-value">${Object.keys(data.endpoints).length}+</div>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                  </svg>
                </div>
                <div class="stat-content">
                  <div class="stat-label">Runtime</div>
                  <div class="stat-value">${data.express_version}</div>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
                <div class="stat-content">
                  <div class="stat-label">Ambiente</div>
                  <div class="stat-value">${data.environment}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="content-section">
        <div class="container">
          <div class="section-header">
            <h2 class="section-title">Recursos da Plataforma</h2>
            <p class="section-description">API completa para gestão de cursos, vagas de emprego, candidatos e empresas parceiras</p>
          </div>
        
        ${Object.entries(endpointCategories)
          .map(
            ([category, endpoints]) => `
          <div class="category">
            <h2>${category}</h2>
            <div class="endpoints-grid">
              ${endpoints
                .map(
                  (endpoint) => `
                <div class="endpoint-card" onclick="window.location.href='${baseUrl}${endpoint.path}'">
                  <div class="endpoint-header">
                    <span class="endpoint-icon">${endpoint.icon}</span>
                    <span class="endpoint-name">${endpoint.name}</span>
                  </div>
                  <p class="endpoint-description">${endpoint.description}</p>
                  <div class="endpoint-path">
                    <span style="flex: 1;">${endpoint.path}</span>
                    <button class="copy-btn" onclick="event.stopPropagation(); copyToClipboard('${baseUrl}${endpoint.path}', this)">
                      Copiar
                    </button>
                  </div>
                  <a href="${baseUrl}${endpoint.path}" class="endpoint-link" onclick="event.stopPropagation()">
                    Acessar endpoint →
                  </a>
                </div>
              `,
                )
                .join('')}
            </div>
          </div>
        `,
          )
          .join('')}
        </div>
      </div>
      
      <footer>
        <p>Advance+ Plataforma de API</p>
        <p>Uma plataforma <a href="https://advancemais.com" target="_blank">Advance+</a> desenvolvida por <a href="https://revolck.com.br" target="_blank">REVOLCK</a></p>
        <p style="font-size: 0.85rem; margin-top: 1rem;">
          ${data.timestamp} • ${data.version} • Express ${data.express_version}
        </p>
      </footer>
      
      <script>
        function copyToClipboard(text, button) {
          navigator.clipboard.writeText(text).then(() => {
            const originalText = button.textContent;
            button.textContent = '✓ Copiado!';
            button.classList.add('copied');
            setTimeout(() => {
              button.textContent = originalText;
              button.classList.remove('copied');
            }, 2000);
          }).catch(err => {
            console.error('Erro ao copiar:', err);
            button.textContent = '✗ Erro';
            setTimeout(() => {
              button.textContent = 'Copiar';
            }, 2000);
          });
        }
      </script>
    </body>
  </html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check global
 *     tags: [Default]
 *     responses:
 *       200:
 *         description: Status do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GlobalHealthStatus'
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
 *           curl -X GET "http://localhost:3000/health"
 */
router.get('/health', async (req, res) => {
  // 🔍 Verificar saúde do banco de dados
  const databaseHealthy = await checkDatabaseHealth();
  const databaseStatus = databaseHealthy ? '✅ connected' : '⚠️ reconnecting';

  let redisStatus = '⚠️ not configured';
  if (process.env.REDIS_URL) {
    try {
      await redis.ping();
      redisStatus = '✅ active';
    } catch {
      redisStatus = '❌ inactive';
    }
  }

  const ttl = Number(process.env.WEBSITE_CACHE_TTL || DEFAULT_TTL);
  const uptimeRaw = Math.floor(process.uptime());
  const uptime = ttl > 0 ? Math.floor(uptimeRaw / ttl) * ttl : uptimeRaw;

  // 🎯 Status geral: OK se banco estiver saudável OU se ainda estiver tentando conectar
  const overallStatus = databaseHealthy ? 'OK' : 'DEGRADED';

  const payload = {
    status: overallStatus,
    timestamp: normalizeTimestamp(ttl),
    version: 'v3.0.3',
    uptime,
    environment: process.env.NODE_ENV,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
    },
    database: databaseStatus,
    modules: {
      usuarios: '✅ active',
      brevo: '✅ active',
      website: '✅ active',
      empresas: '✅ active',
      candidatos: '✅ active',
      cupons: '✅ active',
      mercadopago: '✅ active',
      auditoria: '✅ active',
      redis: redisStatus,
    },
    metrics: {
      bloqueios: getBloqueiosWatcherMetrics(),
    },
  };

  // 🚦 Retornar 200 mesmo se banco estiver reconectando (evita alertas falsos)
  const statusCode = overallStatus === 'OK' ? 200 : 503;

  const etag = setCacheHeaders(res, payload, ttl);
  if (parseEtags(req.headers['if-none-match']).includes(etag)) {
    return res.status(304).end();
  }

  res.status(statusCode).json(payload);
});

// Rota pública para verificação de email
router.get('/verificar-email', UsuariosVerificacaoEmailController.verifyEmail);

// =============================================
// REGISTRO DE MÓDULOS - COM ERROR HANDLING
// =============================================

/**
 * Módulo de usuários - COM VALIDAÇÃO
 * /api/v1/usuarios/*
 */
if (usuarioRoutes) {
  try {
    router.use('/api/v1/usuarios', usuarioRoutes);
    routesLogger.info(
      { feature: 'UsuariosModule' },
      '✅ Módulo de usuários registrado com sucesso',
    );
  } catch (error) {
    routesLogger.error({ feature: 'UsuariosModule', err: error }, '❌ ERRO - Módulo de usuários');
  }
} else {
  routesLogger.error({ feature: 'UsuariosModule' }, '❌ usuarioRoutes não está definido');
}

/**
 * Módulo Brevo - COM VALIDAÇÃO
 * /api/v1/brevo/*
 */
if (brevoRoutes) {
  try {
    router.use('/api/v1/brevo', brevoRoutes);
    routesLogger.info({ feature: 'BrevoModule' }, '✅ Módulo Brevo registrado com sucesso');
  } catch (error) {
    routesLogger.error({ feature: 'BrevoModule', err: error }, '❌ ERRO - Módulo Brevo');
  }
} else {
  routesLogger.error({ feature: 'BrevoModule' }, '❌ brevoRoutes não está definido');
}

/**
 * Módulo Mercado Pago - COM VALIDAÇÃO
 * /api/v1/mercadopago/*
 */
if (mercadopagoRoutes) {
  try {
    router.use('/api/v1/mercadopago', mercadopagoRoutes);
    routesLogger.info(
      { feature: 'MercadoPagoModule' },
      '✅ Módulo Mercado Pago registrado com sucesso',
    );
  } catch (error) {
    routesLogger.error(
      { feature: 'MercadoPagoModule', err: error },
      '❌ ERRO - Módulo Mercado Pago',
    );
  }
} else {
  routesLogger.error({ feature: 'MercadoPagoModule' }, '❌ mercadopagoRoutes não está definido');
}

/**
 * Módulo Website - COM VALIDAÇÃO
 * /api/v1/website/*
 */
if (websiteRoutes) {
  try {
    router.use('/api/v1/website', websiteRoutes);
    routesLogger.info({ feature: 'WebsiteModule' }, '✅ Módulo Website registrado com sucesso');
  } catch (error) {
    routesLogger.error({ feature: 'WebsiteModule', err: error }, '❌ ERRO - Módulo Website');
  }
} else {
  routesLogger.error({ feature: 'WebsiteModule' }, '❌ websiteRoutes não está definido');
}

/**
 * Módulo Empresas - COM VALIDAÇÃO
 * /api/v1/empresas/*
 */
if (empresasRoutes) {
  try {
    router.use('/api/v1/empresas', empresasRoutes);
    routesLogger.info({ feature: 'EmpresasModule' }, '✅ Módulo Empresas registrado com sucesso');
  } catch (error) {
    routesLogger.error({ feature: 'EmpresasModule', err: error }, '❌ ERRO - Módulo Empresas');
  }
} else {
  routesLogger.error({ feature: 'EmpresasModule' }, '❌ empresasRoutes não está definido');
}

/**
 * Módulo Candidatos - COM VALIDAÇÃO
 * /api/v1/candidatos/*
 */
if (candidatosRoutes) {
  try {
    router.use('/api/v1/candidatos', candidatosRoutes);
    routesLogger.info(
      { feature: 'CandidatosModule' },
      '✅ Módulo Candidatos registrado com sucesso',
    );
  } catch (error) {
    routesLogger.error({ feature: 'CandidatosModule', err: error }, '❌ ERRO - Módulo Candidatos');
  }
} else {
  routesLogger.error({ feature: 'CandidatosModule' }, '❌ candidatosRoutes não está definido');
}

/**
 * Módulo Cursos - COM VALIDAÇÃO
 * /api/v1/cursos/*
 */
if (cursosRoutes) {
  try {
    router.use('/api/v1/cursos', cursosRoutes);
    routesLogger.info({ feature: 'CursosModule' }, '✅ Módulo Cursos registrado com sucesso');
  } catch (error) {
    routesLogger.error({ feature: 'CursosModule', err: error }, '❌ ERRO - Módulo Cursos');
  }
} else {
  routesLogger.error({ feature: 'CursosModule' }, '❌ cursosRoutes não está definido');
}

/**
 * Módulo Cupons de Desconto - COM VALIDAÇÃO
 * /api/v1/cupons/*
 */
if (cuponsRoutes) {
  try {
    router.use('/api/v1/cupons', cuponsRoutes);
    routesLogger.info({ feature: 'CuponsModule' }, '✅ Módulo Cupons registrado com sucesso');
  } catch (error) {
    routesLogger.error({ feature: 'CuponsModule', err: error }, '❌ ERRO - Módulo Cupons');
  }
} else {
  routesLogger.error({ feature: 'CuponsModule' }, '❌ cuponsRoutes não está definido');
}

/**
 * Módulo de Auditoria - COM VALIDAÇÃO
 * /api/v1/auditoria/*
 */
if (auditoriaRoutes) {
  try {
    router.use('/api/v1/auditoria', auditoriaRoutes);
    routesLogger.info({ feature: 'AuditoriaModule' }, '✅ Módulo Auditoria registrado com sucesso');
  } catch (error) {
    routesLogger.error({ feature: 'AuditoriaModule', err: error }, '❌ ERRO - Módulo Auditoria');
  }
} else {
  routesLogger.error({ feature: 'AuditoriaModule' }, '❌ auditoriaRoutes não está definido');
}

/**
 * Módulo de Status Processo - COM VALIDAÇÃO
 * /api/v1/status-processo/*
 */
if (statusProcessoRoutes) {
  try {
    router.use('/api/v1/status-processo', statusProcessoRoutes);
    routesLogger.info(
      { feature: 'StatusProcessoModule' },
      '✅ Módulo Status Processo registrado com sucesso',
    );
  } catch (error) {
    routesLogger.error(
      { feature: 'StatusProcessoModule', err: error },
      '❌ ERRO - Módulo Status Processo',
    );
  }
} else {
  routesLogger.error(
    { feature: 'StatusProcessoModule' },
    '❌ statusProcessoRoutes não está definido',
  );
}

/**
 * Módulo de Dashboard - COM VALIDAÇÃO
 * /api/v1/dashboard
 */
if (dashboardRoutes) {
  try {
    router.use('/api/v1/dashboard', dashboardRoutes);
    routesLogger.info({ feature: 'DashboardModule' }, '✅ Módulo Dashboard registrado com sucesso');
  } catch (error) {
    routesLogger.error(
      { feature: 'DashboardModule', err: error },
      '❌ ERRO - Módulo Dashboard',
    );
  }
} else {
  routesLogger.error(
    { feature: 'DashboardModule' },
    '❌ dashboardRoutes não está definido',
  );
}

/**
 * Módulo de Solicitações de Vagas - COM VALIDAÇÃO
 * /api/v1/vagas/solicitacoes (alias para /api/v1/empresas/vagas/solicitacoes)
 */
if (vagasSolicitacoesRoutes) {
  try {
    router.use('/api/v1/vagas/solicitacoes', vagasSolicitacoesRoutes);
    routesLogger.info(
      { feature: 'VagasSolicitacoesModule' },
      '✅ Módulo Solicitações de Vagas registrado com sucesso',
    );
  } catch (error) {
    routesLogger.error(
      { feature: 'VagasSolicitacoesModule', err: error },
      '❌ ERRO - Módulo Solicitações de Vagas',
    );
  }
} else {
  routesLogger.error(
    { feature: 'VagasSolicitacoesModule' },
    '❌ vagasSolicitacoesRoutes não está definido',
  );
}

/**
 * Módulo de Requerimentos - COM VALIDAÇÃO
 * /api/v1/requerimentos
 * Sistema de solicitações de usuários (reembolso, cancelamento, suporte, etc.)
 */
if (requerimentosRoutes) {
  try {
    router.use('/api/v1/requerimentos', requerimentosRoutes);
    routesLogger.info(
      { feature: 'RequerimentosModule' },
      '✅ Módulo Requerimentos registrado com sucesso',
    );
  } catch (error) {
    routesLogger.error(
      { feature: 'RequerimentosModule', err: error },
      '❌ ERRO - Módulo Requerimentos',
    );
  }
} else {
  routesLogger.error(
    { feature: 'RequerimentosModule' },
    '❌ requerimentosRoutes não está definido',
  );
}

/**
 * Módulo de Notificações - COM VALIDAÇÃO
 * /api/v1/notificacoes
 * Sistema de notificações para usuários (empresas, candidatos, etc.)
 */
if (notificacoesRoutes) {
  try {
    router.use('/api/v1/notificacoes', notificacoesRoutes);
    routesLogger.info(
      { feature: 'NotificacoesModule' },
      '✅ Módulo Notificações registrado com sucesso',
    );
  } catch (error) {
    routesLogger.error(
      { feature: 'NotificacoesModule', err: error },
      '❌ ERRO - Módulo Notificações',
    );
  }
} else {
  routesLogger.error(
    { feature: 'NotificacoesModule' },
    '❌ notificacoesRoutes não está definido',
  );
}

/**
 * Módulo de Documentação - COM VALIDAÇÃO
 * /docs/login
 */
if (docsRoutes) {
  try {
    router.use('/', docsRoutes);
    routesLogger.info({ feature: 'DocsModule' }, '✅ Módulo Documentação registrado com sucesso');
  } catch (error) {
    routesLogger.error({ feature: 'DocsModule', err: error }, '❌ ERRO - Módulo Documentação');
  }
} else {
  routesLogger.error({ feature: 'DocsModule' }, '❌ docsRoutes não está definido');
}

/**
 * Catch-all para rotas não encontradas
 */
router.all('*', (req, res) => {
  res.status(404).json({
    message: 'Endpoint não encontrado',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    suggestion: 'Verifique a documentação da API',
  });
});

export { router as appRoutes };
