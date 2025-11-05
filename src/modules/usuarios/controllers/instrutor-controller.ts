/**
 * Controller para gestão de instrutores
 * Responsabilidade única: operações CRUD de instrutores
 *
 * @author Sistema Advance+
 * @version 1.0.0
 */
import { Request, Response } from 'express';
import { ZodError } from 'zod';
import bcrypt from 'bcrypt';

import { prisma, retryOperation } from '@/config/prisma';
import { logger } from '@/utils/logger';
import {
  sanitizeSocialLinks,
  buildSocialLinksUpdateData,
  mapSocialLinks,
} from '@/modules/usuarios/utils/social-links';
import { invalidateUserCache } from '@/modules/usuarios/utils/cache';

export class InstrutorController {
  /**
   * Listar instrutores com paginação e filtros
   */
  static listarInstrutores = async (req: Request, res: Response) => {
    try {
      const { page = '1', limit = '50', search, status } = req.query;

      const pageNum = Math.max(1, parseInt(page as string, 10));
      const limitNum = Math.min(Math.max(1, parseInt(limit as string, 10)), 100);
      const skip = (pageNum - 1) * limitNum;

      // Construir filtros
      const where: any = {
        role: 'INSTRUTOR',
      };

      if (status) {
        where.status = status;
      }

      // Filtro de busca (nome, email, CPF ou código)
      if (search && typeof search === 'string' && search.trim().length >= 3) {
        const searchTerm = search.trim();
        where.OR = [
          { nomeCompleto: { contains: searchTerm, mode: 'insensitive' } },
          { email: { contains: searchTerm, mode: 'insensitive' } },
          { cpf: { contains: searchTerm.replace(/\D/g, '') } },
          { codUsuario: { contains: searchTerm, mode: 'insensitive' } },
        ];
      }

      // Buscar instrutores
      const [instrutores, total] = await retryOperation(
        async () => {
          return await Promise.all([
            prisma.usuarios.findMany({
              where,
              select: {
                id: true,
                codUsuario: true,
                nomeCompleto: true,
                email: true,
                cpf: true,
                status: true,
                criadoEm: true,
                atualizadoEm: true,
                ultimoLogin: true,
                UsuariosInformation: {
                  select: {
                    telefone: true,
                    genero: true,
                    dataNasc: true,
                    descricao: true,
                    avatarUrl: true,
                  },
                },
                UsuariosRedesSociais: {
                  select: {
                    linkedin: true,
                    instagram: true,
                    facebook: true,
                    youtube: true,
                    twitter: true,
                    tiktok: true,
                  },
                },
                enderecos: {
                  select: {
                    cidade: true,
                    estado: true,
                  },
                  take: 1,
                  orderBy: {
                    criadoEm: 'desc',
                  },
                },
              },
              orderBy: { criadoEm: 'desc' },
              skip,
              take: limitNum,
            }),
            prisma.usuarios.count({ where }),
          ]);
        },
        3,
        1500,
      );

      const data = instrutores.map((instrutor) => ({
        id: instrutor.id,
        codigo: instrutor.codUsuario,
        nomeCompleto: instrutor.nomeCompleto,
        email: instrutor.email,
        cpf: instrutor.cpf,
        status: instrutor.status,
        telefone: instrutor.UsuariosInformation?.telefone || null,
        genero: instrutor.UsuariosInformation?.genero || null,
        dataNasc: instrutor.UsuariosInformation?.dataNasc || null,
        descricao: instrutor.UsuariosInformation?.descricao || null,
        avatarUrl: instrutor.UsuariosInformation?.avatarUrl || null,
        cidade: instrutor.enderecos[0]?.cidade || null,
        estado: instrutor.enderecos[0]?.estado || null,
        criadoEm: instrutor.criadoEm,
        atualizadoEm: instrutor.atualizadoEm,
        ultimoLogin: instrutor.ultimoLogin,
        redesSociais: mapSocialLinks(instrutor.UsuariosRedesSociais),
      }));

      res.json({
        success: true,
        data,
        pagination: {
          page: pageNum,
          pageSize: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error: any) {
      logger.error(
        {
          error: error?.message,
          code: error?.code,
        },
        '❌ Erro ao listar instrutores',
      );

      res.status(500).json({
        success: false,
        code: 'INSTRUTORES_LIST_ERROR',
        message: 'Erro ao listar instrutores',
        error: error?.message,
      });
    }
  };

  /**
   * Buscar instrutor por ID
   */
  static getInstrutorById = async (req: Request, res: Response) => {
    try {
      const { instrutorId } = req.params;

      // Validar UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(instrutorId)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_ID',
          message: 'ID do instrutor inválido. Deve ser um UUID válido.',
        });
      }

      // Buscar instrutor
      const instrutor = await retryOperation(
        async () => {
          return await prisma.usuarios.findUnique({
            where: {
              id: instrutorId,
              role: 'INSTRUTOR',
            },
            select: {
              id: true,
              codUsuario: true,
              nomeCompleto: true,
              email: true,
              cpf: true,
              status: true,
              criadoEm: true,
              atualizadoEm: true,
              ultimoLogin: true,
              UsuariosInformation: {
                select: {
                  telefone: true,
                  genero: true,
                  dataNasc: true,
                  descricao: true,
                  avatarUrl: true,
                },
              },
              UsuariosRedesSociais: {
                select: {
                  linkedin: true,
                  instagram: true,
                  facebook: true,
                  youtube: true,
                  twitter: true,
                  tiktok: true,
                },
              },
              enderecos: {
                select: {
                  id: true,
                  logradouro: true,
                  numero: true,
                  bairro: true,
                  cidade: true,
                  estado: true,
                  cep: true,
                  criadoEm: true,
                },
                orderBy: {
                  criadoEm: 'desc',
                },
              },
            },
          });
        },
        3,
        1500,
      );

      // Verificar se instrutor existe
      if (!instrutor) {
        return res.status(404).json({
          success: false,
          code: 'INSTRUTOR_NOT_FOUND',
          message: 'Instrutor não encontrado ou não possui role de INSTRUTOR.',
        });
      }

      // Formatar resposta
      const response = {
        id: instrutor.id,
        codigo: instrutor.codUsuario,
        nomeCompleto: instrutor.nomeCompleto,
        email: instrutor.email,
        cpf: instrutor.cpf,
        telefone: instrutor.informacoes?.telefone || null,
        status: instrutor.status,
        genero: instrutor.informacoes?.genero || null,
        dataNasc: instrutor.informacoes?.dataNasc || null,
        descricao: instrutor.informacoes?.descricao || null,
        avatarUrl: instrutor.informacoes?.avatarUrl || null,
        criadoEm: instrutor.criadoEm,
        atualizadoEm: instrutor.atualizadoEm,
        ultimoLogin: instrutor.ultimoLogin,
        enderecos: instrutor.enderecos,
        redesSociais: mapSocialLinks(instrutor.UsuariosRedesSociais),
      };

      res.json({
        success: true,
        data: response,
      });
    } catch (error: any) {
      logger.error(
        {
          instrutorId: req.params.instrutorId,
          error: error?.message,
          code: error?.code,
        },
        '❌ Erro ao buscar detalhes do instrutor',
      );

      res.status(500).json({
        success: false,
        code: 'INSTRUTOR_FETCH_ERROR',
        message: 'Erro ao buscar detalhes do instrutor',
        error: error?.message,
      });
    }
  };

  /**
   * Atualizar informações de um instrutor específico (ADMIN/MODERADOR apenas)
   */
  static atualizarInstrutorById = async (req: Request, res: Response) => {
    try {
      const { instrutorId } = req.params;

      // Validar UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(instrutorId)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_ID',
          message: 'ID do instrutor inválido. Deve ser um UUID válido.',
        });
      }

      // Extrair dados da requisição
      const {
        nomeCompleto,
        email,
        telefone,
        genero,
        dataNasc,
        descricao,
        avatarUrl,
        redesSociais,
        endereco,
        senha,
        confirmarSenha,
      } = req.body;

      // Validar senha se fornecida
      if (senha !== undefined || confirmarSenha !== undefined) {
        if (senha === undefined || confirmarSenha === undefined) {
          return res.status(400).json({
            success: false,
            code: 'PASSWORD_CONFIRMATION_REQUIRED',
            message: 'Informe senha e confirmarSenha para redefinir a senha',
          });
        }

        if (senha !== confirmarSenha) {
          return res.status(400).json({
            success: false,
            code: 'PASSWORD_MISMATCH',
            message: 'Senha e confirmarSenha devem ser iguais',
          });
        }

        if (senha.length < 8) {
          return res.status(400).json({
            success: false,
            code: 'PASSWORD_TOO_SHORT',
            message: 'Senha deve ter pelo menos 8 caracteres',
          });
        }
      }

      // Validar email se fornecido
      if (email !== undefined) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_EMAIL',
            message: 'Informe um e-mail válido',
          });
        }
      }

      // Sanitizar redes sociais
      const redesSociaisSanitizado = sanitizeSocialLinks(redesSociais);
      const redesSociaisUpdate = buildSocialLinksUpdateData(redesSociaisSanitizado);

      // Atualizar instrutor com transação
      const instrutorAtualizado = await retryOperation(
        async () => {
          return await prisma.$transaction(async (tx) => {
            // Verificar se instrutor existe e é do tipo INSTRUTOR
            const instrutorExistente = await tx.usuarios.findUnique({
              where: { id: instrutorId },
              select: {
                id: true,
                role: true,
                UsuariosInformation: true,
                UsuariosRedesSociais: true,
              },
            });

            if (!instrutorExistente) {
              throw Object.assign(new Error('Instrutor não encontrado'), {
                code: 'INSTRUTOR_NOT_FOUND',
                statusCode: 404,
              });
            }

            if (instrutorExistente.role !== 'INSTRUTOR') {
              throw Object.assign(new Error('Usuário não é um instrutor'), {
                code: 'INVALID_USER_TYPE',
                statusCode: 400,
              });
            }

            // Verificar se email já existe
            if (email !== undefined) {
              const emailJaExiste = await tx.usuarios.findFirst({
                where: {
                  email: email.trim().toLowerCase(),
                  id: { not: instrutorId },
                },
              });

              if (emailJaExiste) {
                throw Object.assign(new Error('Este e-mail já está em uso por outro usuário'), {
                  code: 'EMAIL_ALREADY_EXISTS',
                  statusCode: 409,
                });
              }
            }

            // Preparar dados de atualização
            const dadosAtualizacao: any = {};
            if (nomeCompleto !== undefined) {
              dadosAtualizacao.nomeCompleto = nomeCompleto.trim();
            }
            if (email !== undefined) {
              dadosAtualizacao.email = email.trim().toLowerCase();
            }
            if (senha !== undefined) {
              dadosAtualizacao.senha = await bcrypt.hash(senha, 12);
            }
            if (Object.keys(dadosAtualizacao).length > 0) {
              dadosAtualizacao.atualizadoEm = new Date();
            }

            // Atualizar dados básicos do usuário
            if (Object.keys(dadosAtualizacao).length > 0) {
              await tx.usuarios.update({
                where: { id: instrutorId },
                data: dadosAtualizacao,
              });
            }

            // Preparar dados de informações
            const dadosInformacoes: any = {};
            if (telefone !== undefined) dadosInformacoes.telefone = telefone?.trim() || null;
            if (genero !== undefined) dadosInformacoes.genero = genero || null;
            if (dataNasc !== undefined)
              dadosInformacoes.dataNasc = dataNasc ? new Date(dataNasc) : null;
            if (descricao !== undefined) dadosInformacoes.descricao = descricao?.trim() || null;
            if (avatarUrl !== undefined) dadosInformacoes.avatarUrl = avatarUrl?.trim() || null;

            // Atualizar ou criar informações
            if (Object.keys(dadosInformacoes).length > 0) {
              if (instrutorExistente.UsuariosInformation) {
                await tx.usuariosInformation.update({
                  where: { usuarioId: instrutorId },
                  data: dadosInformacoes,
                });
              } else {
                await tx.usuariosInformation.create({
                  data: {
                    usuarioId: instrutorId,
                    ...dadosInformacoes,
                  },
                });
              }
            }

            // Atualizar ou criar redes sociais
            if (redesSociaisUpdate) {
              if (instrutorExistente.UsuariosRedesSociais) {
                await tx.usuariosRedesSociais.update({
                  where: { usuarioId: instrutorId },
                  data: {
                    ...redesSociaisUpdate,
                    updatedAt: new Date(),
                  },
                });
              } else {
                await tx.usuariosRedesSociais.create({
                  data: {
                    usuarioId: instrutorId,
                    ...redesSociaisUpdate,
                    updatedAt: new Date(),
                  },
                });
              }
            }

            // Atualizar endereço se fornecido
            if (endereco && typeof endereco === 'object') {
              const dadosEndereco: any = {};
              if (endereco.logradouro !== undefined)
                dadosEndereco.logradouro = endereco.logradouro?.trim() || null;
              if (endereco.numero !== undefined)
                dadosEndereco.numero = endereco.numero?.trim() || null;
              if (endereco.bairro !== undefined)
                dadosEndereco.bairro = endereco.bairro?.trim() || null;
              if (endereco.cidade !== undefined)
                dadosEndereco.cidade = endereco.cidade?.trim() || null;
              if (endereco.estado !== undefined)
                dadosEndereco.estado = endereco.estado?.trim() || null;
              if (endereco.cep !== undefined)
                dadosEndereco.cep = endereco.cep?.replace(/\D/g, '') || null;

              dadosEndereco.atualizadoEm = new Date();

              // Se tem algum campo preenchido, atualizar endereço
              if (Object.keys(dadosEndereco).length > 1) {
                // Buscar endereço mais recente do instrutor
                const enderecoExistente = await tx.usuariosEnderecos.findFirst({
                  where: { usuarioId: instrutorId },
                  orderBy: { criadoEm: 'desc' },
                });

                if (enderecoExistente) {
                  // Atualizar endereço existente
                  await tx.usuariosEnderecos.update({
                    where: { id: enderecoExistente.id },
                    data: dadosEndereco,
                  });
                } else {
                  // Criar novo endereço
                  await tx.usuariosEnderecos.create({
                    data: {
                      usuarioId: instrutorId,
                      ...dadosEndereco,
                    },
                  });
                }
              }
            }

            // Buscar dados completos atualizados
            const instrutorCompleto = await tx.usuarios.findUnique({
              where: { id: instrutorId },
              select: {
                id: true,
                codUsuario: true,
                nomeCompleto: true,
                email: true,
                cpf: true,
                status: true,
                criadoEm: true,
                atualizadoEm: true,
                ultimoLogin: true,
                UsuariosInformation: {
                  select: {
                    telefone: true,
                    genero: true,
                    dataNasc: true,
                    descricao: true,
                    avatarUrl: true,
                  },
                },
                UsuariosRedesSociais: {
                  select: {
                    linkedin: true,
                    instagram: true,
                    facebook: true,
                    youtube: true,
                    twitter: true,
                    tiktok: true,
                  },
                },
                enderecos: {
                  select: {
                    id: true,
                    logradouro: true,
                    numero: true,
                    bairro: true,
                    cidade: true,
                    estado: true,
                    cep: true,
                    criadoEm: true,
                  },
                  orderBy: {
                    criadoEm: 'desc',
                  },
                },
              },
            });

            return instrutorCompleto!;
          });
        },
        3,
        1500,
      );

      // Invalidar cache do usuário
      await invalidateUserCache(instrutorAtualizado);

      logger.info(
        {
          instrutorId,
          nomeCompleto: req.body.nomeCompleto,
          camposAtualizados: Object.keys(req.body).filter((k) => req.body[k] !== undefined),
        },
        '✅ Informações do instrutor atualizadas com sucesso',
      );

      // Retornar resposta formatada
      const response = {
        id: instrutorAtualizado.id,
        codigo: instrutorAtualizado.codUsuario,
        nomeCompleto: instrutorAtualizado.nomeCompleto,
        email: instrutorAtualizado.email,
        cpf: instrutorAtualizado.cpf,
        telefone: instrutorAtualizado.UsuariosInformation?.telefone || null,
        status: instrutorAtualizado.status,
        genero: instrutorAtualizado.UsuariosInformation?.genero || null,
        dataNasc: instrutorAtualizado.UsuariosInformation?.dataNasc || null,
        descricao: instrutorAtualizado.UsuariosInformation?.descricao || null,
        avatarUrl: instrutorAtualizado.UsuariosInformation?.avatarUrl || null,
        criadoEm: instrutorAtualizado.criadoEm,
        atualizadoEm: instrutorAtualizado.atualizadoEm,
        ultimoLogin: instrutorAtualizado.ultimoLogin,
        enderecos: instrutorAtualizado.enderecos || [],
        redesSociais: mapSocialLinks(instrutorAtualizado.UsuariosRedesSociais),
      };

      res.json({
        success: true,
        message: 'Informações do instrutor atualizadas com sucesso',
        data: response,
      });
    } catch (error: any) {
      logger.error(
        {
          instrutorId: req.params.instrutorId,
          error: error?.message,
          code: error?.code,
        },
        '❌ Erro ao atualizar informações do instrutor',
      );

      if (error?.code === 'INSTRUTOR_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'INSTRUTOR_NOT_FOUND',
          message: 'Instrutor não encontrado ou não possui role de INSTRUTOR.',
        });
      }

      if (error?.code === 'INVALID_USER_TYPE') {
        return res.status(400).json({
          success: false,
          code: 'INVALID_USER_TYPE',
          message: 'O usuário especificado não é um instrutor.',
        });
      }

      if (error?.code === 'EMAIL_ALREADY_EXISTS') {
        return res.status(409).json({
          success: false,
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'Este e-mail já está em uso por outro usuário',
        });
      }

      res.status(500).json({
        success: false,
        code: 'INSTRUTOR_UPDATE_ERROR',
        message: 'Erro ao atualizar informações do instrutor',
        error: error?.message,
      });
    }
  };
}
