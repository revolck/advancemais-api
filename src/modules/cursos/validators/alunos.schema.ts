import { StatusInscricao } from '@prisma/client';
import { z } from 'zod';

const positiveInt = z.coerce
  .number({ invalid_type_error: 'Informe um número válido' })
  .int('Valor deve ser um número inteiro')
  .positive('Valor deve ser maior que zero');

/**
 * Schema de validação para query de listagem de alunos com inscrições
 * Segue o padrão dos outros endpoints (cursos, turmas)
 */
export const listAlunosComInscricoesQuerySchema = z.object({
  page: positiveInt.min(1).default(1),
  limit: positiveInt.min(1).max(50).default(10),
  search: z.string().trim().min(1).optional(),
  // Aceitar status como string única ou array de strings
  status: z
    .union([
      z.nativeEnum(StatusInscricao, {
        errorMap: () => ({
          message: `Status inválido. Valores aceitos: ${Object.values(StatusInscricao).join(', ')}`,
        }),
      }),
      z.array(
        z.nativeEnum(StatusInscricao, {
          errorMap: () => ({
            message: `Status inválido. Valores aceitos: ${Object.values(StatusInscricao).join(', ')}`,
          }),
        }),
      ),
    ])
    .optional(),
  // Aceitar cidade como string única ou array de strings
  cidade: z
    .union([
      z.string().trim().min(1),
      z.array(z.string().trim().min(1)),
    ])
    .optional(),
  // Aceitar tanto UUID (string) quanto número (para compatibilidade)
  // Cursos.id é String UUID, mas o frontend pode enviar número do código antigo
  curso: z
    .union([
      z.string().uuid('Curso ID deve ser um UUID válido'),
      z.string().min(1, 'Curso ID inválido'),
      positiveInt,
    ])
    .optional(),
  cursoId: z
    .union([
      z.string().uuid('Curso ID deve ser um UUID válido'),
      z.string().min(1, 'Curso ID inválido'),
      positiveInt,
    ])
    .optional(),
  turma: z.string().uuid().optional(),
  turmaId: z.string().uuid().optional(),
})
  .transform((data) => {
    // Normalizar cursoId: usar cursoId se fornecido, caso contrário usar curso
    // Cursos.id é String UUID, então manter como string se já for string, ou converter número
    const cursoIdRaw = data.cursoId || data.curso;
    let cursoId: string | undefined;

    if (cursoIdRaw !== undefined) {
      if (typeof cursoIdRaw === 'number') {
        // Se for número, converter para string (mas isso não vai funcionar com UUID)
        // Na prática, o frontend deve enviar UUID string
        cursoId = String(cursoIdRaw);
      } else {
        // Já é string, manter como está
        cursoId = cursoIdRaw;
      }
    }

    // Normalizar status: sempre converter para array
    let statusArray: StatusInscricao[] | undefined;
    if (data.status !== undefined) {
      statusArray = Array.isArray(data.status) ? data.status : [data.status];
    }

    // Normalizar cidade: sempre converter para array
    let cidadeArray: string[] | undefined;
    if (data.cidade !== undefined) {
      cidadeArray = Array.isArray(data.cidade) ? data.cidade : [data.cidade];
    }

    return {
      ...data,
      cursoId,
      status: statusArray,
      cidade: cidadeArray,
      curso: undefined, // Remover curso duplicado
    };
  });

/**
 * Schema de validação para histórico de inscrições de um aluno
 * Segue o padrão do histórico de empresas
 */
const paginationQueryBaseSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  status: z
    .union([
      z.nativeEnum(StatusInscricao, {
        errorMap: () => ({
          message: `Status inválido. Valores aceitos: ${Object.values(StatusInscricao).join(', ')}`,
        }),
      }),
      z.string(),
      z.array(z.nativeEnum(StatusInscricao)),
    ])
    .optional(),
});

const withDefaultPaginationValues = <T extends { page?: number; pageSize?: number }>(values: T) =>
  ({
    ...values,
    page: values.page ?? 1,
    pageSize: values.pageSize ?? 20,
  }) as Omit<T, 'page' | 'pageSize'> & { page: number; pageSize: number };

export const alunoHistoricoInscricoesQuerySchema = paginationQueryBaseSchema.transform(
  (data: {
    page?: number;
    pageSize?: number;
    status?: StatusInscricao | string | StatusInscricao[];
  }) => {
    // Normalizar paginação
    const pagination = withDefaultPaginationValues(data);

    // Normalizar status: converter string única, string com vírgulas ou array para array
    let statusArray: StatusInscricao[] | undefined;
    if (data.status !== undefined) {
      if (Array.isArray(data.status)) {
        statusArray = data.status;
      } else if (typeof data.status === 'string') {
        // Se contém vírgula, tratar como múltiplos status
        if (data.status.includes(',')) {
          const statuses = data.status.split(',').map((s: string) => s.trim());
          statusArray = statuses
            .map((s: string) => {
              if (Object.values(StatusInscricao).includes(s as StatusInscricao)) {
                return s as StatusInscricao;
              }
              return null;
            })
            .filter((s: StatusInscricao | null): s is StatusInscricao => s !== null);
        } else {
          // Status único
          if (Object.values(StatusInscricao).includes(data.status as StatusInscricao)) {
            statusArray = [data.status as StatusInscricao];
          }
        }
      } else {
        // Já é StatusInscricao enum
        statusArray = [data.status];
      }
    }

    return {
      ...pagination,
      status: statusArray,
    };
  },
);

export type AlunoHistoricoInscricoesQuery = z.infer<typeof alunoHistoricoInscricoesQuerySchema>;

