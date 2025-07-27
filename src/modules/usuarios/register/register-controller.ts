import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../../../config/prisma";
import { TipoUsuario, Role } from "../enums";
import {
  validarCPF,
  validarCNPJ,
  validarEmail,
  validarSenha,
  validarConfirmacaoSenha,
  validarTelefone,
  validarDataNascimento,
  validarGenero,
  limparDocumento,
} from "../utils/validation";

/**
 * Interface para dados de criação de usuário - Pessoa Física
 */
interface CriarPessoaFisicaData {
  // Campos obrigatórios para Pessoa Física
  nomeCompleto: string;
  cpf: string;
  dataNasc: string;
  telefone: string;
  genero: string;
  email: string;
  senha: string;
  confirmarSenha: string;
  aceitarTermos: boolean;
  supabaseId: string;
  role: Role;
  tipoUsuario: TipoUsuario.PESSOA_FISICA;
}

/**
 * Interface para dados de criação de usuário - Pessoa Jurídica
 */
interface CriarPessoaJuridicaData {
  // Campos obrigatórios para Pessoa Jurídica
  nomeCompleto: string; // Nome da empresa
  cnpj: string;
  telefone: string;
  email: string;
  senha: string;
  confirmarSenha: string;
  aceitarTermos: boolean;
  supabaseId: string;
  role: Role;
  tipoUsuario: TipoUsuario.PESSOA_JURIDICA;
}

/**
 * Type union para dados de criação
 */
type CriarUsuarioData = CriarPessoaFisicaData | CriarPessoaJuridicaData;

/**
 * Controller para criação de novos usuários
 * Valida dados específicos por tipo de usuário
 * @param req - Request object com dados do usuário
 * @param res - Response object
 */
export const criarUsuario = async (req: Request, res: Response) => {
  try {
    const dadosUsuario: CriarUsuarioData = req.body;

    // Validação básica comum para ambos os tipos
    const {
      nomeCompleto,
      telefone,
      email,
      senha,
      confirmarSenha,
      aceitarTermos,
      supabaseId,
      tipoUsuario,
      role,
    } = dadosUsuario;

    // Campos obrigatórios básicos
    if (
      !nomeCompleto ||
      !telefone ||
      !email ||
      !senha ||
      !confirmarSenha ||
      !supabaseId ||
      !tipoUsuario
    ) {
      return res.status(400).json({
        message:
          "Campos obrigatórios: nomeCompleto, telefone, email, senha, confirmarSenha, supabaseId, tipoUsuario",
      });
    }

    // Validação de email
    if (!validarEmail(email)) {
      return res.status(400).json({
        message: "Formato de email inválido",
      });
    }

    // Validação de senha
    const validacaoSenha = validarSenha(senha);
    if (!validacaoSenha.valida) {
      return res.status(400).json({
        message: "Senha não atende aos critérios de segurança",
        detalhes: validacaoSenha.mensagens,
      });
    }

    // Validação de confirmação de senha
    if (!validarConfirmacaoSenha(senha, confirmarSenha)) {
      return res.status(400).json({
        message: "Confirmação de senha não confere",
      });
    }

    // Validação de telefone
    if (!validarTelefone(telefone)) {
      return res.status(400).json({
        message: "Formato de telefone inválido. Use formato: (XX) XXXXX-XXXX",
      });
    }

    // Validação de termos
    if (!aceitarTermos) {
      return res.status(400).json({
        message: "É necessário aceitar os termos de uso",
      });
    }

    // Validações específicas por tipo de usuário
    let cpfLimpo: string | undefined;
    let cnpjLimpo: string | undefined;
    let dataNascimento: Date | undefined;
    let generoValidado: string | undefined;

    if (tipoUsuario === TipoUsuario.PESSOA_FISICA) {
      const dadosPF = dadosUsuario as CriarPessoaFisicaData;

      // Validações obrigatórias para Pessoa Física
      if (!dadosPF.cpf || !dadosPF.dataNasc || !dadosPF.genero) {
        return res.status(400).json({
          message:
            "Para pessoa física são obrigatórios: CPF, data de nascimento e gênero",
        });
      }

      // Validação de CPF
      cpfLimpo = limparDocumento(dadosPF.cpf);
      if (!validarCPF(cpfLimpo)) {
        return res.status(400).json({
          message: "CPF deve ter 11 dígitos válidos",
        });
      }

      // Validação de data de nascimento
      const validacaoData = validarDataNascimento(dadosPF.dataNasc);
      if (!validacaoData.valida) {
        return res.status(400).json({
          message: validacaoData.mensagem,
        });
      }
      dataNascimento = new Date(dadosPF.dataNasc);

      // Validação de gênero
      if (!validarGenero(dadosPF.genero)) {
        return res.status(400).json({
          message:
            "Gênero deve ser: MASCULINO, FEMININO, OUTRO ou NAO_INFORMAR",
        });
      }
      generoValidado = dadosPF.genero.toUpperCase();
    } else if (tipoUsuario === TipoUsuario.PESSOA_JURIDICA) {
      const dadosPJ = dadosUsuario as CriarPessoaJuridicaData;

      // Validações obrigatórias para Pessoa Jurídica
      if (!dadosPJ.cnpj) {
        return res.status(400).json({
          message: "Para pessoa jurídica é obrigatório: CNPJ",
        });
      }

      // Validação de CNPJ
      cnpjLimpo = limparDocumento(dadosPJ.cnpj);
      if (!validarCNPJ(cnpjLimpo)) {
        return res.status(400).json({
          message: "CNPJ deve ter 14 dígitos válidos",
        });
      }
    }

    // Verifica se já existe usuário com mesmo email/cpf/cnpj/supabaseId
    const usuarioExistente = await prisma.usuario.findFirst({
      where: {
        OR: [
          { email },
          { supabaseId },
          ...(cpfLimpo ? [{ cpf: cpfLimpo }] : []),
          ...(cnpjLimpo ? [{ cnpj: cnpjLimpo }] : []),
        ],
      },
    });

    if (usuarioExistente) {
      let mensagemErro = "Já existe usuário cadastrado com ";
      if (usuarioExistente.email === email) mensagemErro += "este email";
      else if (usuarioExistente.cpf === cpfLimpo) mensagemErro += "este CPF";
      else if (usuarioExistente.cnpj === cnpjLimpo) mensagemErro += "este CNPJ";
      else mensagemErro += "este ID do Supabase";

      return res.status(409).json({ message: mensagemErro });
    }

    // Gera hash seguro da senha
    const senhaHash = await bcrypt.hash(senha, 12);

    // Cria usuário no banco de dados
    const usuario = await prisma.usuario.create({
      data: {
        nomeCompleto,
        email,
        senha: senhaHash,
        telefone,
        tipoUsuario,
        role,
        aceitarTermos,
        supabaseId,
        ...(cpfLimpo && { cpf: cpfLimpo }),
        ...(cnpjLimpo && { cnpj: cnpjLimpo }),
        ...(dataNascimento && { dataNasc: dataNascimento }),
        ...(generoValidado && { genero: generoValidado }),
      },
      select: {
        id: true,
        email: true,
        nomeCompleto: true,
        cpf: true,
        cnpj: true,
        telefone: true,
        dataNasc: true,
        genero: true,
        tipoUsuario: true,
        role: true,
        status: true,
        supabaseId: true,
        criadoEm: true,
        // Não retorna senha nem tokens por segurança
      },
    });

    // IMPORTANTE: Prepara dados para o middleware de email
    res.locals.usuarioCriado = {
      usuario,
    };

    res.status(201).json({
      message: `${
        tipoUsuario === TipoUsuario.PESSOA_FISICA ? "Pessoa física" : "Empresa"
      } cadastrada com sucesso`,
      usuario,
    });
  } catch (error) {
    console.error("Erro ao criar usuário:", error);

    // Tratamento específico para erros de constraint do Prisma
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return res.status(409).json({
        message:
          "Dados duplicados: email, CPF, CNPJ ou ID do Supabase já existem",
      });
    }

    res.status(500).json({
      message: "Erro interno do servidor ao criar usuário",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};
