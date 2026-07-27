/**
 * Utilitários de validação para o módulo de usuários
 */

const CNPJ_WEIGHTS_FIRST_DIGIT = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const CNPJ_WEIGHTS_SECOND_DIGIT = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;

export type TipoDocumentoIdentificado = 'cpf' | 'cnpj';

/**
 * Normaliza CPF preservando somente dígitos.
 */
export const normalizarCPF = (cpf: string): string => {
  return String(cpf || '').replace(/\D/g, '');
};

/**
 * Normaliza CNPJ alfanumérico removendo pontuação/espaços e convertendo letras para maiúsculas.
 */
export const normalizarCNPJ = (cnpj: string): string => {
  return String(cnpj || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
};

/**
 * Normaliza documento de login/cadastro preservando letras quando houver CNPJ alfanumérico.
 */
export const normalizarDocumento = (documento: string): string => {
  return normalizarCNPJ(documento);
};

/**
 * Identifica o tipo do documento no campo unificado CPF ou CNPJ.
 */
export const identificarTipoDocumento = (documento: string): TipoDocumentoIdentificado | null => {
  const normalized = normalizarDocumento(documento);
  if (!normalized) return null;

  const hasLetters = /[A-Z]/.test(normalized);
  if (hasLetters) return normalized.length === 14 ? 'cnpj' : null;

  if (/^\d{11}$/.test(normalized)) return 'cpf';
  if (/^\d{14}$/.test(normalized)) return 'cnpj';

  return null;
};

/**
 * Valida se um CPF tem formato correto (11 dígitos)
 * @param cpf - CPF para validar
 * @returns boolean
 */
export const validarCPF = (cpf: string): boolean => {
  const cpfLimpo = normalizarCPF(cpf);
  return cpfLimpo.length === 11;
};

const calcularDigitoCNPJ = (base: string, weights: readonly number[]): number => {
  const sum = weights.reduce((total, weight, index) => {
    return total + (base.charCodeAt(index) - 48) * weight;
  }, 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
};

/**
 * Valida CNPJ alfanumérico com dígitos verificadores conforme Receita Federal.
 * Primeiras 12 posições aceitam A-Z e 0-9; as duas últimas são numéricas.
 */
export const validarCNPJ = (cnpj: string): boolean => {
  const cnpjLimpo = normalizarCNPJ(cnpj);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpjLimpo)) return false;

  const primeiroDigito = calcularDigitoCNPJ(cnpjLimpo, CNPJ_WEIGHTS_FIRST_DIGIT);
  if (primeiroDigito !== Number(cnpjLimpo[12])) return false;

  const segundoDigito = calcularDigitoCNPJ(cnpjLimpo, CNPJ_WEIGHTS_SECOND_DIGIT);
  return segundoDigito === Number(cnpjLimpo[13]);
};

export const formatarCNPJ = (cnpj: string): string => {
  const value = normalizarCNPJ(cnpj);
  if (value.length !== 14) return cnpj;
  return `${value.slice(0, 2)}.${value.slice(2, 5)}.${value.slice(5, 8)}/${value.slice(
    8,
    12,
  )}-${value.slice(12, 14)}`;
};

/**
 * Valida formato de email
 * @param email - Email para validar
 * @returns boolean
 */
export const validarEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Valida se uma senha atende aos critérios mínimos
 * @param senha - Senha para validar
 * @returns object com resultado e mensagens
 */
export const validarSenha = (senha: string): { valida: boolean; mensagens: string[] } => {
  const mensagens: string[] = [];

  if (senha.length < 8) {
    mensagens.push('Senha deve ter pelo menos 8 caracteres');
  }

  if (!/[A-Z]/.test(senha)) {
    mensagens.push('Senha deve conter pelo menos uma letra maiúscula');
  }

  if (!/[a-z]/.test(senha)) {
    mensagens.push('Senha deve conter pelo menos uma letra minúscula');
  }

  if (!/\d/.test(senha)) {
    mensagens.push('Senha deve conter pelo menos um número');
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(senha)) {
    mensagens.push('Senha deve conter pelo menos um caractere especial');
  }

  return {
    valida: mensagens.length === 0,
    mensagens,
  };
};

/**
 * Valida se a confirmação de senha confere com a senha
 * @param senha - Senha original
 * @param confirmarSenha - Confirmação da senha
 * @returns boolean
 */
export const validarConfirmacaoSenha = (senha: string, confirmarSenha: string): boolean => {
  return senha === confirmarSenha;
};

/**
 * Limpa caracteres especiais de documentos preservando letras de CNPJ alfanumérico.
 * @param documento - CPF ou CNPJ
 * @returns string sem máscara, com letras em maiúsculo quando houver CNPJ
 */
export const limparDocumento = (documento: string): string => {
  return normalizarDocumento(documento);
};

/**
 * Valida se um telefone tem formato correto
 * @param telefone - Telefone para validar
 * @returns boolean
 */
export const validarTelefone = (telefone: string): boolean => {
  const telefoneLimpo = telefone.replace(/\D/g, '');
  // Aceita telefones com 10 ou 11 dígitos (DDD + número)
  return telefoneLimpo.length >= 10 && telefoneLimpo.length <= 11;
};

/**
 * Valida se uma data é válida e se a pessoa tem pelo menos 16 anos
 * @param dataNasc - Data de nascimento
 * @returns object com resultado e mensagem
 */
export const validarDataNascimento = (dataNasc: string): { valida: boolean; mensagem?: string } => {
  const data = new Date(dataNasc);

  // Verifica se a data é válida
  if (isNaN(data.getTime())) {
    return { valida: false, mensagem: 'Data de nascimento inválida' };
  }

  // Verifica se a data não é futura
  if (data > new Date()) {
    return {
      valida: false,
      mensagem: 'Data de nascimento não pode ser futura',
    };
  }

  // Verifica idade mínima de 16 anos
  const hoje = new Date();
  const idade = hoje.getFullYear() - data.getFullYear();
  const mesAtual = hoje.getMonth();
  const diaAtual = hoje.getDate();
  const mesNasc = data.getMonth();
  const diaNasc = data.getDate();

  let idadeReal = idade;
  if (mesNasc > mesAtual || (mesNasc === mesAtual && diaNasc > diaAtual)) {
    idadeReal--;
  }

  if (idadeReal < 16) {
    return { valida: false, mensagem: 'Idade mínima de 16 anos' };
  }

  return { valida: true };
};

/**
 * Valida gênero
 * @param genero - Gênero para validar
 * @returns boolean
 */
export const validarGenero = (genero: string): boolean => {
  const generosValidos = ['MASCULINO', 'FEMININO', 'OUTRO', 'NAO_INFORMAR'];
  return generosValidos.includes(genero.toUpperCase());
};
