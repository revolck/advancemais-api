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
        Usuarios: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            cpf: true,
            UsuariosInformation: {
              select: {
                inscricao: true,
              },
            },
          },
        },
        CursosTurmas: {
          select: {
            id: true,
            nome: true,
            codigo: true,
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

export const mapCertificado = (
  certificado: CertificadoWithRelations,
  { maskCpf = false, includeLogs = true }: { maskCpf?: boolean; includeLogs?: boolean } = {},
) => {
  const formattedCpf = formatCpf(certificado.alunoCpf);
  const maskedCpf = maskCpfValue(certificado.alunoCpf);

  return {
    id: certificado.id,
    codigo: certificado.codigo,
    tipo: certificado.tipo,
    formato: certificado.formato,
    cargaHoraria: certificado.cargaHoraria,
    assinaturaUrl: certificado.assinaturaUrl,
    emitidoEm: certificado.emitidoEm,
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

export { certificadoWithRelations };
