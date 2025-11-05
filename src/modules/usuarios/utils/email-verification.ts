import type { UsuariosVerificacaoEmail } from '@prisma/client';

export const UsuariosVerificacaoEmailSelect = {
  emailVerificado: true,
  emailVerificadoEm: true,
  emailVerificationToken: true,
  emailVerificationTokenExp: true,
  emailVerificationAttempts: true,
  ultimaTentativaVerificacao: true,
} as const;

export type EmailVerificationSelection = Pick<
  UsuariosVerificacaoEmail,
  | 'emailVerificado'
  | 'emailVerificadoEm'
  | 'emailVerificationToken'
  | 'emailVerificationTokenExp'
  | 'emailVerificationAttempts'
  | 'ultimaTentativaVerificacao'
>;

export type NormalizedEmailVerification = {
  emailVerificado: boolean;
  emailVerificadoEm: Date | null;
  emailVerificationToken: string | null;
  emailVerificationTokenExp: Date | null;
  emailVerificationAttempts: number;
  ultimaTentativaVerificacao: Date | null;
};

export const normalizeEmailVerification = (
  verification?: Partial<EmailVerificationSelection> | null,
): NormalizedEmailVerification => ({
  emailVerificado: verification?.emailVerificado ?? false,
  emailVerificadoEm: verification?.emailVerificadoEm ?? null,
  emailVerificationToken: verification?.emailVerificationToken ?? null,
  emailVerificationTokenExp: verification?.emailVerificationTokenExp ?? null,
  emailVerificationAttempts: verification?.emailVerificationAttempts ?? 0,
  ultimaTentativaVerificacao: verification?.ultimaTentativaVerificacao ?? null,
});

export const buildEmailVerificationSummary = (
  verification?: Partial<EmailVerificationSelection> | null,
) => {
  const normalized = normalizeEmailVerification(verification);
  return {
    verified: normalized.emailVerificado,
    verifiedAt: normalized.emailVerificadoEm,
    token: normalized.emailVerificationToken,
    tokenExpiration: normalized.emailVerificationTokenExp,
    attempts: normalized.emailVerificationAttempts,
    lastAttemptAt: normalized.ultimaTentativaVerificacao,
  };
};
