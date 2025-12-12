import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import type { Usuarios } from '@prisma/client';

const agendaLogger = logger.child({ module: 'AgendaService' });

type AgendaEvento = {
  id: string;
  tipo: 'AULA' | 'PROVA' | 'ANIVERSARIO' | 'TURMA_INICIO' | 'TURMA_FIM';
  titulo: string;
  dataInicio?: Date;
  dataFim?: Date;
  data?: Date; // Para aniversários
  cor: string;
  [key: string]: any;
};

/**
 * Service da agenda unificada
 */
export const agendaService = {
  /**
   * Buscar eventos da agenda
   */
  async getEventos(params: {
    usuarioId: string;
    role: string;
    dataInicio: Date;
    dataFim: Date;
    tipos?: string[];
  }): Promise<{ eventos: AgendaEvento[] }> {
    const eventos: AgendaEvento[] = [];
    const tipos = params.tipos || ['AULA', 'PROVA', 'ANIVERSARIO', 'TURMA'];

    // 1. AULAS AO VIVO
    if (tipos.includes('AULA')) {
      const aulas = await this.getAulasAgenda(params);
      eventos.push(...aulas);
    }

    // 2. PROVAS
    if (tipos.includes('PROVA')) {
      const provas = await this.getProvasAgenda(params);
      eventos.push(...provas);
    }

    // 3. ANIVERSÁRIOS
    if (tipos.includes('ANIVERSARIO')) {
      const aniversarios = await this.getAniversariosAgenda(params);
      eventos.push(...aniversarios);
    }

    // 4. INÍCIO/FIM DE TURMAS
    if (tipos.includes('TURMA')) {
      const turmas = await this.getTurmasAgenda(params);
      eventos.push(...turmas);
    }

    // Ordenar por data
    eventos.sort((a, b) => {
      const dataA = a.dataInicio || a.data || new Date(0);
      const dataB = b.dataInicio || b.data || new Date(0);
      return dataA.getTime() - dataB.getTime();
    });

    agendaLogger.info('[AGENDA] Eventos carregados', {
      usuarioId: params.usuarioId,
      total: eventos.length,
    });

    return { eventos };
  },

  /**
   * Buscar aulas ao vivo para agenda
   */
  async getAulasAgenda(params: {
    usuarioId: string;
    role: string;
    dataInicio: Date;
    dataFim: Date;
  }): Promise<AgendaEvento[]> {
    const where: any = {
      modalidade: { in: ['LIVE', 'SEMIPRESENCIAL'] },
      tipoLink: 'MEET',
      status: { in: ['PUBLICADA', 'EM_ANDAMENTO'] },
      dataInicio: {
        gte: params.dataInicio,
        lte: params.dataFim,
      },
      deletedAt: null,
    };

    // Filtrar por role
    if (params.role === 'INSTRUTOR') {
      where.CursosTurmas = {
        instrutorId: params.usuarioId,
      };
    } else if (params.role === 'ALUNO_CANDIDATO') {
      where.CursosTurmas = {
        CursosTurmasInscricoes: {
          some: {
            alunoId: params.usuarioId,
            status: 'INSCRITO',
          },
        },
      };
    }

    const aulas = await prisma.cursosTurmasAulas.findMany({
      where,
      include: {
        CursosTurmas: {
          select: { id: true, nome: true },
        },
      },
    });

    return aulas.map((a) => ({
      id: a.id,
      tipo: 'AULA' as const,
      titulo: a.nome,
      dataInicio: a.dataInicio || undefined,
      dataFim: a.dataFim || undefined,
      modalidade: a.modalidade,
      meetUrl: a.urlMeet,
      turma: {
        id: a.CursosTurmas?.id || '',
        nome: a.CursosTurmas?.nome || '',
      },
      cor: '#3b82f6', // Azul
    }));
  },

  /**
   * Buscar provas para agenda
   */
  async getProvasAgenda(params: {
    usuarioId: string;
    role: string;
    dataInicio: Date;
    dataFim: Date;
  }): Promise<AgendaEvento[]> {
    // TODO: Implementar quando tiver campo de data em CursosTurmasProvas
    agendaLogger.warn('[AGENDA] Provas não implementadas ainda');
    return [];
  },

  /**
   * Buscar aniversários para agenda (por role)
   */
  async getAniversariosAgenda(params: {
    usuarioId: string;
    role: string;
    dataInicio: Date;
    dataFim: Date;
  }): Promise<AgendaEvento[]> {
    const { usuarioId, role } = params;

    const where: any = {
      UsuariosInformation: {
        dataNasc: { not: null },
      },
    };

    // Regras de visibilidade por role
    switch (role) {
      case 'ADMIN':
      case 'MODERADOR':
        // Vê todos EXCETO alunos e empresas
        where.role = {
          notIn: ['ALUNO_CANDIDATO', 'EMPRESA'],
        };
        break;

      case 'PEDAGOGICO':
        // Vê próprio + instrutores
        where.OR = [{ id: usuarioId }, { role: 'INSTRUTOR' }];
        break;

      case 'INSTRUTOR':
        // Vê apenas próprio
        where.id = usuarioId;
        break;

      default:
        return []; // Outros não veem aniversários
    }

    const usuarios = await prisma.usuarios.findMany({
      where,
      select: {
        id: true,
        nomeCompleto: true,
        role: true,
        UsuariosInformation: {
          select: { dataNasc: true },
        },
      },
    });

    // Filtrar por mês/dia (ignorar ano)
    const mesInicio = params.dataInicio.getMonth() + 1;
    const diaInicio = params.dataInicio.getDate();
    const mesFim = params.dataFim.getMonth() + 1;
    const diaFim = params.dataFim.getDate();

    return usuarios
      .filter((u) => {
        if (!u.UsuariosInformation?.dataNasc) return false;
        const nasc = u.UsuariosInformation.dataNasc;
        const mes = nasc.getMonth() + 1;
        const dia = nasc.getDate();

        // Range de meses
        if (mesInicio === mesFim) {
          return mes === mesInicio && dia >= diaInicio && dia <= diaFim;
        } else {
          return (mes === mesInicio && dia >= diaInicio) || (mes === mesFim && dia <= diaFim);
        }
      })
      .map((u) => ({
        id: u.id,
        tipo: 'ANIVERSARIO' as const,
        titulo: `🎂 Aniversário: ${u.nomeCompleto}`,
        data: u.UsuariosInformation!.dataNasc || undefined,
        usuario: {
          id: u.id,
          nome: u.nomeCompleto,
          role: u.role,
        },
        cor: '#10b981', // Verde
      }));
  },

  /**
   * Buscar início/fim de turmas
   */
  async getTurmasAgenda(params: {
    usuarioId: string;
    role: string;
    dataInicio: Date;
    dataFim: Date;
  }): Promise<AgendaEvento[]> {
    const where: any = {
      OR: [
        {
          dataInicio: {
            gte: params.dataInicio,
            lte: params.dataFim,
          },
        },
        {
          dataFim: {
            gte: params.dataInicio,
            lte: params.dataFim,
          },
        },
      ],
    };

    // Filtrar por role
    if (params.role === 'INSTRUTOR') {
      where.instrutorId = params.usuarioId;
    } else if (params.role === 'ALUNO_CANDIDATO') {
      where.CursosTurmasInscricoes = {
        some: {
          alunoId: params.usuarioId,
          status: 'INSCRITO',
        },
      };
    }

    const turmas = await prisma.cursosTurmas.findMany({
      where,
      select: {
        id: true,
        nome: true,
        dataInicio: true,
        dataFim: true,
        Cursos: { select: { nome: true } },
      },
    });

    const eventos: AgendaEvento[] = [];

    for (const turma of turmas) {
      // Evento de início
      if (turma.dataInicio) {
        eventos.push({
          id: `turma-inicio-${turma.id}`,
          tipo: 'TURMA_INICIO',
          titulo: `🎓 Início: ${turma.nome}`,
          dataInicio: turma.dataInicio,
          dataFim: turma.dataInicio,
          turma: {
            id: turma.id,
            nome: turma.nome,
            curso: turma.Cursos.nome,
          },
          cor: '#8b5cf6', // Roxo
        });
      }

      // Evento de fim
      if (turma.dataFim) {
        eventos.push({
          id: `turma-fim-${turma.id}`,
          tipo: 'TURMA_FIM',
          titulo: `🏁 Conclusão: ${turma.nome}`,
          dataInicio: turma.dataFim,
          dataFim: turma.dataFim,
          turma: {
            id: turma.id,
            nome: turma.nome,
            curso: turma.Cursos.nome,
          },
          cor: '#6366f1', // Indigo
        });
      }
    }

    return eventos;
  },
};
