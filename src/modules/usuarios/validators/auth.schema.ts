import { z, type ZodError, type ZodIssue } from 'zod';
import { Roles, Status, TiposDeUsuarios } from '../enums';
import { TiposDeBloqueios, MotivosDeBloqueios } from '@prisma/client';

export const loginSchema = z.object({
  documento: z
    .string({ required_error: 'Documento é obrigatório' })
    .min(1, 'Documento é obrigatório'),
  senha: z.string({ required_error: 'Senha é obrigatória' }).min(1, 'Senha é obrigatória'),
  rememberMe: z
    .boolean({ invalid_type_error: 'Remember me deve ser um valor booleano' })
    .optional()
    .default(false),
});

const enderecoSchema = z
  .object({
    logradouro: z
      .string({ invalid_type_error: 'Logradouro deve ser um texto' })
      .trim()
      .max(255, 'Logradouro deve ter no máximo 255 caracteres')
      .optional(),
    numero: z
      .string({ invalid_type_error: 'Número deve ser um texto' })
      .trim()
      .max(50, 'Número deve ter no máximo 50 caracteres')
      .optional(),
    bairro: z
      .string({ invalid_type_error: 'Bairro deve ser um texto' })
      .trim()
      .max(120, 'Bairro deve ter no máximo 120 caracteres')
      .optional(),
    cidade: z
      .string({ invalid_type_error: 'Cidade deve ser um texto' })
      .trim()
      .max(120, 'Cidade deve ter no máximo 120 caracteres')
      .optional(),
    estado: z
      .string({ invalid_type_error: 'Estado deve ser um texto' })
      .trim()
      .max(60, 'Estado deve ter no máximo 60 caracteres')
      .optional(),
    cep: z
      .string({ invalid_type_error: 'CEP deve ser um texto' })
      .trim()
      .regex(/^\d{5}-?\d{3}$/, 'CEP deve estar no formato 00000000 ou 00000-000')
      .optional(),
  })
  .partial();

const baseRegisterSchema = z.object({
  nomeCompleto: z
    .string({ required_error: 'Nome completo é obrigatório' })
    .min(1, 'Nome completo é obrigatório'),
  telefone: z.string({ required_error: 'Telefone é obrigatório' }).min(1, 'Telefone é obrigatório'),
  email: z.string({ required_error: 'Email é obrigatório' }).email('Formato de email inválido'),
  senha: z
    .string({ required_error: 'Senha é obrigatória' })
    .min(8, 'Senha deve ter pelo menos 8 caracteres'),
  confirmarSenha: z
    .string({ required_error: 'Confirmação de senha é obrigatória' })
    .min(1, 'Confirmação de senha é obrigatória'),
  aceitarTermos: z.boolean({
    required_error: 'É necessário informar se os termos foram aceitos',
    invalid_type_error: 'Aceitar termos deve ser um valor booleano',
  }),
  supabaseId: z
    .string({ required_error: 'Supabase ID é obrigatório' })
    .min(1, 'Supabase ID é obrigatório'),
  role: z.nativeEnum(Roles).optional(),
});

const pessoaFisicaRegisterSchema = baseRegisterSchema.extend({
  tipoUsuario: z.literal(TiposDeUsuarios.PESSOA_FISICA),
  cpf: z.string({ required_error: 'CPF é obrigatório' }).min(1, 'CPF é obrigatório'),
  dataNasc: z.string().optional(),
  genero: z.string().optional(),
});

const pessoaJuridicaRegisterSchema = baseRegisterSchema.extend({
  tipoUsuario: z.literal(TiposDeUsuarios.PESSOA_JURIDICA),
  cnpj: z.string({ required_error: 'CNPJ é obrigatório' }).min(1, 'CNPJ é obrigatório'),
});

export const registerSchema = z.union([pessoaFisicaRegisterSchema, pessoaJuridicaRegisterSchema]);

const adminBaseRegisterSchema = baseRegisterSchema.extend({
  aceitarTermos: baseRegisterSchema.shape.aceitarTermos.optional().default(true),
  supabaseId: baseRegisterSchema.shape.supabaseId.optional(),
  status: z.nativeEnum(Status).optional(),
  endereco: enderecoSchema.optional(),
});

const adminPessoaFisicaSchema = adminBaseRegisterSchema.extend({
  tipoUsuario: z.literal(TiposDeUsuarios.PESSOA_FISICA),
  cpf: z.string({ required_error: 'CPF é obrigatório' }).min(1, 'CPF é obrigatório'),
  dataNasc: z.string().optional(),
  genero: z.string().optional(),
});

const adminPessoaJuridicaSchema = adminBaseRegisterSchema.extend({
  tipoUsuario: z.literal(TiposDeUsuarios.PESSOA_JURIDICA),
  cnpj: z.string({ required_error: 'CNPJ é obrigatório' }).min(1, 'CNPJ é obrigatório'),
});

export const adminCreateUserSchema = z.union([adminPessoaFisicaSchema, adminPessoaJuridicaSchema]);

export const updateStatusSchema = z.object({
  status: z.nativeEnum(Status, {
    required_error: 'Status é obrigatório',
    invalid_type_error: 'Status inválido',
  }),
  motivo: z.string().max(500).optional(),
});

export const updateRoleSchema = z.object({
  role: z.nativeEnum(Roles, {
    required_error: 'Role é obrigatória',
    invalid_type_error: 'Role inválida',
  }),
  motivo: z.string().max(500).optional(),
});

export const adminAlunoBloqueioSchema = z
  .object({
    tipo: z.nativeEnum(TiposDeBloqueios, { required_error: 'Tipo de bloqueio é obrigatório' }),
    motivo: z.nativeEnum(MotivosDeBloqueios, {
      required_error: 'Motivo do bloqueio é obrigatório',
    }),
    dias: z.coerce
      .number()
      .int()
      .min(1, 'Informe pelo menos 1 dia de bloqueio')
      .max(3650, 'Bloqueio temporário deve ter no máximo 10 anos')
      .describe('Quantidade de dias para bloqueio temporário')
      .optional(),
    observacoes: z
      .string()
      .trim()
      .min(3, 'Informe observações com pelo menos 3 caracteres')
      .max(500, 'Observações devem ter no máximo 500 caracteres')
      .optional(),
  })
  .refine(
    (values) =>
      values.tipo !== TiposDeBloqueios.TEMPORARIO ||
      (values.dias !== undefined && Number.isFinite(values.dias) && values.dias > 0),
    {
      message: 'Informe a quantidade de dias para bloqueios temporários',
      path: ['dias'],
    },
  );

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterPessoaFisicaInput = z.infer<typeof pessoaFisicaRegisterSchema>;
export type RegisterPessoaJuridicaInput = z.infer<typeof pessoaJuridicaRegisterSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>;
export type AdminAlunoBloqueioInput = z.infer<typeof adminAlunoBloqueioSchema>;

type FormattedError = {
  path: string;
  message: string;
};

const collectIssues = (
  issues: ZodIssue[],
  parentPath: (string | number)[] = [],
  results: FormattedError[] = [],
) => {
  for (const issue of issues) {
    const currentPath = [...parentPath, ...issue.path];

    if (issue.code === 'invalid_union' && 'unionErrors' in issue) {
      for (const unionError of issue.unionErrors) {
        collectIssues(unionError.issues, currentPath, results);
      }
      continue;
    }

    const path = currentPath.filter((segment) => segment !== undefined && segment !== '').join('.');

    if (!results.some((error) => error.path === path && error.message === issue.message)) {
      results.push({
        path,
        message: issue.message,
      });
    }
  }

  return results;
};

export const formatZodErrors = (error: ZodError) => collectIssues(error.issues);
