export class ValidationUtil {
  /**
   * Valida formato de email
   */
  static validarEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Valida força da senha
   */
  static validarSenha(senha: string): { valida: boolean; erros: string[] } {
    const erros: string[] = [];

    if (senha.length < 8) {
      erros.push('Senha deve ter pelo menos 8 caracteres');
    }

    if (!/[A-Z]/.test(senha)) {
      erros.push('Senha deve conter pelo menos uma letra maiúscula');
    }

    if (!/[a-z]/.test(senha)) {
      erros.push('Senha deve conter pelo menos uma letra minúscula');
    }

    if (!/\d/.test(senha)) {
      erros.push('Senha deve conter pelo menos um número');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(senha)) {
      erros.push('Senha deve conter pelo menos um caractere especial');
    }

    return {
      valida: erros.length === 0,
      erros,
    };
  }

  /**
   * Gera matrícula única no formato AD123XY
   */
  static gerarMatricula(): string {
    const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numeros = '0123456789';

    let matricula = 'AD';

    // 3 números
    for (let i = 0; i < 3; i++) {
      matricula += numeros[Math.floor(Math.random() * numeros.length)];
    }

    // 2 letras
    for (let i = 0; i < 2; i++) {
      matricula += letras[Math.floor(Math.random() * letras.length)];
    }

    return matricula;
  }

  /**
   * Valida CPF
   */
  static validarCPF(cpf: string): boolean {
    cpf = cpf.replace(/[^\d]/g, '');

    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

    let soma = 0;
    for (let i = 0; i < 9; i++) {
      soma += parseInt(cpf[i]) * (10 - i);
    }

    let resto = soma % 11;
    const digito1 = resto < 2 ? 0 : 11 - resto;

    if (parseInt(cpf[9]) !== digito1) return false;

    soma = 0;
    for (let i = 0; i < 10; i++) {
      soma += parseInt(cpf[i]) * (11 - i);
    }

    resto = soma % 11;
    const digito2 = resto < 2 ? 0 : 11 - resto;

    return parseInt(cpf[10]) === digito2;
  }

  /**
   * Valida CNPJ
   */
  static validarCNPJ(cnpj: string): boolean {
    cnpj = cnpj.replace(/[^\d]/g, '');

    if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;

    const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    let soma = 0;
    for (let i = 0; i < 12; i++) {
      soma += parseInt(cnpj[i]) * pesos1[i];
    }

    let resto = soma % 11;
    const digito1 = resto < 2 ? 0 : 11 - resto;

    if (parseInt(cnpj[12]) !== digito1) return false;

    soma = 0;
    for (let i = 0; i < 13; i++) {
      soma += parseInt(cnpj[i]) * pesos2[i];
    }

    resto = soma % 11;
    const digito2 = resto < 2 ? 0 : 11 - resto;

    return parseInt(cnpj[13]) === digito2;
  }
}
