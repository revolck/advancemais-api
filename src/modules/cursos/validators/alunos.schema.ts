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

