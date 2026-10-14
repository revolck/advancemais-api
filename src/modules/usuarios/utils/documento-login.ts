/**
 * Documento usado no login (CNPJ para empresa, CPF para pessoa física), mascarado
 * para orientar o usuário sem expor o número inteiro.
 */
export interface DocumentoLogin {
  tipo: 'CPF' | 'CNPJ';
  mascarado: string;
}

export function documentoDeLogin(usuario: {
  cpf?: string | null;
  cnpj?: string | null;
}): DocumentoLogin | null {
  const cnpj = (usuario.cnpj ?? '').replace(/\D/g, '');
  if (cnpj.length === 14) {
    return { tipo: 'CNPJ', mascarado: `**.***.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-**` };
  }
  const cpf = (usuario.cpf ?? '').replace(/\D/g, '');
  if (cpf.length === 11) {
    return { tipo: 'CPF', mascarado: `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**` };
  }
  return null;
}
