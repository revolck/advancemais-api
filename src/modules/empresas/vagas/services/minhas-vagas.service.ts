import { prisma } from '@/config/prisma';
import type { StatusDeVagas } from '@prisma/client';
import { vagasService } from './vagas.service';

/**
 * Service específico para empresas listarem suas vagas
 * Inclui informações adicionais como último candidato
 */
export const minhasVagasService = {
  /**
   * Lista vagas da empresa com informação do último candidato
   */
  async listar(params: {
    empresaId: string;
    status?: StatusDeVagas[];
    page?: number;
    pageSize?: number;
  }) {
    const { empresaId, status, page, pageSize } = params;

    // Buscar vagas usando o service existente
    const vagas = await vagasService.list({
      status,
      usuarioId: empresaId,
      page,
      pageSize,
    });

    // Buscar IDs das vagas
    const vagaIds = vagas.map((v: any) => v.id);

    if (vagaIds.length === 0) {
      return vagas;
    }

    // Buscar último candidato de cada vaga (em uma única query otimizada)
    const ultimosCandidatos = await prisma.$queryRaw<
      Array<{
        vagaId: string;
        candidatoId: string;
        candidatoNome: string;
        aplicadaEm: Date;
      }>
    >`
      SELECT DISTINCT ON (c."vagaId")
        c."vagaId" as "vagaId",
        c."candidatoId" as "candidatoId",
        u."nomeCompleto" as "candidatoNome",
        c."aplicadaEm"
      FROM "EmpresasCandidatos" c
      INNER JOIN "Usuarios" u ON u.id = c."candidatoId"
      WHERE c."vagaId" = ANY(${vagaIds}::text[])
      ORDER BY c."vagaId", c."aplicadaEm" DESC
    `;

    // Criar mapa de vagaId -> último candidato
    const candidatosMap = new Map(ultimosCandidatos.map((uc) => [uc.vagaId, uc]));

    // Adicionar ultimoCandidato em cada vaga
    const vagasComCandidatos = vagas.map((vaga: any) => {
      const ultimoCandidato = candidatosMap.get(vaga.id);

      return {
        ...vaga,
        ultimoCandidato: ultimoCandidato
          ? {
              id: ultimoCandidato.candidatoId,
              nome: ultimoCandidato.candidatoNome,
              aplicadaEm: ultimoCandidato.aplicadaEm,
            }
          : null,
      };
    });

    return vagasComCandidatos;
  },
};
