import {
  Prisma,
  CuponsAplicarEm,
  CuponsLimiteUso,
  CuponsLimiteUsuario,
  CuponsPeriodo,
  CuponsTipoDesconto,
} from '@prisma/client';

import { prisma } from '@/config/prisma';
import {
  CreateCupomDescontoInput,
  UpdateCupomDescontoInput,
  createCupomDescontoSchema,
} from '@/modules/cupons/validators/cupons.schema';

const cupomInclude = {
  cursos: {
    include: {
      curso: {
        select: {
          id: true,
          codigo: true,
          nome: true,
        },
      },
    },
  },
  planos: {
    include: {
      plano: {
        select: {
          id: true,
          nome: true,
        },
      },
    },
  },
  criadoPor: {
    select: {
      id: true,
      nomeCompleto: true,
      email: true,
      role: true,
    },
  },
} satisfies Prisma.CuponsDescontoInclude;

type CupomWithRelations = Prisma.CuponsDescontoGetPayload<{ include: typeof cupomInclude }>;

export class CupomNaoEncontradoError extends Error {
  constructor() {
    super('Cupom de desconto não encontrado');
    this.name = 'CupomNaoEncontradoError';
  }
}

const sanitizeCodigo = (codigo: string) => codigo.trim().toUpperCase();

const decimalFromNumber = (value: number | undefined, scale = 2) => {
  if (value === undefined) {
    return null;
  }

  return new Prisma.Decimal(value.toFixed(scale));
};

const transformCupom = (cupom: CupomWithRelations) => ({
  id: cupom.id,
  codigo: cupom.codigo,
  descricao: cupom.descricao,
  tipoDesconto: cupom.tipoDesconto,
  valorPercentual: cupom.valorPorcentagem ? Number(cupom.valorPorcentagem) : null,
  valorFixo: cupom.valorFixo ? Number(cupom.valorFixo) : null,
  aplicarEm: cupom.aplicarEm,
  aplicarEmTodosItens: cupom.aplicarEmTodosItens,
  limiteUsoTotalTipo: cupom.limiteUsoTotalTipo,
  limiteUsoTotalQuantidade: cupom.limiteUsoTotalQuantidade,
  limitePorUsuarioTipo: cupom.limitePorUsuarioTipo,
  limitePorUsuarioQuantidade: cupom.limitePorUsuarioQuantidade,
  periodoTipo: cupom.periodoTipo,
  periodoInicio: cupom.periodoInicio,
  periodoFim: cupom.periodoFim,
  usosTotais: cupom.usosTotais,
  ativo: cupom.ativo,
  criadoEm: cupom.criadoEm,
  atualizadoEm: cupom.atualizadoEm,
  criadoPor: cupom.criadoPor,
  cursosAplicados:
    cupom.cursos?.map((item) => ({
      cursoId: item.cursoId,
      codigo: item.curso?.codigo ?? null,
      nome: item.curso?.nome ?? null,
    })) ?? [],
  planosAplicados:
    cupom.planos?.map((item) => ({
      planoId: item.planoId,
      nome: item.plano?.nome ?? null,
    })) ?? [],
});

const resolveAplicarTodos = (
  aplicarEm: CuponsAplicarEm,
  aplicarEmTodosItens?: boolean,
): boolean => {
  if (aplicarEm === CuponsAplicarEm.TODA_PLATAFORMA) {
    return true;
  }

  return aplicarEmTodosItens ?? false;
};

const ensurePrimeiraCompraQuantidade = (
  tipo: CuponsLimiteUsuario,
  quantidade?: number,
): number | undefined => {
  if (tipo === CuponsLimiteUsuario.PRIMEIRA_COMPRA) {
    return 1;
  }

  return quantidade;
};

const ensurePeriodoValores = (
  periodoTipo: CuponsPeriodo,
  periodoInicio?: Date,
  periodoFim?: Date,
): { inicio: Date | null; fim: Date | null } => {
  if (periodoTipo === CuponsPeriodo.PERIODO) {
    return {
      inicio: periodoInicio ?? null,
      fim: periodoFim ?? null,
    };
  }

  return { inicio: null, fim: null };
};

const carregarCupom = async (id: string) => {
  const cupom = await prisma.cuponsDesconto.findUnique({
    where: { id },
    include: {
      cursos: true,
      planos: true,
    },
  });

  return cupom;
};

export const cuponsService = {
  list: async () => {
    const cupons = await prisma.cuponsDesconto.findMany({
      orderBy: { criadoEm: 'desc' },
      include: cupomInclude,
    });

    return cupons.map(transformCupom);
  },

  get: async (id: string) => {
    const cupom = await prisma.cuponsDesconto.findUnique({
      where: { id },
      include: cupomInclude,
    });

    return cupom ? transformCupom(cupom) : null;
  },

  create: async (data: CreateCupomDescontoInput, criadoPorId: string) => {
    const aplicarEmTodos = resolveAplicarTodos(data.aplicarEm, data.aplicarEmTodosItens);

    const parsed = createCupomDescontoSchema.parse({
      ...data,
      codigo: data.codigo,
      aplicarEmTodosItens: aplicarEmTodos,
    });

    const periodoValores = ensurePeriodoValores(
      parsed.periodoTipo,
      parsed.periodoInicio,
      parsed.periodoFim,
    );

    const cupom = await prisma.$transaction(async (tx) => {
      const created = await tx.cuponsDesconto.create({
        data: {
          codigo: sanitizeCodigo(parsed.codigo),
          descricao: parsed.descricao ?? null,
          tipoDesconto: parsed.tipoDesconto,
          valorPorcentagem:
            parsed.tipoDesconto === CuponsTipoDesconto.PORCENTAGEM
              ? decimalFromNumber(parsed.valorPercentual)
              : null,
          valorFixo:
            parsed.tipoDesconto === CuponsTipoDesconto.VALOR_FIXO
              ? decimalFromNumber(parsed.valorFixo)
              : null,
          aplicarEm: parsed.aplicarEm,
          aplicarEmTodosItens: aplicarEmTodos,
          limiteUsoTotalTipo: parsed.limiteUsoTotalTipo,
          limiteUsoTotalQuantidade:
            parsed.limiteUsoTotalTipo === CuponsLimiteUso.LIMITADO
              ? (parsed.limiteUsoTotalQuantidade ?? null)
              : null,
          limitePorUsuarioTipo: parsed.limitePorUsuarioTipo,
          limitePorUsuarioQuantidade:
            ensurePrimeiraCompraQuantidade(
              parsed.limitePorUsuarioTipo,
              parsed.limitePorUsuarioQuantidade,
            ) ?? null,
          periodoTipo: parsed.periodoTipo,
          periodoInicio: periodoValores.inicio,
          periodoFim: periodoValores.fim,
          ativo: parsed.ativo ?? true,
          criadoPorId,
        },
      });

      if (parsed.aplicarEm === CuponsAplicarEm.APENAS_CURSOS && !aplicarEmTodos) {
        await tx.cuponsDescontoCursos.createMany({
          data: parsed.cursosIds!.map((cursoId) => ({
            cupomId: created.id,
            cursoId,
          })),
          skipDuplicates: true,
        });
      }

      if (parsed.aplicarEm === CuponsAplicarEm.APENAS_ASSINATURA && !aplicarEmTodos) {
        await tx.cuponsDescontoPlanos.createMany({
          data: parsed.planosIds!.map((planoId) => ({
            cupomId: created.id,
            planoId,
          })),
          skipDuplicates: true,
        });
      }

      return created.id;
    });

    const createdCupom = await prisma.cuponsDesconto.findUniqueOrThrow({
      where: { id: cupom },
      include: cupomInclude,
    });

    return transformCupom(createdCupom);
  },

  update: async (id: string, data: UpdateCupomDescontoInput) => {
    const existente = await carregarCupom(id);

    if (!existente) {
      throw new CupomNaoEncontradoError();
    }

    const tipoDescontoFinal = data.tipoDesconto ?? existente.tipoDesconto;
    const aplicarEmFinal = data.aplicarEm ?? existente.aplicarEm;
    const aplicarTodosSource =
      data.aplicarEmTodosItens !== undefined
        ? data.aplicarEmTodosItens
        : data.aplicarEm !== undefined
          ? undefined
          : existente.aplicarEmTodosItens;
    const aplicarEmTodosFinal = resolveAplicarTodos(aplicarEmFinal, aplicarTodosSource);
    const limiteUsoTotalTipoFinal = data.limiteUsoTotalTipo ?? existente.limiteUsoTotalTipo;
    const limitePorUsuarioTipoFinal = data.limitePorUsuarioTipo ?? existente.limitePorUsuarioTipo;
    const periodoTipoFinal = data.periodoTipo ?? existente.periodoTipo;

    const cursosIdsFinais = data.cursosIds ?? existente.cursos.map((curso) => curso.cursoId);
    const planosIdsFinais = data.planosIds ?? existente.planos.map((plano) => plano.planoId);

    const valorPercentualFinal =
      tipoDescontoFinal === CuponsTipoDesconto.PORCENTAGEM
        ? (data.valorPercentual ??
          (existente.valorPorcentagem ? Number(existente.valorPorcentagem) : undefined))
        : undefined;
    const valorFixoFinal =
      tipoDescontoFinal === CuponsTipoDesconto.VALOR_FIXO
        ? (data.valorFixo ?? (existente.valorFixo ? Number(existente.valorFixo) : undefined))
        : undefined;

    const limiteUsoTotalQuantidadeFinal =
      limiteUsoTotalTipoFinal === CuponsLimiteUso.LIMITADO
        ? (data.limiteUsoTotalQuantidade ?? existente.limiteUsoTotalQuantidade ?? undefined)
        : undefined;

    const limitePorUsuarioQuantidadeFinal = ensurePrimeiraCompraQuantidade(
      limitePorUsuarioTipoFinal,
      data.limitePorUsuarioQuantidade ?? existente.limitePorUsuarioQuantidade ?? undefined,
    );

    const periodoInicioFinal =
      periodoTipoFinal === CuponsPeriodo.PERIODO
        ? (data.periodoInicio ?? existente.periodoInicio ?? undefined)
        : undefined;
    const periodoFimFinal =
      periodoTipoFinal === CuponsPeriodo.PERIODO
        ? (data.periodoFim ?? existente.periodoFim ?? undefined)
        : undefined;

    createCupomDescontoSchema.parse({
      codigo: data.codigo ?? existente.codigo,
      descricao: data.descricao === undefined ? (existente.descricao ?? undefined) : data.descricao,
      tipoDesconto: tipoDescontoFinal,
      valorPercentual: valorPercentualFinal,
      valorFixo: valorFixoFinal,
      aplicarEm: aplicarEmFinal,
      aplicarEmTodosItens: aplicarEmTodosFinal,
      cursosIds:
        aplicarEmFinal === CuponsAplicarEm.APENAS_CURSOS && !aplicarEmTodosFinal
          ? cursosIdsFinais
          : undefined,
      planosIds:
        aplicarEmFinal === CuponsAplicarEm.APENAS_ASSINATURA && !aplicarEmTodosFinal
          ? planosIdsFinais
          : undefined,
      limiteUsoTotalTipo: limiteUsoTotalTipoFinal,
      limiteUsoTotalQuantidade: limiteUsoTotalQuantidadeFinal,
      limitePorUsuarioTipo: limitePorUsuarioTipoFinal,
      limitePorUsuarioQuantidade: limitePorUsuarioQuantidadeFinal,
      periodoTipo: periodoTipoFinal,
      periodoInicio: periodoInicioFinal,
      periodoFim: periodoFimFinal,
      ativo: data.ativo ?? existente.ativo,
    });

    const periodoValores = ensurePeriodoValores(
      periodoTipoFinal,
      periodoInicioFinal,
      periodoFimFinal,
    );

    await prisma.$transaction(async (tx) => {
      await tx.cuponsDesconto.update({
        where: { id },
        data: {
          codigo: data.codigo ? sanitizeCodigo(data.codigo) : undefined,
          descricao: data.descricao === undefined ? undefined : (data.descricao ?? null),
          tipoDesconto: { set: tipoDescontoFinal },
          valorPorcentagem:
            tipoDescontoFinal === CuponsTipoDesconto.PORCENTAGEM
              ? decimalFromNumber(valorPercentualFinal)
              : null,
          valorFixo:
            tipoDescontoFinal === CuponsTipoDesconto.VALOR_FIXO
              ? decimalFromNumber(valorFixoFinal)
              : null,
          aplicarEm: { set: aplicarEmFinal },
          aplicarEmTodosItens: aplicarEmTodosFinal,
          limiteUsoTotalTipo: { set: limiteUsoTotalTipoFinal },
          limiteUsoTotalQuantidade:
            limiteUsoTotalTipoFinal === CuponsLimiteUso.LIMITADO
              ? (limiteUsoTotalQuantidadeFinal ?? null)
              : null,
          limitePorUsuarioTipo: { set: limitePorUsuarioTipoFinal },
          limitePorUsuarioQuantidade:
            limitePorUsuarioTipoFinal === CuponsLimiteUsuario.PRIMEIRA_COMPRA
              ? 1
              : (limitePorUsuarioQuantidadeFinal ?? null),
          periodoTipo: { set: periodoTipoFinal },
          periodoInicio: periodoValores.inicio,
          periodoFim: periodoValores.fim,
          ativo: data.ativo ?? undefined,
        },
      });

      await tx.cuponsDescontoCursos.deleteMany({ where: { cupomId: id } });
      await tx.cuponsDescontoPlanos.deleteMany({ where: { cupomId: id } });

      if (aplicarEmFinal === CuponsAplicarEm.APENAS_CURSOS && !aplicarEmTodosFinal) {
        await tx.cuponsDescontoCursos.createMany({
          data: cursosIdsFinais.map((cursoId) => ({ cupomId: id, cursoId })),
          skipDuplicates: true,
        });
      }

      if (aplicarEmFinal === CuponsAplicarEm.APENAS_ASSINATURA && !aplicarEmTodosFinal) {
        await tx.cuponsDescontoPlanos.createMany({
          data: planosIdsFinais.map((planoId) => ({ cupomId: id, planoId })),
          skipDuplicates: true,
        });
      }
    });

    const cupomAtualizado = await prisma.cuponsDesconto.findUniqueOrThrow({
      where: { id },
      include: cupomInclude,
    });

    return transformCupom(cupomAtualizado);
  },

  remove: async (id: string) => {
    await prisma.cuponsDesconto.delete({ where: { id } });
  },
};
