import { CursosEstagioDiaSemana, Prisma } from '@prisma/client';

export const estagioWithRelations = Prisma.validator<Prisma.CursosEstagiosDefaultArgs>()({
  include: {
    Cursos: {
      select: {
        id: true,
        nome: true,
        codigo: true,
        estagioObrigatorio: true,
      },
    },
    CursosTurmas: {
      select: {
        id: true,
        nome: true,
        codigo: true,
      },
    },
    CursosTurmasInscricoes: {
      select: {
        id: true,
      },
    },
    Usuarios_CursosEstagios_alunoIdToUsuarios: {
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
      },
    },
    CursosEstagiosLocais: {
      orderBy: { criadoEm: 'asc' },
    },
    CursosEstagiosConfirmacoes: true,
    Usuarios_CursosEstagios_criadoPorIdToUsuarios: {
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
      },
    },
    Usuarios_CursosEstagios_atualizadoPorIdToUsuarios: {
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
      },
    },
    CursosEstagiosNotificacoes: {
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

const mapLocal = (local: EstagioWithRelations['CursosEstagiosLocais'][number]) => ({
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
    id: estagio.Usuarios_CursosEstagios_alunoIdToUsuarios.id,
    nome: estagio.Usuarios_CursosEstagios_alunoIdToUsuarios.nomeCompleto,
    email: estagio.Usuarios_CursosEstagios_alunoIdToUsuarios.email,
  },
  curso: {
    id: estagio.Cursos.id,
    nome: estagio.Cursos.nome,
    codigo: estagio.Cursos.codigo,
    estagioObrigatorio: estagio.Cursos.estagioObrigatorio,
  },
  turma: {
    id: estagio.CursosTurmas.id,
    nome: estagio.CursosTurmas.nome,
    codigo: estagio.CursosTurmas.codigo,
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
  criadoPor: estagio.Usuarios_CursosEstagios_criadoPorIdToUsuarios
    ? {
        id: estagio.Usuarios_CursosEstagios_criadoPorIdToUsuarios.id,
        nome: estagio.Usuarios_CursosEstagios_criadoPorIdToUsuarios.nomeCompleto,
        email: estagio.Usuarios_CursosEstagios_criadoPorIdToUsuarios.email,
      }
    : null,
  atualizadoPor: estagio.Usuarios_CursosEstagios_atualizadoPorIdToUsuarios
    ? {
        id: estagio.Usuarios_CursosEstagios_atualizadoPorIdToUsuarios.id,
        nome: estagio.Usuarios_CursosEstagios_atualizadoPorIdToUsuarios.nomeCompleto,
        email: estagio.Usuarios_CursosEstagios_atualizadoPorIdToUsuarios.email,
      }
    : null,
  locais: estagio.CursosEstagiosLocais.map(mapLocal),
  confirmacao: estagio.CursosEstagiosConfirmacoes
    ? {
        confirmadoEm: estagio.CursosEstagiosConfirmacoes.confirmadoEm
          ? estagio.CursosEstagiosConfirmacoes.confirmadoEm.toISOString()
          : null,
        protocolo: estagio.CursosEstagiosConfirmacoes.protocolo ?? null,
        token: includeToken ? estagio.CursosEstagiosConfirmacoes.token : undefined,
        registro: {
          ip: estagio.CursosEstagiosConfirmacoes.ip ?? null,
          userAgent: estagio.CursosEstagiosConfirmacoes.userAgent ?? null,
          deviceTipo: estagio.CursosEstagiosConfirmacoes.deviceTipo ?? null,
          deviceDescricao: estagio.CursosEstagiosConfirmacoes.deviceDescricao ?? null,
          deviceId: estagio.CursosEstagiosConfirmacoes.deviceId ?? null,
          sistemaOperacional: estagio.CursosEstagiosConfirmacoes.sistemaOperacional ?? null,
          navegador: estagio.CursosEstagiosConfirmacoes.navegador ?? null,
          localizacao: estagio.CursosEstagiosConfirmacoes.localizacao ?? null,
        },
      }
    : null,
  notificacoes:
    includeNotificacoes && estagio.CursosEstagiosNotificacoes
      ? estagio.CursosEstagiosNotificacoes.map((item) => ({
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
