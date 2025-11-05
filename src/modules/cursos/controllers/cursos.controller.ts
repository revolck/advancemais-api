import { Request, Response } from 'express';
import { ZodError } from 'zod';
import bcrypt from 'bcrypt';

import { prisma, retryOperation } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { cursosService } from '../services/cursos.service';
import {
  createCourseSchema,
  listCoursesQuerySchema,
  updateCourseSchema,
} from '../validators/cursos.schema';
import {
  sanitizeSocialLinks,
  buildSocialLinksUpdateData,
  mapSocialLinks,
} from '@/modules/usuarios/utils/social-links';
import { invalidateUserCache } from '@/modules/usuarios/utils/cache';

const parseCourseId = (raw: string) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
};

const normalizeDescricao = (value: unknown) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (value === null) {
    return null;
  }

  return undefined;
};

/**
 * Calcula o progresso do curso baseado em aulas concluídas, provas realizadas e tempo decorrido
 */
const calcularProgressoCurso = async (
  inscricaoId: string,
  turmaId: string,
  dataInicio: Date | null,
  dataFim: Date | null,
): Promise<number> => {
  try {
    // Buscar contagem de aulas e provas da turma
    const [totalAulas, totalProvas, aulasComFrequencia, provasComEnvio] = await Promise.all([
      prisma.cursosTurmasAulas.count({
        where: { turmaId },
      }),
      prisma.cursosTurmasProvas.count({
        where: { turmaId },
      }),
      prisma.cursosFrequenciaAlunos.count({
        where: { inscricaoId, status: 'PRESENTE' },
      }),
      prisma.cursosTurmasProvasEnvios.count({
        where: { inscricaoId },
      }),
    ]);

    // Se não há aulas nem provas, calcular por tempo decorrido
    if (totalAulas === 0 && totalProvas === 0) {
      if (dataInicio && dataFim) {
        const agora = new Date();
        const inicio = new Date(dataInicio).getTime();
        const fim = new Date(dataFim).getTime();
        const atual = agora.getTime();

        if (fim > inicio) {
          const progressoPorTempo = Math.min(
            100,
            Math.max(0, ((atual - inicio) / (fim - inicio)) * 100),
          );
          return Math.round(progressoPorTempo);
        }
      }
      return 0;
    }

    // Calcular progresso baseado em aulas e provas
    let progressoAulas = 0;
    let progressoProvas = 0;
    let pesoAulas = 0.6; // Peso padrão para aulas
    let pesoProvas = 0.4; // Peso padrão para provas

    if (totalAulas > 0) {
      progressoAulas = (aulasComFrequencia / totalAulas) * 100;
    }

    if (totalProvas > 0) {
      progressoProvas = (provasComEnvio / totalProvas) * 100;
    }

    // Ajustar pesos se um dos componentes não existe
    if (totalAulas === 0 && totalProvas > 0) {
      pesoAulas = 0;
      pesoProvas = 1;
    } else if (totalAulas > 0 && totalProvas === 0) {
      pesoAulas = 1;
      pesoProvas = 0;
    }

    const progressoTotal = progressoAulas * pesoAulas + progressoProvas * pesoProvas;

    // Arredondar para número inteiro
    return Math.round(Math.min(100, Math.max(0, progressoTotal)));
  } catch (error) {
    logger.error(
      {
        inscricaoId,
        turmaId,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      '❌ Erro ao calcular progresso do curso',
    );
    return 0;
  }
};

export class CursosController {
  static meta = (_req: Request, res: Response) => {
    res.json({
      message: 'Cursos Module API',
      version: 'v1',
      timestamp: new Date().toISOString(),
      endpoints: {
        cursos: '/',
        turmas: '/:cursoId/turmas',
        inscricoes: '/:cursoId/turmas/:turmaId/inscricoes',
      },
      status: 'operational',
    });
  };

  static list = async (req: Request, res: Response) => {
    try {
      const params = listCoursesQuerySchema.parse(req.query);
      const result = await cursosService.list({
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        statusPadrao: params.statusPadrao,
        categoriaId: params.categoriaId,
        subcategoriaId: params.subcategoriaId,
        instrutorId: params.instrutorId,
        includeTurmas: params.includeTurmas,
      });

      res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros de consulta inválidos',
          issues: error.flatten().fieldErrors,
        });
      }

      res.status(500).json({
        success: false,
        code: 'CURSOS_LIST_ERROR',
        message: 'Erro ao listar cursos',
        error: error?.message,
      });
    }
  };

  static publicList = async (_req: Request, res: Response) => {
    try {
      const cursos = await cursosService.listPublic();
      res.json({ data: cursos });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'CURSOS_PUBLIC_LIST_ERROR',
        message: 'Erro ao listar cursos públicos',
        error: error?.message,
      });
    }
  };

  static get = async (req: Request, res: Response) => {
    const id = parseCourseId(req.params.cursoId ?? req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de curso inválido',
      });
    }

    try {
      const course = await cursosService.getById(id);
      if (!course) {
        return res.status(404).json({
          success: false,
          code: 'CURSO_NOT_FOUND',
          message: 'Curso não encontrado',
        });
      }

      res.json(course);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'CURSO_GET_ERROR',
        message: 'Erro ao buscar curso',
        error: error?.message,
      });
    }
  };

  static publicGet = async (req: Request, res: Response) => {
    const id = parseCourseId(req.params.cursoId ?? req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de curso inválido',
      });
    }

    try {
      const course = await cursosService.getPublicById(id);
      if (!course) {
        return res.status(404).json({
          success: false,
          code: 'CURSO_NOT_FOUND',
          message: 'Curso não encontrado ou indisponível',
        });
      }

      res.json(course);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'CURSO_PUBLIC_GET_ERROR',
        message: 'Erro ao buscar curso público',
        error: error?.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const data = createCourseSchema.parse(req.body);
      const course = await cursosService.create({
        ...data,
        descricao: normalizeDescricao(data.descricao),
      });

      res.status(201).json(course);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para criação do curso',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'INSTRUTOR_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'INSTRUTOR_NOT_FOUND',
          message: 'Instrutor informado não foi encontrado',
        });
      }

      if (error?.code === 'INSTRUTOR_INVALID_ROLE') {
        return res.status(400).json({
          success: false,
          code: 'INSTRUTOR_INVALID_ROLE',
          message: 'Instrutor deve possuir a role INSTRUTOR',
        });
      }

      res.status(500).json({
        success: false,
        code: 'CURSO_CREATE_ERROR',
        message: 'Erro ao criar curso',
        error: error?.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    const id = parseCourseId(req.params.cursoId ?? req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de curso inválido',
      });
    }

    try {
      const data = updateCourseSchema.parse(req.body);

      if (Object.keys(data).length === 0) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Informe ao menos um campo para atualização do curso',
        });
      }

      const course = await cursosService.update(id, {
        ...data,
        descricao: normalizeDescricao(data.descricao),
      });

      res.json(course);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualização do curso',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'INSTRUTOR_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'INSTRUTOR_NOT_FOUND',
          message: 'Instrutor informado não foi encontrado',
        });
      }

      if (error?.code === 'INSTRUTOR_INVALID_ROLE') {
        return res.status(400).json({
          success: false,
          code: 'INSTRUTOR_INVALID_ROLE',
          message: 'Instrutor deve possuir a role INSTRUTOR',
        });
      }

      if (error?.code === 'P2025') {
        return res.status(404).json({
          success: false,
          code: 'CURSO_NOT_FOUND',
          message: 'Curso não encontrado',
        });
      }

      res.status(500).json({
        success: false,
        code: 'CURSO_UPDATE_ERROR',
        message: 'Erro ao atualizar curso',
        error: error?.message,
      });
    }
  };

  static archive = async (req: Request, res: Response) => {
    const id = parseCourseId(req.params.cursoId ?? req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de curso inválido',
      });
    }

    try {
      const course = await cursosService.archive(id);
      res.json(course);
    } catch (error: any) {
      if (error?.code === 'P2025') {
        return res.status(404).json({
          success: false,
          code: 'CURSO_NOT_FOUND',
          message: 'Curso não encontrado',
        });
      }

      res.status(500).json({
        success: false,
        code: 'CURSO_ARCHIVE_ERROR',
        message: 'Erro ao despublicar curso',
        error: error?.message,
      });
    }
  };

  /**
   * Listar alunos com inscrições em cursos
   */
  static listAlunosComInscricoes = async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50); // Padrão 10, max 50 para performance
      const skip = (page - 1) * limit;

      // Parâmetros de filtro
      const cidade = req.query.cidade as string | undefined;
      const statusInscricao = req.query.status as string | undefined;
      const cursoIdParam = (req.query.cursoId || req.query.curso) as string | undefined;
      const turmaIdParam = (req.query.turmaId || req.query.turma) as string | undefined;
      const search = req.query.search as string | undefined;

      // Validar status de inscrição se fornecido
      const statusValidos = [
        'INSCRITO',
        'EM_ANDAMENTO',
        'CONCLUIDO',
        'REPROVADO',
        'EM_ESTAGIO',
        'CANCELADO',
        'TRANCADO',
      ];

      if (statusInscricao && !statusValidos.includes(statusInscricao)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_STATUS',
          message: `Status inválido: "${statusInscricao}". Valores aceitos: ${statusValidos.join(', ')}`,
        });
      }

      // Construir filtro dinamicamente
      const where: any = {
            role: 'ALUNO_CANDIDATO',
            CursosTurmasInscricoes: {
              some: {},
            },
      };

      // Filtro por cidade
      if (cidade) {
        where.UsuariosEnderecos = {
          some: {
            cidade: {
              equals: cidade,
              mode: 'insensitive',
            },
          },
        };
      }

      // Construir filtros de inscrições
      const inscricaoFilter: any = {};

      if (cursoIdParam || turmaIdParam || statusInscricao) {
        // Filtro por status da inscrição
        if (statusInscricao) {
          inscricaoFilter.status = statusInscricao;
        }

        // Filtro por turma (e opcionalmente por curso)
        if (cursoIdParam || turmaIdParam) {
          const turmaFilter: any = {};

          if (cursoIdParam) {
            turmaFilter.curso = {
              id: parseInt(cursoIdParam),
            };
          }

          if (turmaIdParam) {
            turmaFilter.id = turmaIdParam;
          }

          inscricaoFilter.turma = turmaFilter;
        }

        // Aplicar filtro de inscrições no WHERE (valida que aluno TEM essa inscrição)
        where.turmasInscritas = {
          some: inscricaoFilter,
        };
      }

      // Filtro por busca (nome, email ou CPF)
      if (search) {
        where.OR = [
          { nomeCompleto: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { cpf: { contains: search.replace(/\D/g, '') } },
          { codUsuario: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Buscar alunos com retry logic (3 tentativas automáticas)
      const [alunos, total] = await retryOperation(
        async () => {
          const [alunosResult, totalResult] = await Promise.all([
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
            ultimoLogin: true,
            UsuariosEnderecos: {
              select: {
                cidade: true,
                estado: true,
              },
              take: 1,
              orderBy: {
                criadoEm: 'desc',
              },
            },
            CursosTurmasInscricoes: {
                  // Aplicar o mesmo filtro aqui para que o take: 1 pegue a inscrição CORRETA
                  where: Object.keys(inscricaoFilter).length > 0 ? inscricaoFilter : undefined,
              select: {
                id: true,
                status: true,
                criadoEm: true,
                  CursosTurmas: {
                    select: {
                      id: true,
                      nome: true,
                      codigo: true,
                      status: true,
                      dataInicio: true,
                      dataFim: true,
                      Cursos: {
                        select: {
                          id: true,
                          nome: true,
                          codigo: true,
                        },
                      },
                    },
                  },
              },
                  // Trazer apenas a inscrição mais recente (QUE CORRESPONDA AO FILTRO)
                  take: 1,
                  orderBy: {
                    criadoEm: 'desc',
                  },
            },
          },
          skip,
          take: limit,
          orderBy: {
            criadoEm: 'desc',
          },
        }),
        prisma.usuarios.count({
              where,
        }),
      ]);

          return [alunosResult, totalResult];
        },
        3, // 3 tentativas
        1500, // 1.5s entre tentativas
      );

      const data = await Promise.all(
        alunos.map(async (aluno) => {
          let ultimaInscricao: typeof aluno.CursosTurmasInscricoes[0] | undefined = aluno.CursosTurmasInscricoes[0];

          // Se filtrou por curso, mas o último curso do aluno não é o filtrado, retorne null
          if (
            cursoIdParam &&
            ultimaInscricao &&
            ultimaInscricao.CursosTurmas.Cursos.id !== parseInt(cursoIdParam)
          ) {
            ultimaInscricao = undefined;
          }

          // Se filtrou por turma, mas a última inscrição do aluno não é da turma filtrada, retorne null
          if (turmaIdParam && ultimaInscricao && ultimaInscricao.CursosTurmas.id !== turmaIdParam) {
            ultimaInscricao = undefined;
          }

          // Calcular progresso se houver inscrição
          let progresso = 0;
          if (ultimaInscricao) {
            progresso = await calcularProgressoCurso(
              ultimaInscricao.id,
              ultimaInscricao.CursosTurmas.id,
              ultimaInscricao.CursosTurmas.dataInicio,
              ultimaInscricao.CursosTurmas.dataFim,
            );
          }

        return {
          id: aluno.id,
          codigo: aluno.codUsuario,
          nomeCompleto: aluno.nomeCompleto,
          email: aluno.email,
          cpf: aluno.cpf,
          status: aluno.status,
          cidade: (aluno as any).UsuariosEnderecos?.[0]?.cidade || null,
          estado: (aluno as any).UsuariosEnderecos?.[0]?.estado || null,
          ultimoLogin: aluno.ultimoLogin,
          criadoEm: aluno.criadoEm,
            // Dados da última inscrição (curso mais recente)
            ultimoCurso: ultimaInscricao
              ? {
                  inscricaoId: ultimaInscricao.id,
                  statusInscricao: ultimaInscricao.status,
                  dataInscricao: ultimaInscricao.criadoEm,
                  progresso, // Percentual de 0 a 100
                  CursosTurmas: {
                    id: ultimaInscricao.CursosTurmas.id,
                    nome: ultimaInscricao.CursosTurmas.nome,
                    codigo: ultimaInscricao.CursosTurmas.codigo,
                    status: ultimaInscricao.CursosTurmas.status,
                  },
                  curso: {
                    id: ultimaInscricao.CursosTurmas.Cursos.id,
                    nome: ultimaInscricao.CursosTurmas.Cursos.nome,
                    codigo: ultimaInscricao.CursosTurmas.Cursos.codigo,
                  },
                }
              : null,
          };
        }),
      );

      res.json({
        data,
        pagination: {
          page,
          pageSize: limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      // Logging detalhado do erro
      logger.error('❌ Erro ao listar alunos:', {
        message: error?.message,
        code: error?.code,
        stack: error?.stack?.split('\n').slice(0, 3),
      });

      // Verificar se é erro de timeout
      if (error?.message?.includes('timeout')) {
        return res.status(504).json({
          success: false,
          code: 'QUERY_TIMEOUT',
          message: 'A consulta demorou muito tempo. Tente filtrar por cidade ou curso específico.',
          error: error?.message,
        });
      }

      // Verificar se é erro de conexão
      if (error?.message?.includes('database server') || error?.message?.includes('connection')) {
        return res.status(503).json({
          success: false,
          code: 'DATABASE_CONNECTION_ERROR',
          message:
            'Problema temporário de conexão com o banco de dados. Tente novamente em alguns segundos.',
          error: error?.message,
        });
      }

      // Erro genérico
      res.status(500).json({
        success: false,
        code: 'ALUNOS_LIST_ERROR',
        message: 'Erro ao listar alunos com inscrições',
        error: error?.message,
      });
    }
  };

  /**
   * Buscar detalhes completos de um aluno específico com TODAS as inscrições
   */
  static getAlunoById = async (req: Request, res: Response) => {
    try {
      const { alunoId } = req.params;

      // Validar UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(alunoId)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_ID',
          message: 'ID do aluno inválido. Deve ser um UUID válido.',
        });
      }

      // Buscar aluno com TODAS as inscrições
      const aluno = await retryOperation(
        async () => {
          return await prisma.usuarios.findUnique({
            where: {
              id: alunoId,
              role: 'ALUNO_CANDIDATO',
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
              UsuariosEnderecos: {
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
              CursosTurmasInscricoes: {
                select: {
                  id: true,
                  status: true,
                  criadoEm: true,
                  CursosTurmas: {
                    select: {
                      id: true,
                      nome: true,
                      codigo: true,
                      status: true,
                      dataInicio: true,
                      dataFim: true,
                      Cursos: {
                        select: {
                          id: true,
                          nome: true,
                          codigo: true,
                          descricao: true,
                          cargaHoraria: true,
                          imagemUrl: true,
                        },
                      },
                    },
                  },
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

      // Verificar se aluno existe
      if (!aluno) {
        return res.status(404).json({
          success: false,
          code: 'ALUNO_NOT_FOUND',
          message: 'Aluno não encontrado ou não possui role de ALUNO_CANDIDATO.',
        });
      }

      // Formatar resposta
      const response = {
        id: aluno.id,
        codigo: aluno.codUsuario,
        nomeCompleto: aluno.nomeCompleto,
        email: aluno.email,
        cpf: aluno.cpf,
        telefone: (aluno as any).UsuariosInformation?.telefone || null,
        status: aluno.status,
        genero: (aluno as any).UsuariosInformation?.genero || null,
        dataNasc: (aluno as any).UsuariosInformation?.dataNasc || null,
        descricao: (aluno as any).UsuariosInformation?.descricao || null,
        avatarUrl: (aluno as any).UsuariosInformation?.avatarUrl || null,
        criadoEm: aluno.criadoEm,
        atualizadoEm: aluno.atualizadoEm,
        ultimoLogin: aluno.ultimoLogin,
        enderecos: (aluno as any).UsuariosEnderecos || [],
        redesSociais: mapSocialLinks((aluno as any).UsuariosRedesSociais),
        inscricoes: await Promise.all(
          aluno.CursosTurmasInscricoes.map(async (inscricao) => {
            const progresso = await calcularProgressoCurso(
              inscricao.id,
              inscricao.CursosTurmas.id,
              inscricao.CursosTurmas.dataInicio,
              inscricao.CursosTurmas.dataFim,
            );

            return {
            id: inscricao.id,
            statusInscricao: inscricao.status,
            criadoEm: inscricao.criadoEm,
              progresso, // Percentual de 0 a 100
            turma: {
              id: inscricao.CursosTurmas.id,
              nome: inscricao.CursosTurmas.nome,
              codigo: inscricao.CursosTurmas.codigo,
              status: inscricao.CursosTurmas.status,
              dataInicio: inscricao.CursosTurmas.dataInicio,
              dataFim: inscricao.CursosTurmas.dataFim,
            },
            curso: {
              id: inscricao.CursosTurmas.Cursos.id,
              nome: inscricao.CursosTurmas.Cursos.nome,
              codigo: inscricao.CursosTurmas.Cursos.codigo,
              descricao: inscricao.CursosTurmas.Cursos.descricao,
              cargaHoraria: inscricao.CursosTurmas.Cursos.cargaHoraria,
              imagemUrl: inscricao.CursosTurmas.Cursos.imagemUrl,
            },
            };
          }),
        ),
          totalInscricoes: aluno.CursosTurmasInscricoes.length,
        estatisticas: {
          cursosAtivos: aluno.CursosTurmasInscricoes.filter((i) =>
            ['INSCRITO', 'EM_ANDAMENTO'].includes(i.status),
          ).length,
          cursosConcluidos: aluno.CursosTurmasInscricoes.filter((i) => i.status === 'CONCLUIDO').length,
          cursosCancelados: aluno.CursosTurmasInscricoes.filter((i) =>
            ['CANCELADO', 'TRANCADO'].includes(i.status),
          ).length,
        },
      };

      res.json({
        success: true,
        data: response,
      });
    } catch (error: any) {
      logger.error(
        {
          alunoId: req.params.alunoId,
          error: error?.message,
          code: error?.code,
        },
        '❌ Erro ao buscar detalhes do aluno',
      );

      res.status(500).json({
        success: false,
        code: 'ALUNO_FETCH_ERROR',
        message: 'Erro ao buscar detalhes do aluno',
        error: error?.message,
      });
    }
  };

  /**
   * Atualizar informações de um aluno específico (ADMIN/MODERADOR apenas)
   */
  static atualizarAlunoById = async (req: Request, res: Response) => {
    try {
      const { alunoId } = req.params;

      // Validar UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(alunoId)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_ID',
          message: 'ID do aluno inválido. Deve ser um UUID válido.',
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

      // Atualizar aluno com transação
      const alunoAtualizado = await retryOperation(
        async () => {
          return await prisma.$transaction(async (tx) => {
            // Verificar se aluno existe e é do tipo ALUNO_CANDIDATO
            const alunoExistente = await tx.usuarios.findUnique({
              where: { id: alunoId },
              select: {
                id: true,
                role: true,
                UsuariosInformation: true, // Buscar a relação completa
                UsuariosRedesSociais: true, // Buscar a relação completa
              },
            });

            if (!alunoExistente) {
              throw Object.assign(new Error('Aluno não encontrado'), {
                code: 'ALUNO_NOT_FOUND',
                statusCode: 404,
              });
            }

            if (alunoExistente.role !== 'ALUNO_CANDIDATO') {
              throw Object.assign(new Error('Usuário não é um aluno'), {
                code: 'INVALID_USER_TYPE',
                statusCode: 400,
              });
            }

            // Verificar se email já existe
            if (email !== undefined) {
              const emailJaExiste = await tx.usuarios.findFirst({
                where: {
                  email: email.trim().toLowerCase(),
                  id: { not: alunoId },
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
                where: { id: alunoId },
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
              if (alunoExistente.UsuariosInformation) {
                await tx.usuariosInformation.update({
                  where: { usuarioId: alunoId },
                  data: dadosInformacoes,
                });
              } else {
                await tx.usuariosInformation.create({
                  data: {
                    usuarioId: alunoId,
                    ...dadosInformacoes,
                  },
                });
              }
            }

            // Atualizar ou criar redes sociais
            if (redesSociaisUpdate) {
              if (alunoExistente.UsuariosRedesSociais) {
                await tx.usuariosRedesSociais.update({
                  where: { usuarioId: alunoId },
                  data: {
                    ...redesSociaisUpdate,
                    updatedAt: new Date(),
                  },
                });
              } else {
                await tx.usuariosRedesSociais.create({
                  data: {
                    usuarioId: alunoId,
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

              // Atualizar timestamp
              dadosEndereco.atualizadoEm = new Date();

              // Se tem algum campo preenchido, atualizar endereço
              if (Object.keys(dadosEndereco).length > 1) {
                // Buscar endereço mais recente do aluno
                const enderecoExistente = await tx.usuariosEnderecos.findFirst({
                  where: { usuarioId: alunoId },
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
                      usuarioId: alunoId,
                      ...dadosEndereco,
                    },
                  });
                }
              }
            }

            // Buscar dados completos atualizados
            const alunoCompleto = await tx.usuarios.findUnique({
              where: { id: alunoId },
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
                UsuariosEnderecos: {
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

            return alunoCompleto!;
          });
        },
        3,
        1500,
      );

      // Invalidar cache do usuário
      await invalidateUserCache(alunoAtualizado);

      logger.info(
        {
          alunoId,
          nomeCompleto: req.body.nomeCompleto,
          camposAtualizados: Object.keys(req.body).filter((k) => req.body[k] !== undefined),
        },
        '✅ Informações do aluno atualizadas com sucesso',
      );

      // Retornar resposta formatada
      const response = {
        id: alunoAtualizado.id,
        codigo: alunoAtualizado.codUsuario,
        nomeCompleto: alunoAtualizado.nomeCompleto,
        email: alunoAtualizado.email,
        cpf: alunoAtualizado.cpf,
        telefone: alunoAtualizado.UsuariosInformation?.telefone || null,
        status: alunoAtualizado.status,
        genero: alunoAtualizado.UsuariosInformation?.genero || null,
        dataNasc: alunoAtualizado.UsuariosInformation?.dataNasc || null,
        descricao: alunoAtualizado.UsuariosInformation?.descricao || null,
        avatarUrl: alunoAtualizado.UsuariosInformation?.avatarUrl || null,
        criadoEm: alunoAtualizado.criadoEm,
        atualizadoEm: alunoAtualizado.atualizadoEm,
        ultimoLogin: alunoAtualizado.ultimoLogin,
        enderecos: (alunoAtualizado as any).UsuariosEnderecos || [],
        redesSociais: mapSocialLinks(alunoAtualizado.UsuariosRedesSociais),
      };

      res.json({
        success: true,
        message: 'Informações do aluno atualizadas com sucesso',
        data: response,
      });
    } catch (error: any) {
      logger.error(
        {
          alunoId: req.params.alunoId,
          error: error?.message,
          code: error?.code,
        },
        '❌ Erro ao atualizar informações do aluno',
      );

      if (error?.code === 'ALUNO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ALUNO_NOT_FOUND',
          message: 'Aluno não encontrado ou não possui role de ALUNO_CANDIDATO.',
        });
      }

      if (error?.code === 'INVALID_USER_TYPE') {
        return res.status(400).json({
          success: false,
          code: 'INVALID_USER_TYPE',
          message: 'O usuário especificado não é um aluno.',
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
        code: 'ALUNO_UPDATE_ERROR',
        message: 'Erro ao atualizar informações do aluno',
        error: error?.message,
      });
    }
  };
}
