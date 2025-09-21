import { z, type ZodError } from 'zod';
import { Roles, Status, TiposDeUsuarios } from '../enums';

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

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterPessoaFisicaInput = z.infer<typeof pessoaFisicaRegisterSchema>;
export type RegisterPessoaJuridicaInput = z.infer<typeof pessoaJuridicaRegisterSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

export const formatZodErrors = (error: ZodError) =>
  error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
