import { Request, Response } from 'express';
import { Roles } from '@/modules/usuarios/enums/Roles';
import { prisma } from '@/config/prisma';
import { StatusDeVagas } from '@prisma/client';

/**
 * Controller para empresa acessar seus próprios dados
 * Não requer empresaId na URL, usa o token JWT para identificar a empresa
 */
export class MinhaEmpresaController {
  /**
   * GET /api/v1/empresas/minha
   * Retorna dados da empresa autenticada
   */
  static get = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Token de autorização necessário',
        });
      }

      const { role, id: usuarioId } = req.user;

      // Apenas empresas podem acessar este endpoint
      if (role !== Roles.EMPRESA) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message:
            'Este endpoint é exclusivo para empresas. Admins devem usar /api/v1/admin/empresas/{id}',
        });
      }

      // Buscar dados da empresa
      const empresa = await prisma.usuarios.findUnique({
        where: { id: usuarioId },
        select: {
          id: true,
          nomeCompleto: true,
          email: true,
          cnpj: true,
          UsuariosInformation: {
            select: {
              telefone: true,
              avatarUrl: true,
            },
          },
          UsuariosEnderecos: {
            select: {
              cidade: true,
              estado: true,
              logradouro: true,
              numero: true,
              bairro: true,
              cep: true,
            },
            take: 1,
          },
        },
      });

      if (!empresa) {
        return res.status(404).json({
          success: false,
          code: 'EMPRESA_NOT_FOUND',
          message: 'Empresa não encontrada',
        });
      }

      // Buscar plano ativo da empresa
      const planoAtivo = await prisma.empresasPlano.findFirst({
        where: { usuarioId },
        orderBy: { criadoEm: 'desc' },
        select: {
          id: true,
          status: true,
          statusPagamento: true,
          inicio: true,
          fim: true,
          proximaCobranca: true,
          PlanosEmpresariais: {
            select: {
              id: true,
              nome: true,
              quantidadeVagas: true,
              vagaEmDestaque: true,
              quantidadeVagasDestaque: true,
            },
          },
        },
      });

      // Contar vagas publicadas
      const vagasPublicadas = await prisma.empresasVagas.count({
        where: {
          usuarioId,
          status: StatusDeVagas.PUBLICADO,
        },
      });

      // Contar destaques utilizados (se plano permite destaques)
      let destaquesUtilizados = 0;
      if (planoAtivo && planoAtivo.PlanosEmpresariais.vagaEmDestaque) {
        destaquesUtilizados = await prisma.empresasVagasDestaque.count({
          where: {
            empresasPlanoId: planoAtivo.id,
            ativo: true,
            EmpresasVagas: {
              status: {
                in: ['EM_ANALISE', 'PUBLICADO'],
              },
            },
          },
        });
      }

      // Formatar resposta
      const response = {
        success: true,
        empresa: {
          id: empresa.id,
          nome: empresa.nomeCompleto,
          email: empresa.email,
          cnpj: empresa.cnpj,
          avatarUrl: empresa.UsuariosInformation?.avatarUrl ?? null,
          telefone: empresa.UsuariosInformation?.telefone ?? null,
          cidade: empresa.UsuariosEnderecos[0]?.cidade ?? null,
          estado: empresa.UsuariosEnderecos[0]?.estado ?? null,
          endereco: empresa.UsuariosEnderecos[0]
            ? {
                logradouro: empresa.UsuariosEnderecos[0].logradouro,
                numero: empresa.UsuariosEnderecos[0].numero,
                bairro: empresa.UsuariosEnderecos[0].bairro,
                cidade: empresa.UsuariosEnderecos[0].cidade,
                estado: empresa.UsuariosEnderecos[0].estado,
                cep: empresa.UsuariosEnderecos[0].cep,
              }
            : null,
          plano: planoAtivo
            ? {
                id: planoAtivo.id,
                nome: planoAtivo.PlanosEmpresariais.nome,
                status: planoAtivo.status,
                statusPagamento: planoAtivo.statusPagamento,
                inicio: planoAtivo.inicio,
                fim: planoAtivo.fim,
                proximaCobranca: planoAtivo.proximaCobranca,
                quantidadeVagas: planoAtivo.PlanosEmpresariais.quantidadeVagas,
                // Campos de destaque
                permiteDestaque: planoAtivo.PlanosEmpresariais.vagaEmDestaque,
                quantidadeDestaquesPlano:
                  planoAtivo.PlanosEmpresariais.quantidadeVagasDestaque || 0,
                destaquesUtilizados,
                destaquesDisponiveis: planoAtivo.PlanosEmpresariais.vagaEmDestaque
                  ? Math.max(
                      0,
                      (planoAtivo.PlanosEmpresariais.quantidadeVagasDestaque || 0) -
                        destaquesUtilizados,
                    )
                  : 0,
              }
            : null,
          vagas: {
            publicadas: vagasPublicadas,
            limitePlano: planoAtivo?.PlanosEmpresariais.quantidadeVagas ?? null,
            disponiveis: planoAtivo
              ? Math.max(0, planoAtivo.PlanosEmpresariais.quantidadeVagas - vagasPublicadas)
              : null,
          },
        },
      };

      res.json(response);
    } catch (error: any) {
      console.error('[MinhaEmpresaController.get] Erro:', error);
      res.status(500).json({
        success: false,
        code: 'MINHA_EMPRESA_ERROR',
        message: 'Erro ao buscar dados da empresa',
        error: error?.message,
      });
    }
  };
}
