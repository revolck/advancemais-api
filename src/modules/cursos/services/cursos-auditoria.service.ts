import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { AuditoriaCategoria } from '@prisma/client';
import { auditoriaService } from '@/modules/auditoria/services/auditoria.service';

const cursosAuditoriaLogger = logger.child({ module: 'CursosAuditoriaService' });

export interface CursoAuditoriaInput {
  cursoId: string;
  alteradoPor: string;
  campo: string;
  valorAnterior: any;
  valorNovo: any;
  descricao: string;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
}

export interface CursoAuditoriaItem {
  id: string;
  tipo: string;
  acao: string;
  campo?: string | null;
  valorAnterior?: any;
  valorNovo?: any;
  descricao: string;
  metadata?: Record<string, any> | null;
  criadoEm: Date;
  alteradoPor: {
    id: string;
    nomeCompleto: string;
    email: string;
    role: string;
  };
}

class CursosAuditoriaService {
  /**
   * Registra uma alteração no curso usando o sistema de auditoria geral
   */
  async registrarAlteracao(input: CursoAuditoriaInput): Promise<void> {
    try {
      await auditoriaService.registrarLog({
        categoria: AuditoriaCategoria.CURSO,
        tipo: 'CURSO_ALTERACAO',
        acao: 'CURSO_ATUALIZADO',
        usuarioId: input.alteradoPor,
        entidadeId: input.cursoId,
        entidadeTipo: 'CURSO',
        descricao: input.descricao,
        dadosAnteriores: {
          campo: input.campo,
          valor: input.valorAnterior,
        },
        dadosNovos: {
          campo: input.campo,
          valor: input.valorNovo,
        },
        metadata: {
          cursoId: input.cursoId,
          campo: input.campo,
          ...input.metadata,
        },
        ip: input.ip,
        userAgent: input.userAgent,
      });

      cursosAuditoriaLogger.info(
        { cursoId: input.cursoId, campo: input.campo, alteradoPor: input.alteradoPor },
        'Alteração de curso registrada na auditoria',
      );
    } catch (error) {
      cursosAuditoriaLogger.error(
        { err: error, input },
        'Erro ao registrar alteração de curso na auditoria',
      );
      // Não lançar erro para não quebrar o fluxo de atualização
    }
  }

  /**
   * Registra a criação de um curso
   */
  async registrarCriacaoCurso(
    cursoId: string,
    alteradoPor: string,
    dadosCurso: {
      nome: string;
      codigo?: string;
      cargaHoraria?: number;
    },
    ip?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      await auditoriaService.registrarLog({
        categoria: AuditoriaCategoria.CURSO,
        tipo: 'CURSO_CRIACAO',
        acao: 'CURSO_CRIADO',
        usuarioId: alteradoPor,
        entidadeId: cursoId,
        entidadeTipo: 'CURSO',
        descricao: `Curso criado: ${dadosCurso.nome}`,
        dadosNovos: {
          nome: dadosCurso.nome,
          codigo: dadosCurso.codigo,
          cargaHoraria: dadosCurso.cargaHoraria,
        },
        metadata: {
          cursoId,
          dadosIniciais: dadosCurso,
        },
        ip,
        userAgent,
      });

      cursosAuditoriaLogger.info(
        { cursoId, alteradoPor },
        'Criação de curso registrada na auditoria',
      );
    } catch (error) {
      cursosAuditoriaLogger.error(
        { err: error, cursoId, alteradoPor },
        'Erro ao registrar criação de curso na auditoria',
      );
    }
  }

  /**
   * Registra atualização de um campo específico do curso
   */
  async registrarAtualizacaoCurso(
    cursoId: string,
    alteradoPor: string,
    campo: string,
    valorAnterior: any,
    valorNovo: any,
    descricao: string,
    ip?: string,
    userAgent?: string,
  ): Promise<void> {
    return this.registrarAlteracao({
      cursoId,
      alteradoPor,
      campo,
      valorAnterior,
      valorNovo,
      descricao,
      ip,
      userAgent,
    });
  }

  /**
   * Obtém histórico de alterações de um curso
   */
  async obterHistoricoAlteracoes(
    cursoId: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<{
    items: CursoAuditoriaItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    try {
      const result = await auditoriaService.listarLogs({
        categoria: AuditoriaCategoria.CURSO,
        entidadeId: cursoId,
        entidadeTipo: 'CURSO',
        page,
        pageSize,
      });

      // Mapear para o formato esperado
      const items: CursoAuditoriaItem[] = result.items.map((log) => ({
        id: log.id,
        tipo: log.tipo,
        acao: log.acao,
        campo: log.dadosAnteriores?.campo || log.dadosNovos?.campo || null,
        valorAnterior: log.dadosAnteriores?.valor,
        valorNovo: log.dadosNovos?.valor,
        descricao: log.descricao,
        metadata: log.metadata || null,
        criadoEm: log.criadoEm,
        alteradoPor: log.usuario
          ? {
              id: log.usuario.id,
              nomeCompleto: log.usuario.nomeCompleto,
              email: log.usuario.email,
              role: log.usuario.role,
            }
          : {
              id: log.usuarioId || 'unknown',
              nomeCompleto: 'Usuário não encontrado',
              email: '',
              role: 'UNKNOWN',
            },
      }));

      return {
        items,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      };
    } catch (error) {
      cursosAuditoriaLogger.error(
        { err: error, cursoId },
        'Erro ao obter histórico de alterações do curso',
      );
      throw error;
    }
  }

  /**
   * Formata descrição de alteração para exibição
   */
  formatarDescricaoAlteracao(item: CursoAuditoriaItem): string {
    const dataFormatada = item.criadoEm.toLocaleDateString('pt-BR');
    const horaFormatada = item.criadoEm.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const nomeUsuario = item.alteradoPor.nomeCompleto;

    if (item.campo && item.valorAnterior !== undefined && item.valorNovo !== undefined) {
      return `${nomeUsuario} alterou ${item.campo} de "${item.valorAnterior || 'vazio'}" para "${item.valorNovo || 'vazio'}" em ${dataFormatada} às ${horaFormatada}`;
    }

    return `${nomeUsuario} ${item.descricao} em ${dataFormatada} às ${horaFormatada}`;
  }
}

export const cursosAuditoriaService = new CursosAuditoriaService();
