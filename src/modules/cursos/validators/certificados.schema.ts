import { CursosCertificados, CursosCertificadosTipos } from '@prisma/client';
import { z } from 'zod';

const optionalUrlSchema = z
  .string({ invalid_type_error: 'assinaturaUrl deve ser uma URL válida' })
  .trim()
  .url('assinaturaUrl deve ser uma URL válida')
  .max(2048, 'assinaturaUrl deve conter no máximo 2048 caracteres')
  .optional()
  .or(
    z
      .literal('')
      .transform(() => undefined),
  )
  .or(z.null().transform(() => undefined));

export const emitirCertificadoSchema = z.object({
  inscricaoId: z.string().uuid('Identificador da inscrição inválido'),
  tipo: z.nativeEnum(CursosCertificados, {
    invalid_type_error: 'Tipo de certificado inválido',
  }),
  formato: z.nativeEnum(CursosCertificadosTipos, {
    invalid_type_error: 'Formato de certificado inválido',
  }),
  cargaHoraria: z
    .number({ invalid_type_error: 'Carga horária deve ser um número' })
    .int('Carga horária deve ser um número inteiro')
    .min(1, 'Carga horária mínima é 1')
    .max(1000, 'Carga horária máxima suportada é 1000')
    .optional(),
  assinaturaUrl: optionalUrlSchema,
  observacoes: z
    .string({ invalid_type_error: 'Observações devem ser um texto' })
    .trim()
    .max(500, 'Observações devem conter no máximo 500 caracteres')
    .nullish(),
});

export const listarCertificadosQuerySchema = z.object({
  inscricaoId: z.string().uuid('Identificador da inscrição inválido').optional(),
  tipo: z.nativeEnum(CursosCertificados).optional(),
  formato: z.nativeEnum(CursosCertificadosTipos).optional(),
});

export const codigoCertificadoSchema = z
  .string({ invalid_type_error: 'Código do certificado deve ser um texto' })
  .trim()
  .min(6, 'Código do certificado deve conter ao menos 6 caracteres')
  .max(32, 'Código do certificado deve conter no máximo 32 caracteres');

export type EmitirCertificadoInput = z.infer<typeof emitirCertificadoSchema>;
export type ListarCertificadosQuery = z.infer<typeof listarCertificadosQuerySchema>;
