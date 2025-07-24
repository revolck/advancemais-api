/**
 * Utilitários de validação para o módulo de usuários
 */

/**
 * Valida se um CPF tem formato correto (11 dígitos)
 * @param cpf - CPF para validar
 * @returns boolean
 */
export const validarCPF = (cpf: string): boolean => {
  const cpfLimpo = cpf.replace(/\D/g, "");
  return cpfLimpo.length === 11;
};

/**
 * Valida se um CNPJ tem formato correto (14 dígitos)
 * @param cnpj - CNPJ para validar
 * @returns boolean
 */
export const validarCNPJ = (cnpj: string): boolean => {
  const cnpjLimpo = cnpj.replace(/\D/g, "");
  return cnpjLimpo.length === 14;
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
export const validarSenha = (
  senha: string
): { valida: boolean; mensagens: string[] } => {
  const mensagens: string[] = [];

  if (senha.length < 8) {
    mensagens.push("Senha deve ter pelo menos 8 caracteres");
  }

  if (!/[A-Z]/.test(senha)) {
    mensagens.push("Senha deve conter pelo menos uma letra maiúscula");
  }

  if (!/[a-z]/.test(senha)) {
    mensagens.push("Senha deve conter pelo menos uma letra minúscula");
  }

  if (!/\d/.test(senha)) {
    mensagens.push("Senha deve conter pelo menos um número");
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(senha)) {
    mensagens.push("Senha deve conter pelo menos um caractere especial");
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
export const validarConfirmacaoSenha = (
  senha: string,
  confirmarSenha: string
): boolean => {
  return senha === confirmarSenha;
};

/**
 * Limpa caracteres especiais de documentos
 * @param documento - CPF ou CNPJ
 * @returns string apenas com números
 */
export const limparDocumento = (documento: string): string => {
  return documento.replace(/\D/g, "");
};

/**
 * Valida se um telefone tem formato correto
 * @param telefone - Telefone para validar
 * @returns boolean
 */
export const validarTelefone = (telefone: string): boolean => {
  const telefoneLimpo = telefone.replace(/\D/g, "");
  // Aceita telefones com 10 ou 11 dígitos (DDD + número)
  return telefoneLimpo.length >= 10 && telefoneLimpo.length <= 11;
};

/**
 * Valida se uma data é válida e se a pessoa tem pelo menos 16 anos
 * @param dataNasc - Data de nascimento
 * @returns object com resultado e mensagem
 */
export const validarDataNascimento = (
  dataNasc: string
): { valida: boolean; mensagem?: string } => {
  const data = new Date(dataNasc);

  // Verifica se a data é válida
  if (isNaN(data.getTime())) {
    return { valida: false, mensagem: "Data de nascimento inválida" };
  }

  // Verifica se a data não é futura
  if (data > new Date()) {
    return {
      valida: false,
      mensagem: "Data de nascimento não pode ser futura",
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
    return { valida: false, mensagem: "Idade mínima de 16 anos" };
  }

  return { valida: true };
};

/**
 * Valida gênero
 * @param genero - Gênero para validar
 * @returns boolean
 */
export const validarGenero = (genero: string): boolean => {
  const generosValidos = ["MASCULINO", "FEMININO", "OUTRO", "NAO_INFORMAR"];
  return generosValidos.includes(genero.toUpperCase());
};
