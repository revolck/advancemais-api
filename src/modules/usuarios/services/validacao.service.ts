import {
  Injectable,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { ValidationUtil } from '../../../utils/validation.util';

/**
 * ✅ Service para validações de negócio
 * Centraliza todas as validações relacionadas a usuários
 */
@Injectable()
export class ValidacaoService {
  constructor(private database: DatabaseService) {}

  /**
   * 📧 Validar se email é único no sistema
   */
  async validarEmailUnico(email: string, excluirId?: string): Promise<void> {
    const where: any = { email: email.toLowerCase() };

    if (excluirId) {
      where.NOT = { id: excluirId };
    }

    const emailExiste = await this.database.usuario.findFirst({ where });

    if (emailExiste) {
      throw new ConflictException('Email já está em uso');
    }
  }

  /**
   * 🆔 Validar se CPF é único no sistema
   */
  async validarCpfUnico(cpf: string, excluirId?: string): Promise<void> {
    // 🔍 Validar formato do CPF
    if (!ValidationUtil.validarCPF(cpf)) {
      throw new BadRequestException('CPF inválido');
    }

    const where: any = { cpf };

    if (excluirId) {
      where.NOT = { id: excluirId };
    }

    const cpfExiste = await this.database.usuario.findFirst({ where });

    if (cpfExiste) {
      throw new ConflictException('CPF já está em uso');
    }
  }

  /**
   * 🏢 Validar se CNPJ é único no sistema
   */
  async validarCnpjUnico(cnpj: string, excluirId?: string): Promise<void> {
    // 🔍 Validar formato do CNPJ
    if (!ValidationUtil.validarCNPJ(cnpj)) {
      throw new BadRequestException('CNPJ inválido');
    }

    const where: any = { cnpj };

    if (excluirId) {
      where.NOT = { id: excluirId };
    }

    const cnpjExiste = await this.database.usuario.findFirst({ where });

    if (cnpjExiste) {
      throw new ConflictException('CNPJ já está em uso');
    }
  }

  /**
   * 🎯 Validar se matrícula é única no sistema
   */
  async validarMatriculaUnica(
    matricula: string,
    excluirId?: string,
  ): Promise<void> {
    const where: any = { matricula: matricula.toUpperCase() };

    if (excluirId) {
      where.NOT = { id: excluirId };
    }

    const matriculaExiste = await this.database.usuario.findFirst({ where });

    if (matriculaExiste) {
      throw new ConflictException('Matrícula já está em uso');
    }
  }

  /**
   * 🔒 Validar força da senha
   */
  validarSenha(senha: string): void {
    const validacao = ValidationUtil.validarSenha(senha);

    if (!validacao.valida) {
      throw new BadRequestException(
        `Senha inválida: ${validacao.erros.join(', ')}`,
      );
    }
  }

  /**
   * 📧 Validar formato do email
   */
  validarEmail(email: string): void {
    if (!ValidationUtil.validarEmail(email)) {
      throw new BadRequestException('Formato de email inválido');
    }
  }

  /**
   * 📅 Validar idade mínima (16 anos)
   */
  validarIdadeMinima(dataNascimento: Date): void {
    const hoje = new Date();
    const idade = hoje.getFullYear() - dataNascimento.getFullYear();
    const mesAtual = hoje.getMonth();
    const diaAtual = hoje.getDate();
    const mesNasc = dataNascimento.getMonth();
    const diaNasc = dataNascimento.getDate();

    let idadeReal = idade;

    if (mesAtual < mesNasc || (mesAtual === mesNasc && diaAtual < diaNasc)) {
      idadeReal--;
    }

    if (idadeReal < 16) {
      throw new BadRequestException('Usuário deve ter pelo menos 16 anos');
    }
  }

  /**
   * 🏢 Validar dados empresariais para pessoa jurídica
   */
  validarDadosEmpresariais(razaoSocial?: string, cnpj?: string): void {
    if (!razaoSocial || razaoSocial.trim().length < 3) {
      throw new BadRequestException(
        'Razão social é obrigatória para pessoa jurídica',
      );
    }

    if (!cnpj) {
      throw new BadRequestException('CNPJ é obrigatório para pessoa jurídica');
    }
  }

  /**
   * 📞 Validar formato do telefone brasileiro
   */
  validarTelefone(telefone: string): void {
    // Remove caracteres não numéricos
    const telefoneNumeros = telefone.replace(/\D/g, '');

    // Validar formatos: (11) 12345-6789 ou (11) 1234-5678
    if (!/^(\d{10}|\d{11})$/.test(telefoneNumeros)) {
      throw new BadRequestException('Telefone deve ter 10 ou 11 dígitos');
    }

    // Validar DDD válido (11-99)
    const ddd = parseInt(telefoneNumeros.substring(0, 2));
    if (ddd < 11 || ddd > 99) {
      throw new BadRequestException('DDD inválido');
    }
  }

  /**
   * 📍 Validar CEP brasileiro
   */
  validarCep(cep: string): void {
    const cepNumeros = cep.replace(/\D/g, '');

    if (!/^\d{8}$/.test(cepNumeros)) {
      throw new BadRequestException('CEP deve conter exatamente 8 dígitos');
    }
  }
}
