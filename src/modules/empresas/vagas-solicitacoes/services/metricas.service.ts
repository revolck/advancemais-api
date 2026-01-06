/**
 * Service para métricas do Setor de Vagas
 *
 * ✅ OTIMIZAÇÕES IMPLEMENTADAS:
 * - Query SQL agregada única (elimina N queries)
 * - Cache Redis (TTL: 2 minutos)
 * - Conversão otimizada de bigint para number
 * - Uso de índices existentes no banco
 */

import { Prisma, StatusDeVagas, Roles } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { getCache, setCache } from '@/utils/cache';
import crypto from 'crypto';

const metricasLogger = logger.child({ module: 'MetricasSetorVagasService' });

// TTL de cache (em segundos)
const CACHE_TTL_METRICAS = 120; // 2 minutos - métricas mudam com frequência moderada

export const metricasService = {
  /**
   * Retorna métricas consolidadas para o dashboard do Setor de Vagas
   * ✅ OTIMIZADO: Query SQL agregada única + Cache Redis
   */
  getMetricas: async (params?: { empresaUsuarioIds?: string[]; vagaIds?: string[] }) => {
    const empresaUsuarioIds =
      params?.empresaUsuarioIds?.map((id) => id.trim()).filter(Boolean) ?? [];
    const vagaIds = params?.vagaIds?.map((id) => id.trim()).filter(Boolean) ?? [];
    const scopeHash =
      empresaUsuarioIds.length > 0 || vagaIds.length > 0
        ? crypto
            .createHash('md5')
            .update(
              JSON.stringify({
                empresas: empresaUsuarioIds.slice().sort(),
                vagas: vagaIds.slice().sort(),
              }),
            )
            .digest('hex')
        : null;

    const cacheKey = scopeHash
      ? `metricas:setor-vagas:empresas:${scopeHash}`
      : 'metricas:setor-vagas:gerais';

    // Tentar buscar do cache primeiro
    const cached = await getCache<{
      metricasGerais: {
        totalEmpresas: number;
        empresasAtivas: number;
        totalVagas: number;
        vagasAbertas: number;
        vagasPendentes: number;
        vagasEncerradas: number;
        totalCandidatos: number;
        candidatosEmProcesso: number;
        candidatosContratados: number;
        solicitacoesPendentes: number;
        solicitacoesAprovadasHoje: number;
        solicitacoesRejeitadasHoje: number;
      };
    }>(cacheKey);

    if (cached) {
      metricasLogger.debug('Métricas retornadas do cache');
      return cached;
    }

    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);

      // ✅ OTIMIZAÇÃO: Query SQL agregada única com subqueries
      // Isso reduz de 12 queries separadas para 1 query única
      // Usar $queryRawUnsafe para passar parâmetros de data dinamicamente
      const hojeISO = hoje.toISOString();
      const amanhaISO = amanha.toISOString();

      const query = `
        SELECT
          -- Empresas
          (SELECT COUNT(*) FROM "Usuarios" 
            WHERE "role" = 'EMPRESA' 
            AND "tipoUsuario" = 'PESSOA_JURIDICA'
            AND ($3::uuid[] IS NULL OR "id" = ANY($3::uuid[]))
          ) AS "totalEmpresas",
          (SELECT COUNT(*) FROM "Usuarios" 
            WHERE "role" = 'EMPRESA' 
            AND "tipoUsuario" = 'PESSOA_JURIDICA' 
            AND "status" = 'ATIVO'
            AND ($3::uuid[] IS NULL OR "id" = ANY($3::uuid[]))
          ) AS "empresasAtivas",
          
          -- Vagas
          (SELECT COUNT(*) FROM "EmpresasVagas"
            WHERE (
              $4::uuid[] IS NOT NULL AND "id" = ANY($4::uuid[])
            ) OR (
              $4::uuid[] IS NULL AND ($3::uuid[] IS NULL OR "usuarioId" = ANY($3::uuid[]))
            )
          ) AS "totalVagas",
          (SELECT COUNT(*) FROM "EmpresasVagas" 
            WHERE "status" = 'PUBLICADO'
            AND ((
              $4::uuid[] IS NOT NULL AND "id" = ANY($4::uuid[])
            ) OR (
              $4::uuid[] IS NULL AND ($3::uuid[] IS NULL OR "usuarioId" = ANY($3::uuid[]))
            ))
          ) AS "vagasAbertas",
          (SELECT COUNT(*) FROM "EmpresasVagas" 
            WHERE "status" = 'EM_ANALISE'
            AND ((
              $4::uuid[] IS NOT NULL AND "id" = ANY($4::uuid[])
            ) OR (
              $4::uuid[] IS NULL AND ($3::uuid[] IS NULL OR "usuarioId" = ANY($3::uuid[]))
            ))
          ) AS "vagasPendentes",
          (SELECT COUNT(*) FROM "EmpresasVagas" 
            WHERE "status" IN ('ENCERRADA', 'EXPIRADO', 'DESPUBLICADA')
            AND ((
              $4::uuid[] IS NOT NULL AND "id" = ANY($4::uuid[])
            ) OR (
              $4::uuid[] IS NULL AND ($3::uuid[] IS NULL OR "usuarioId" = ANY($3::uuid[]))
            ))
          ) AS "vagasEncerradas",
          
          -- Candidatos
          (CASE 
            WHEN $4::uuid[] IS NOT NULL THEN (SELECT COUNT(DISTINCT "candidatoId") FROM "EmpresasCandidatos" WHERE "vagaId" = ANY($4::uuid[]))
            WHEN $3::uuid[] IS NOT NULL THEN (SELECT COUNT(DISTINCT "candidatoId") FROM "EmpresasCandidatos" WHERE "empresaUsuarioId" = ANY($3::uuid[]))
            ELSE (SELECT COUNT(*) FROM "Usuarios" WHERE "role" = 'ALUNO_CANDIDATO')
          END) AS "totalCandidatos",
          (SELECT COUNT(*) FROM "EmpresasCandidatos" ec
            INNER JOIN "StatusProcessosCandidatos" sp ON ec."statusId" = sp."id"
            WHERE sp."nome" IN ('EM_ANALISE', 'ENTREVISTA', 'DESAFIO', 'DOCUMENTACAO')
            AND ((
              $4::uuid[] IS NOT NULL AND ec."vagaId" = ANY($4::uuid[])
            ) OR (
              $4::uuid[] IS NULL AND ($3::uuid[] IS NULL OR ec."empresaUsuarioId" = ANY($3::uuid[]))
            ))
          ) AS "candidatosEmProcesso",
          (SELECT COUNT(*) FROM "EmpresasCandidatos" ec
            INNER JOIN "StatusProcessosCandidatos" sp ON ec."statusId" = sp."id"
            WHERE sp."nome" = 'CONTRATADO'
            AND ((
              $4::uuid[] IS NOT NULL AND ec."vagaId" = ANY($4::uuid[])
            ) OR (
              $4::uuid[] IS NULL AND ($3::uuid[] IS NULL OR ec."empresaUsuarioId" = ANY($3::uuid[]))
            ))
          ) AS "candidatosContratados",
          
          -- Solicitações
          (SELECT COUNT(*) FROM "EmpresasVagas" 
            WHERE "status" = 'EM_ANALISE'
            AND ((
              $4::uuid[] IS NOT NULL AND "id" = ANY($4::uuid[])
            ) OR (
              $4::uuid[] IS NULL AND ($3::uuid[] IS NULL OR "usuarioId" = ANY($3::uuid[]))
            ))
          ) AS "solicitacoesPendentes",
          (SELECT COUNT(*) FROM "EmpresasVagas" 
            WHERE "status" = 'PUBLICADO' 
            AND "atualizadoEm" >= $1::timestamp 
            AND "atualizadoEm" < $2::timestamp
            AND ((
              $4::uuid[] IS NOT NULL AND "id" = ANY($4::uuid[])
            ) OR (
              $4::uuid[] IS NULL AND ($3::uuid[] IS NULL OR "usuarioId" = ANY($3::uuid[]))
            ))
          ) AS "solicitacoesAprovadasHoje",
          (SELECT COUNT(*) FROM "EmpresasVagas" 
            WHERE "status" = 'DESPUBLICADA' 
            AND "atualizadoEm" >= $1::timestamp 
            AND "atualizadoEm" < $2::timestamp
            AND ((
              $4::uuid[] IS NOT NULL AND "id" = ANY($4::uuid[])
            ) OR (
              $4::uuid[] IS NULL AND ($3::uuid[] IS NULL OR "usuarioId" = ANY($3::uuid[]))
            ))
          ) AS "solicitacoesRejeitadasHoje"
      `;

      const [result] = await prisma.$queryRawUnsafe<
        {
          totalEmpresas: bigint;
          empresasAtivas: bigint;
          totalVagas: bigint;
          vagasAbertas: bigint;
          vagasPendentes: bigint;
          vagasEncerradas: bigint;
          totalCandidatos: bigint;
          candidatosEmProcesso: bigint;
          candidatosContratados: bigint;
          solicitacoesPendentes: bigint;
          solicitacoesAprovadasHoje: bigint;
          solicitacoesRejeitadasHoje: bigint;
        }[]
      >(
        query,
        hojeISO,
        amanhaISO,
        empresaUsuarioIds.length > 0 ? empresaUsuarioIds : null,
        vagaIds.length > 0 ? vagaIds : null,
      );

      // Converter bigint para number
      const metricasGerais = {
        totalEmpresas: Number(result.totalEmpresas ?? 0n),
        empresasAtivas: Number(result.empresasAtivas ?? 0n),
        totalVagas: Number(result.totalVagas ?? 0n),
        vagasAbertas: Number(result.vagasAbertas ?? 0n),
        vagasPendentes: Number(result.vagasPendentes ?? 0n),
        vagasEncerradas: Number(result.vagasEncerradas ?? 0n),
        totalCandidatos: Number(result.totalCandidatos ?? 0n),
        candidatosEmProcesso: Number(result.candidatosEmProcesso ?? 0n),
        candidatosContratados: Number(result.candidatosContratados ?? 0n),
        solicitacoesPendentes: Number(result.solicitacoesPendentes ?? 0n),
        solicitacoesAprovadasHoje: Number(result.solicitacoesAprovadasHoje ?? 0n),
        solicitacoesRejeitadasHoje: Number(result.solicitacoesRejeitadasHoje ?? 0n),
      };

      const response = {
        metricasGerais,
      };

      // Cachear resultado
      await setCache(cacheKey, response, CACHE_TTL_METRICAS);

      return response;
    } catch (error) {
      metricasLogger.error({ err: error }, 'Erro ao buscar métricas');
      throw error;
    }
  },
};
