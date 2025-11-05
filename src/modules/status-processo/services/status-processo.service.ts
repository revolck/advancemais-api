import { PrismaClient } from '@prisma/client';
import {
  CreateStatusProcessoInput,
  UpdateStatusProcessoInput,
  StatusProcessoFilters,
} from '../types/status-processo.types';

export class StatusProcessoService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Garante que apenas 1 status seja padrão por vez
   * Remove o padrão anterior quando um novo é definido
   */
  private async ensureSingleDefault() {
    const defaultCount = await this.prisma.status_processo.count({
      where: { isDefault: true },
    });

    if (defaultCount > 1) {
      // Se há mais de 1 padrão, manter apenas o mais recente
      const latestDefault = await this.prisma.status_processo.findFirst({
        where: { isDefault: true },
        orderBy: { criadoEm: 'desc' },
      });

      if (latestDefault) {
        await this.prisma.status_processo.updateMany({
          where: {
            isDefault: true,
            id: { not: latestDefault.id },
          },
          data: { isDefault: false },
        });
      }
    }
  }

  async list(filters: StatusProcessoFilters = {}) {
    const { page = 1, pageSize = 20, ativo, search, sortBy, sortOrder } = filters;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (ativo !== undefined) {
      where.ativo = ativo;
    }

    if (search) {
      where.OR = [
        { nome: { contains: search, mode: 'insensitive' } },
        { descricao: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Monta ordenação dinamicamente com campos permitidos
    const allowedSortFields: (keyof any)[] = ['nome', 'criadoEm', 'atualizadoEm'];

    const orderBy: any[] = [];
    if (sortBy && (allowedSortFields as string[]).includes(sortBy)) {
      orderBy.push({ [sortBy]: sortOrder === 'desc' ? 'desc' : 'asc' });
      // Adiciona um segundo critério estável
      if (sortBy !== 'nome') orderBy.push({ nome: 'asc' });
    } else {
      orderBy.push({ nome: 'asc' });
    }

    const [status, total] = await Promise.all([
      this.prisma.status_processo.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          Usuarios: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.status_processo.count({ where }),
    ]);

    return {
      data: status,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getById(id: string) {
    const status = await this.prisma.status_processo.findUnique({
      where: { id },
      include: {
          Usuarios: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
      },
    });

    if (!status) {
      throw new Error('Status não encontrado.');
    }

    return status;
  }

  async create(data: CreateStatusProcessoInput, criadoPor: string) {
    // Se este status será o padrão, remover o padrão anterior
    // Garantir que apenas 1 status seja padrão por vez
    if (data.isDefault) {
      await this.prisma.status_processo.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const status = await this.prisma.status_processo.create({
      data: {
        ...data,
        criadoPor,
      },
      include: {
          Usuarios: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
      },
    });

    // Garantir que apenas 1 status seja padrão após a criação
    await this.ensureSingleDefault();

    return status;
  }

  async update(id: string, data: UpdateStatusProcessoInput) {
    const existingStatus = await this.prisma.status_processo.findUnique({
      where: { id },
    });

    if (!existingStatus) {
      throw new Error('Status não encontrado.');
    }

    // Se este status será o padrão, remover o padrão anterior
    // Garantir que apenas 1 status seja padrão por vez
    if (data.isDefault) {
      await this.prisma.status_processo.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const status = await this.prisma.status_processo.update({
      where: { id },
      data,
      include: {
          Usuarios: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
      },
    });

    // Garantir que apenas 1 status seja padrão após a atualização
    await this.ensureSingleDefault();

    return status;
  }

  async delete(id: string) {
    const existingStatus = await this.prisma.status_processo.findUnique({
      where: { id },
    });

    if (!existingStatus) {
      throw new Error('Status não encontrado.');
    }

    // Verificar se o status está sendo usado em candidaturas
    const [candidaturasCount, processosCount] = await Promise.all([
      this.prisma.empresasCandidatos.count({
        where: { statusId: id },
      }),
      this.prisma.empresasVagasProcesso.count({
        where: { statusId: id },
      }),
    ]);

    if (candidaturasCount > 0 || processosCount > 0) {
      throw new Error(
        'Não é possível remover este status pois existem candidaturas ou processos utilizando-o.',
      );
    }

    await this.prisma.status_processo.delete({
      where: { id },
    });
  }

  async getDefault() {
    const status = await this.prisma.status_processo.findFirst({
      where: { isDefault: true, ativo: true },
      include: {
          Usuarios: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
      },
    });

    if (!status) {
      throw new Error('Nenhum status padrão encontrado.');
    }

    return status;
  }

  async getAllActive() {
    const status = await this.prisma.status_processo.findMany({
      where: { ativo: true },
      orderBy: [{ nome: 'asc' }],
      include: {
          Usuarios: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
      },
    });

    return status;
  }
}
