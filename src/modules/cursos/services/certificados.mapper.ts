import { Prisma } from '@prisma/client';

const certificadoWithRelations = Prisma.validator<Prisma.CursosCertificadosEmitidosDefaultArgs>()({
  include: {
    emitidoPor: {
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
      },
    },
    matricula: {
      select: {
        id: true,
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            cpf: true,
            informacoes: {
              select: {
                matricula: true,
              },
            },
          },
        },
        turma: {
          select: {
            id: true,
            nome: true,
            codigo: true,
            curso: {
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
    logs: {
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
      id: certificado.matricula.aluno.id,
      nome: certificado.matricula.aluno.nomeCompleto,
      email: certificado.matricula.aluno.email,
      cpf: maskCpf ? null : formattedCpf,
      cpfMascarado: maskedCpf,
      matricula: certificado.matricula.aluno.informacoes?.matricula ?? null,
    },
    curso: {
      id: certificado.matricula.turma.curso.id,
      nome: certificado.matricula.turma.curso.nome,
      codigo: certificado.matricula.turma.curso.codigo,
      cargaHoraria: certificado.cargaHoraria,
    },
    turma: {
      id: certificado.matricula.turma.id,
      nome: certificado.matricula.turma.nome,
      codigo: certificado.matricula.turma.codigo,
    },
    emitidoPor: certificado.emitidoPor
      ? {
          id: certificado.emitidoPor.id,
          nome: certificado.emitidoPor.nomeCompleto,
          email: certificado.emitidoPor.email,
        }
      : null,
    logs:
      includeLogs && certificado.logs
        ? certificado.logs.map((log) => ({
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
