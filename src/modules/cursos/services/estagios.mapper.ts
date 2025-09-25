import { CursosEstagioDiaSemana, Prisma } from '@prisma/client';

export const estagioWithRelations = Prisma.validator<Prisma.CursosEstagiosDefaultArgs>()({
  include: {
    curso: {
      select: {
        id: true,
        nome: true,
        codigo: true,
        estagioObrigatorio: true,
      },
    },
    turma: {
      select: {
        id: true,
        nome: true,
        codigo: true,
      },
    },
    inscricao: {
      select: {
        id: true,
      },
    },
    aluno: {
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
      },
    },
    locais: {
      orderBy: { criadoEm: 'asc' },
    },
    confirmacao: true,
    criadoPor: {
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
      },
    },
    atualizadoPor: {
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
      },
    },
    notificacoes: {
      orderBy: { enviadoEm: 'desc' },
      take: 20,
    },
  },
});

export type EstagioWithRelations = Prisma.CursosEstagiosGetPayload<typeof estagioWithRelations>;

const translateWeekday = (value: CursosEstagioDiaSemana): string => {
  switch (value) {
    case 'DOMINGO':
      return 'Domingo';
    case 'SEGUNDA':
      return 'Segunda-feira';
    case 'TERCA':
      return 'Terça-feira';
    case 'QUARTA':
      return 'Quarta-feira';
    case 'QUINTA':
      return 'Quinta-feira';
    case 'SEXTA':
      return 'Sexta-feira';
    case 'SABADO':
      return 'Sábado';
    default:
      return value;
  }
};

const mapLocal = (local: EstagioWithRelations['locais'][number]) => ({
  id: local.id,
  titulo: local.titulo ?? null,
  empresaNome: local.empresaNome,
  empresaDocumento: local.empresaDocumento ?? null,
  contatoNome: local.contatoNome ?? null,
  contatoEmail: local.contatoEmail ?? null,
  contatoTelefone: local.contatoTelefone ?? null,
  dataInicio: local.dataInicio ? local.dataInicio.toISOString() : null,
  dataFim: local.dataFim ? local.dataFim.toISOString() : null,
  horarioInicio: local.horarioInicio ?? null,
  horarioFim: local.horarioFim ?? null,
  diasSemana: (local.diasSemana ?? []).map((dia) => ({
    codigo: dia,
    descricao: translateWeekday(dia),
  })),
  cargaHorariaSemanal: local.cargaHorariaSemanal ?? null,
  cep: local.cep ?? null,
  logradouro: local.logradouro ?? null,
  numero: local.numero ?? null,
  bairro: local.bairro ?? null,
  cidade: local.cidade ?? null,
  estado: local.estado ?? null,
  complemento: local.complemento ?? null,
  pontoReferencia: local.pontoReferencia ?? null,
  observacoes: local.observacoes ?? null,
  criadoEm: local.criadoEm.toISOString(),
  atualizadoEm: local.atualizadoEm.toISOString(),
});

export const mapEstagio = (
  estagio: EstagioWithRelations,
  {
    includeToken = false,
    includeNotificacoes = true,
  }: { includeToken?: boolean; includeNotificacoes?: boolean } = {},
) => ({
  id: estagio.id,
  cursoId: estagio.cursoId,
  turmaId: estagio.turmaId,
  inscricaoId: estagio.inscricaoId,
  aluno: {
    id: estagio.aluno.id,
    nome: estagio.aluno.nomeCompleto,
    email: estagio.aluno.email,
  },
  curso: {
    id: estagio.curso.id,
    nome: estagio.curso.nome,
    codigo: estagio.curso.codigo,
    estagioObrigatorio: estagio.curso.estagioObrigatorio,
  },
  turma: {
    id: estagio.turma.id,
    nome: estagio.turma.nome,
    codigo: estagio.turma.codigo,
  },
  nome: estagio.nome,
  descricao: estagio.descricao ?? null,
  obrigatorio: estagio.obrigatorio,
  status: estagio.status,
  dataInicio: estagio.dataInicio.toISOString(),
  dataFim: estagio.dataFim.toISOString(),
  cargaHoraria: estagio.cargaHoraria ?? null,
  empresaPrincipal: estagio.empresaPrincipal ?? null,
  observacoes: estagio.observacoes ?? null,
  confirmadoEm: estagio.confirmadoEm ? estagio.confirmadoEm.toISOString() : null,
  concluidoEm: estagio.concluidoEm ? estagio.concluidoEm.toISOString() : null,
  reprovadoEm: estagio.reprovadoEm ? estagio.reprovadoEm.toISOString() : null,
  reprovadoMotivo: estagio.reprovadoMotivo ?? null,
  ultimoAvisoEncerramento: estagio.ultimoAvisoEncerramento
    ? estagio.ultimoAvisoEncerramento.toISOString()
    : null,
  criadoEm: estagio.criadoEm.toISOString(),
  atualizadoEm: estagio.atualizadoEm.toISOString(),
  criadoPor: estagio.criadoPor
    ? {
        id: estagio.criadoPor.id,
        nome: estagio.criadoPor.nomeCompleto,
        email: estagio.criadoPor.email,
      }
    : null,
  atualizadoPor: estagio.atualizadoPor
    ? {
        id: estagio.atualizadoPor.id,
        nome: estagio.atualizadoPor.nomeCompleto,
        email: estagio.atualizadoPor.email,
      }
    : null,
  locais: estagio.locais.map(mapLocal),
  confirmacao: estagio.confirmacao
    ? {
        confirmadoEm: estagio.confirmacao.confirmadoEm
          ? estagio.confirmacao.confirmadoEm.toISOString()
          : null,
        protocolo: estagio.confirmacao.protocolo ?? null,
        token: includeToken ? estagio.confirmacao.token : undefined,
        registro: {
          ip: estagio.confirmacao.ip ?? null,
          userAgent: estagio.confirmacao.userAgent ?? null,
          deviceTipo: estagio.confirmacao.deviceTipo ?? null,
          deviceDescricao: estagio.confirmacao.deviceDescricao ?? null,
          deviceId: estagio.confirmacao.deviceId ?? null,
          sistemaOperacional: estagio.confirmacao.sistemaOperacional ?? null,
          navegador: estagio.confirmacao.navegador ?? null,
          localizacao: estagio.confirmacao.localizacao ?? null,
        },
      }
    : null,
  notificacoes:
    includeNotificacoes && estagio.notificacoes
      ? estagio.notificacoes.map((item) => ({
          id: item.id,
          tipo: item.tipo,
          canal: item.canal ?? null,
          enviadoPara: item.enviadoPara,
          enviadoEm: item.enviadoEm.toISOString(),
          detalhes: item.detalhes ?? null,
        }))
      : [],
});

export const translateDiasSemana = (dias: CursosEstagioDiaSemana[]) =>
  dias.map((dia) => translateWeekday(dia));
