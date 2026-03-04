import { Prisma } from '@prisma/client';

const certificadoWithRelations = Prisma.validator<Prisma.CursosCertificadosEmitidosDefaultArgs>()({
  include: {
    Usuarios: {
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
      },
    },
    CursosTurmasInscricoes: {
      select: {
        id: true,
        codigo: true,
        Usuarios: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            cpf: true,
            UsuariosInformation: {
              select: {
                inscricao: true,
                avatarUrl: true,
              },
            },
          },
        },
        CursosTurmas: {
          select: {
            id: true,
            nome: true,
            codigo: true,
            dataInicio: true,
            dataFim: true,
            Cursos: {
              select: {
                id: true,
                nome: true,
                codigo: true,
                cargaHoraria: true,
              },
            },
          },
        },
      },
    },
    CursosCertificadosLogs: {
      orderBy: { criadoEm: 'desc' },
    },
    CursosCertificadosConteudoProgramatico: {
      select: {
        id: true,
        conteudo: true,
        atualizadoEm: true,
      },
    },
  },
});

export type CertificadoWithRelations = Prisma.CursosCertificadosEmitidosGetPayload<
  typeof certificadoWithRelations
>;

const digitsOnly = (value?: string | null) => value?.replace(/\D/g, '') ?? '';

const formatCpf = (cpf?: string | null) => {
  const digits = digitsOnly(cpf);
  if (digits.length !== 11) {
    return cpf ?? null;
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const maskCpfValue = (cpf?: string | null) => {
  const digits = digitsOnly(cpf);
  if (digits.length !== 11) {
    return cpf ?? null;
  }

  return `***.***.***-${digits.slice(-2)}`;
};

const formatDateTimePtBr = (value: Date) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Sao_Paulo',
  }).format(value);

export const mapCertificado = (
  certificado: CertificadoWithRelations,
  { maskCpf = false, includeLogs = true }: { maskCpf?: boolean; includeLogs?: boolean } = {},
) => {
  const formattedCpf = formatCpf(certificado.alunoCpf);
  const maskedCpf = maskCpfValue(certificado.alunoCpf);

  return {
    id: certificado.id,
    codigo: certificado.codigo,
    codigoDisplay: `N° Cert. ${certificado.codigo}`,
    tipo: certificado.tipo,
    formato: certificado.formato,
    cargaHoraria: certificado.cargaHoraria,
    assinaturaUrl: certificado.assinaturaUrl,
    emitidoEm: certificado.emitidoEm,
    emitidoEmDisplay: `Emitido em ${formatDateTimePtBr(certificado.emitidoEm).replace(',', ' às')}`,
    observacoes: certificado.observacoes,
    aluno: {
      id: certificado.CursosTurmasInscricoes.Usuarios.id,
      nome: certificado.CursosTurmasInscricoes.Usuarios.nomeCompleto,
      email: certificado.CursosTurmasInscricoes.Usuarios.email,
      cpf: maskCpf ? null : formattedCpf,
      cpfMascarado: maskedCpf,
      inscricao: certificado.CursosTurmasInscricoes.Usuarios.UsuariosInformation?.inscricao ?? null,
    },
    curso: {
      id: certificado.CursosTurmasInscricoes.CursosTurmas.Cursos.id,
      nome: certificado.CursosTurmasInscricoes.CursosTurmas.Cursos.nome,
      codigo: certificado.CursosTurmasInscricoes.CursosTurmas.Cursos.codigo,
      cargaHoraria: certificado.cargaHoraria,
    },
    turma: {
      id: certificado.CursosTurmasInscricoes.CursosTurmas.id,
      nome: certificado.CursosTurmasInscricoes.CursosTurmas.nome,
      codigo: certificado.CursosTurmasInscricoes.CursosTurmas.codigo,
    },
    emitidoPor: certificado.Usuarios
      ? {
          id: certificado.Usuarios.id,
          nome: certificado.Usuarios.nomeCompleto,
          email: certificado.Usuarios.email,
        }
      : null,
    conteudoProgramatico: certificado.CursosCertificadosConteudoProgramatico?.conteudo ?? null,
    conteudoProgramaticoAtualizadoEm:
      certificado.CursosCertificadosConteudoProgramatico?.atualizadoEm ?? null,
    logs:
      includeLogs && certificado.CursosCertificadosLogs
        ? certificado.CursosCertificadosLogs.map((log: any) => ({
            id: log.id,
            acao: log.acao,
            formato: log.formato,
            detalhes: log.detalhes,
            criadoEm: log.criadoEm,
          }))
        : [],
  };
};

const getNumeroFromCodigo = (codigo: string) => {
  const numeric = codigo.replace(/\D/g, '');
  if (!numeric) return codigo;
  return numeric.slice(-6).padStart(6, '0');
};

type MapCertificadoDashboardOptions = {
  maskCpf?: boolean;
  pdfUrl?: string | null;
  previewUrl?: string | null;
};

export const mapCertificadoDashboard = (
  certificado: CertificadoWithRelations,
  options: MapCertificadoDashboardOptions = {},
) => {
  const formattedCpf = formatCpf(certificado.alunoCpf);
  const maskedCpf = maskCpfValue(certificado.alunoCpf);
  const cpfValue = options.maskCpf ? maskedCpf : formattedCpf;
  const matricula =
    certificado.CursosTurmasInscricoes.Usuarios.UsuariosInformation?.inscricao ??
    certificado.CursosTurmasInscricoes.codigo ??
    null;

  return {
    id: certificado.id,
    codigo: certificado.codigo,
    codigoDisplay: `N° Cert. ${certificado.codigo}`,
    numero: getNumeroFromCodigo(certificado.codigo),
    status: 'EMITIDO',
    emitidoEm: certificado.emitidoEm.toISOString(),
    emitidoEmDisplay: `Emitido em ${formatDateTimePtBr(certificado.emitidoEm).replace(',', ' às')}`,
    tipo: certificado.tipo,
    formato: certificado.formato,
    cargaHoraria: certificado.cargaHoraria,
    assinaturaUrl: certificado.assinaturaUrl,
    observacoes: certificado.observacoes,
    modelo: {
      id: 'advance-plus-v1',
      nome: 'Modelo Advance+ Oficial',
    },
    cursoId: certificado.CursosTurmasInscricoes.CursosTurmas.Cursos.id,
    cursoNome: certificado.CursosTurmasInscricoes.CursosTurmas.Cursos.nome,
    curso: {
      id: certificado.CursosTurmasInscricoes.CursosTurmas.Cursos.id,
      nome: certificado.CursosTurmasInscricoes.CursosTurmas.Cursos.nome,
    },
    turmaId: certificado.CursosTurmasInscricoes.CursosTurmas.id,
    turmaNome: certificado.CursosTurmasInscricoes.CursosTurmas.nome,
    turmaCodigo: certificado.CursosTurmasInscricoes.CursosTurmas.codigo,
    turma: {
      id: certificado.CursosTurmasInscricoes.CursosTurmas.id,
      nome: certificado.CursosTurmasInscricoes.CursosTurmas.nome,
      codigo: certificado.CursosTurmasInscricoes.CursosTurmas.codigo,
    },
    alunoId: certificado.CursosTurmasInscricoes.Usuarios.id,
    alunoNome: certificado.CursosTurmasInscricoes.Usuarios.nomeCompleto,
    alunoEmail: certificado.CursosTurmasInscricoes.Usuarios.email,
    alunoCpf: cpfValue,
    alunoCodigoMatricula: matricula,
    alunoAvatarUrl:
      certificado.CursosTurmasInscricoes.Usuarios.UsuariosInformation?.avatarUrl ?? null,
    matricula,
    avatarUrl: certificado.CursosTurmasInscricoes.Usuarios.UsuariosInformation?.avatarUrl ?? null,
    aluno: {
      id: certificado.CursosTurmasInscricoes.Usuarios.id,
      nome: certificado.CursosTurmasInscricoes.Usuarios.nomeCompleto,
      email: certificado.CursosTurmasInscricoes.Usuarios.email,
      cpf: cpfValue,
      codigoMatricula: matricula,
      avatarUrl: certificado.CursosTurmasInscricoes.Usuarios.UsuariosInformation?.avatarUrl ?? null,
    },
    emitidoPor: certificado.Usuarios
      ? {
          id: certificado.Usuarios.id,
          nome: certificado.Usuarios.nomeCompleto,
          email: certificado.Usuarios.email,
        }
      : null,
    conteudoProgramatico: certificado.CursosCertificadosConteudoProgramatico?.conteudo ?? null,
    conteudoProgramaticoAtualizadoEm:
      certificado.CursosCertificadosConteudoProgramatico?.atualizadoEm?.toISOString() ?? null,
    pdfUrl: options.pdfUrl ?? null,
    previewUrl: options.previewUrl ?? null,
  } as const;
};

export { certificadoWithRelations };
