import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../../../config/prisma";
import { Prisma, CodigoTipo } from "@prisma/client";
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
 * Controller para criação de novos usuários
 * Implementa padrões de microserviços com tratamento robusto de erros
 *
 * Características:
 * - Validação rigorosa de dados
 * - Transações de banco seguras
 * - Logs estruturados para auditoria
 * - Preparação de dados para middlewares
 * - Rollback automático em caso de erro
 *
 * @author Sistema AdvanceMais
 * @version 4.0.2 - Correção de tipagem TypeScript
 */

/**
 * Interface para dados de criação de usuário - Pessoa Física
 */
interface CriarPessoaFisicaData {
  nomeCompleto: string;
  cpf: string;
  dataNasc?: string;
  telefone: string;
  genero?: string;
  email: string;
  senha: string;
  confirmarSenha: string;
  aceitarTermos: boolean;
  supabaseId: string;
  role?: Role;
  tipoUsuario: TipoUsuario.PESSOA_FISICA;
}

/**
 * Interface para dados de criação de usuário - Pessoa Jurídica
 */
interface CriarPessoaJuridicaData {
  nomeCompleto: string; // Nome da empresa
  cnpj: string;
  telefone: string;
  email: string;
  senha: string;
  confirmarSenha: string;
  aceitarTermos: boolean;
  supabaseId: string;
  role?: Role;
  tipoUsuario: TipoUsuario.PESSOA_JURIDICA;
}

/**
 * Type union para dados de criação
 */
type CriarUsuarioData = CriarPessoaFisicaData | CriarPessoaJuridicaData;

/**
 * Controller para criação de novos usuários
 * Implementa validação robusta e transações seguras
 *
 * @param req - Request object com dados do usuário
 * @param res - Response object
 */
export const criarUsuario = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Gera ID de correlação para rastreamento
  const correlationId = generateCorrelationId();
  const startTime = Date.now();

  console.log(`🚀 [${correlationId}] Iniciando criação de usuário`);

  try {
    const dadosUsuario: CriarUsuarioData = req.body;

    // Validação de entrada com logs estruturados
    const validationResult = await validateUserInput(
      dadosUsuario,
      correlationId
    );
    if (!validationResult.isValid) {
      console.warn(
        `⚠️ [${correlationId}] Dados inválidos: ${validationResult.errors?.join(
          ", "
        )}`
      );
      return res.status(400).json({
        success: false,
        message: "Dados de entrada inválidos",
        errors: validationResult.errors,
        correlationId,
      });
    }

    // Extrai dados validados
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

    // Normaliza role: se inválida ou não fornecida, define padrão
    const normalizedRole =
      role && Object.values(Role).includes(role)
        ? role
        : tipoUsuario === TipoUsuario.PESSOA_JURIDICA
        ? Role.EMPRESA
        : Role.ALUNO_CANDIDATO;

    // Processa dados específicos por tipo de usuário
    const processedData = await processUserTypeSpecificData(
      dadosUsuario,
      correlationId
    );
    if (!processedData.success) {
      console.warn(
        `⚠️ [${correlationId}] Erro no processamento específico: ${processedData.error}`
      );
      return res.status(400).json({
        success: false,
        message: processedData.error,
        correlationId,
      });
    }

    // Verifica duplicatas com verificação otimizada
    const duplicateCheck = await checkForDuplicates(
      {
        email,
        supabaseId,
        cpf: processedData.cpfLimpo,
        cnpj: processedData.cnpjLimpo,
      },
      correlationId
    );

    if (duplicateCheck.found) {
      console.warn(
        `⚠️ [${correlationId}] Usuário duplicado: ${duplicateCheck.reason}`
      );
      return res.status(409).json({
        success: false,
        message: duplicateCheck.reason,
        correlationId,
      });
    }

    // Gera hash da senha com salt seguro
    console.log(`🔐 [${correlationId}] Gerando hash da senha`);
    const senhaHash = await bcrypt.hash(senha, 12);

    // Prepara dados para inserção no banco
    const userData = buildUserDataForDatabase({
      nomeCompleto,
      email,
      senha: senhaHash,
      telefone,
      tipoUsuario,
      role: normalizedRole,
      aceitarTermos,
      supabaseId,
      cpfLimpo: processedData.cpfLimpo,
      cnpjLimpo: processedData.cnpjLimpo,
      dataNascimento: processedData.dataNascimento,
      generoValidado: processedData.generoValidado,
    });

    // Cria usuário dentro de transação
    console.log(`💾 [${correlationId}] Iniciando transação de banco`);
    const usuario = await createUserWithTransaction(userData, correlationId);

    const duration = Date.now() - startTime;
    console.log(
      `✅ [${correlationId}] Usuário criado com sucesso em ${duration}ms`
    );

    // ===================================================================
    // CRÍTICO: Prepara dados para middleware de email de boas-vindas
    // ===================================================================
    console.log(
      `📧 [${correlationId}] Preparando dados para middleware de email`
    );

    res.locals.usuarioCriado = {
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nomeCompleto: usuario.nomeCompleto,
        tipoUsuario: usuario.tipoUsuario,
        // Dados adicionais para personalização do email
        role: usuario.role,
        status: usuario.status,
        criadoEm: usuario.criadoEm,
        codigoUsuario: usuario.codigoUsuario,
      },
      // Metadados para debugging
      correlationId,
      createdAt: new Date().toISOString(),
      source: "register-controller",
      emailShouldBeSent: true, // Flag explícita para o middleware
    };

    console.log(
      `📧 [${correlationId}] Dados do usuário salvos em res.locals:`,
      {
        email: usuario.email,
        nome: usuario.nomeCompleto,
        id: usuario.id,
      }
    );

    // Resposta de sucesso
    const userTypeLabel =
      tipoUsuario === TipoUsuario.PESSOA_FISICA ? "Pessoa física" : "Empresa";

    res.status(201).json({
      success: true,
      message: `${userTypeLabel} cadastrada com sucesso`,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nomeCompleto: usuario.nomeCompleto,
        tipoUsuario: usuario.tipoUsuario,
        role: usuario.role,
        status: usuario.status,
        criadoEm: usuario.criadoEm,
        codigoUsuario: usuario.codigoUsuario,
      },
      correlationId,
      duration: `${duration}ms`,
    });

    // IMPORTANTE: Não retorna aqui, deixa o middleware processar
    console.log(
      `🔄 [${correlationId}] Resposta enviada, aguardando middleware`
    );

    // Continua para o próximo middleware (ex: envio de email)
    next();
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";

    console.error(
      `❌ [${correlationId}] Erro crítico na criação de usuário após ${duration}ms:`,
      error
    );

    // Log estruturado para monitoramento
    if (process.env.NODE_ENV === "production") {
      // Em produção, evita vazar detalhes do erro
      res.status(500).json({
        success: false,
        message: "Erro interno do servidor ao criar usuário",
        correlationId,
        timestamp: new Date().toISOString(),
      });
    } else {
      // Em desenvolvimento, fornece mais detalhes
      res.status(500).json({
        success: false,
        message: "Erro interno do servidor ao criar usuário",
        error: errorMessage,
        correlationId,
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }
};

/**
 * Valida dados de entrada de forma robusta
 */
async function validateUserInput(
  dadosUsuario: CriarUsuarioData,
  correlationId: string
): Promise<{ isValid: boolean; errors?: string[] }> {
  const errors: string[] = [];

  try {
    const {
      nomeCompleto,
      telefone,
      email,
      senha,
      confirmarSenha,
      aceitarTermos,
      supabaseId,
      tipoUsuario,
    } = dadosUsuario;

    // Validação de campos obrigatórios básicos
    const requiredFields = [
      { field: "nomeCompleto", value: nomeCompleto },
      { field: "telefone", value: telefone },
      { field: "email", value: email },
      { field: "senha", value: senha },
      { field: "confirmarSenha", value: confirmarSenha },
      { field: "supabaseId", value: supabaseId },
      { field: "tipoUsuario", value: tipoUsuario },
    ];

    for (const { field, value } of requiredFields) {
      if (!value || (typeof value === "string" && value.trim() === "")) {
        errors.push(`Campo obrigatório: ${field}`);
      }
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    // Validação de email
    if (!validarEmail(email)) {
      errors.push("Formato de email inválido");
    }

    // Validação de senha
    const validacaoSenha = validarSenha(senha);
    if (!validacaoSenha.valida) {
      errors.push(...validacaoSenha.mensagens);
    }

    // Validação de confirmação de senha
    if (!validarConfirmacaoSenha(senha, confirmarSenha)) {
      errors.push("Confirmação de senha não confere");
    }

    // Validação de telefone
    if (!validarTelefone(telefone)) {
      errors.push("Formato de telefone inválido");
    }

    // Validação de termos
    if (!aceitarTermos) {
      errors.push("É necessário aceitar os termos de uso");
    }

    // Validação de tipo de usuário
    if (!Object.values(TipoUsuario).includes(tipoUsuario)) {
      errors.push("Tipo de usuário inválido");
    }

    console.log(
      `✅ [${correlationId}] Validação básica concluída com ${errors.length} erros`
    );

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error(`❌ [${correlationId}] Erro na validação:`, error);
    return { isValid: false, errors: ["Erro interno na validação"] };
  }
}

/**
 * Processa dados específicos por tipo de usuário
 */
async function processUserTypeSpecificData(
  dadosUsuario: CriarUsuarioData,
  correlationId: string
): Promise<{
  success: boolean;
  error?: string;
  cpfLimpo?: string;
  cnpjLimpo?: string;
  dataNascimento?: Date;
  generoValidado?: string;
}> {
  try {
    const { tipoUsuario } = dadosUsuario;

    if (tipoUsuario === TipoUsuario.PESSOA_FISICA) {
      const dadosPF = dadosUsuario as CriarPessoaFisicaData;

      // Validações específicas para Pessoa Física
      if (!dadosPF.cpf) {
        return {
          success: false,
          error: "Para pessoa física é obrigatório: CPF",
        };
      }

      // Valida CPF
      const cpfLimpo = limparDocumento(dadosPF.cpf);
      if (!validarCPF(cpfLimpo)) {
        return {
          success: false,
          error: "CPF deve ter 11 dígitos válidos",
        };
      }

      // Valida data de nascimento se fornecida
      let dataNascimento: Date | undefined;
      if (dadosPF.dataNasc) {
        const validacaoData = validarDataNascimento(dadosPF.dataNasc);
        if (!validacaoData.valida) {
          return {
            success: false,
            error: validacaoData.mensagem,
          };
        }
        dataNascimento = new Date(dadosPF.dataNasc);
      }

      // Valida gênero se fornecido
      let generoValidado: string | undefined;
      if (dadosPF.genero) {
        if (!validarGenero(dadosPF.genero)) {
          return {
            success: false,
            error:
              "Gênero deve ser: MASCULINO, FEMININO, OUTRO ou NAO_INFORMAR",
          };
        }
        generoValidado = dadosPF.genero.toUpperCase();
      }

      console.log(`✅ [${correlationId}] Dados de pessoa física validados`);

      return {
        success: true,
        cpfLimpo,
        dataNascimento,
        generoValidado,
      };
    } else if (tipoUsuario === TipoUsuario.PESSOA_JURIDICA) {
      const dadosPJ = dadosUsuario as CriarPessoaJuridicaData;

      // Validações específicas para Pessoa Jurídica
      if (!dadosPJ.cnpj) {
        return {
          success: false,
          error: "Para pessoa jurídica é obrigatório: CNPJ",
        };
      }

      // Valida CNPJ
      const cnpjLimpo = limparDocumento(dadosPJ.cnpj);
      if (!validarCNPJ(cnpjLimpo)) {
        return {
          success: false,
          error: "CNPJ deve ter 14 dígitos válidos",
        };
      }

      console.log(`✅ [${correlationId}] Dados de pessoa jurídica validados`);

      return {
        success: true,
        cnpjLimpo,
      };
    }

    return {
      success: false,
      error: "Tipo de usuário não reconhecido",
    };
  } catch (error) {
    console.error(
      `❌ [${correlationId}] Erro no processamento específico:`,
      error
    );
    return {
      success: false,
      error: "Erro interno no processamento dos dados",
    };
  }
}

/**
 * Verifica duplicatas de forma otimizada
 * CORREÇÃO: Tipagem explícita corrigida para resolver erro do Prisma OR conditions
 */
async function checkForDuplicates(
  data: {
    email: string;
    supabaseId: string;
    cpf?: string;
    cnpj?: string;
  },
  correlationId: string
): Promise<{ found: boolean; reason?: string }> {
  try {
    console.log(`🔍 [${correlationId}] Verificando duplicatas`);

    // CORREÇÃO: Tipagem explícita corrigida para Array
    type WhereCondition =
      | { email: string }
      | { supabaseId: string }
      | { cpf: string }
      | { cnpj: string };

    const orConditions: WhereCondition[] = [
      { email: data.email },
      { supabaseId: data.supabaseId },
    ];

    // Adiciona condições específicas se fornecidas
    if (data.cpf) {
      orConditions.push({ cpf: data.cpf });
    }

    if (data.cnpj) {
      orConditions.push({ cnpj: data.cnpj });
    }

    // Busca com tipagem correta
    const usuarioExistente = await prisma.usuario.findFirst({
      where: { OR: orConditions },
      select: {
        email: true,
        cpf: true,
        cnpj: true,
        supabaseId: true,
      },
    });

    if (usuarioExistente) {
      let reason = "Já existe usuário cadastrado com ";

      // Verifica qual campo causou a duplicata
      if (usuarioExistente.email === data.email) {
        reason += "este email";
      } else if (data.cpf && usuarioExistente.cpf === data.cpf) {
        reason += "este CPF";
      } else if (data.cnpj && usuarioExistente.cnpj === data.cnpj) {
        reason += "este CNPJ";
      } else if (usuarioExistente.supabaseId === data.supabaseId) {
        reason += "este ID do Supabase";
      } else {
        reason += "estes dados";
      }

      return { found: true, reason };
    }

    console.log(`✅ [${correlationId}] Nenhuma duplicata encontrada`);
    return { found: false };
  } catch (error) {
    console.error(
      `❌ [${correlationId}] Erro na verificação de duplicatas:`,
      error
    );
    // Em caso de erro na verificação, assume que não há duplicatas
    // para não bloquear o registro desnecessariamente
    return { found: false };
  }
}

/**
 * Constrói dados para inserção no banco
 */
function buildUserDataForDatabase(params: {
  nomeCompleto: string;
  email: string;
  senha: string;
  telefone: string;
  tipoUsuario: TipoUsuario;
  role: Role;
  aceitarTermos: boolean;
  supabaseId: string;
  cpfLimpo?: string;
  cnpjLimpo?: string;
  dataNascimento?: Date;
  generoValidado?: string;
}) {
  return {
    nomeCompleto: params.nomeCompleto.trim(),
    email: params.email.toLowerCase().trim(),
    senha: params.senha,
    telefone: params.telefone.trim(),
    tipoUsuario: params.tipoUsuario,
    role: params.role,
    aceitarTermos: params.aceitarTermos,
    supabaseId: params.supabaseId,
    ...(params.cpfLimpo && { cpf: params.cpfLimpo }),
    ...(params.cnpjLimpo && { cnpj: params.cnpjLimpo }),
    ...(params.dataNascimento && { dataNasc: params.dataNascimento }),
    ...(params.generoValidado && { genero: params.generoValidado }),
  };
}

/**
 * Cria usuário dentro de transação segura
 */
async function createUserWithTransaction(userData: any, correlationId: string) {
  try {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      console.log(`💾 [${correlationId}] Inserindo usuário no banco`);

      const usuario = await tx.usuario.create({
        data: userData,
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

      console.log(
        `✅ [${correlationId}] Usuário inserido com ID: ${usuario.id}`
      );

      const codigo = await tx.codigoUsuario.create({
        data: {
          usuarioId: usuario.id,
          tipo:
            userData.tipoUsuario === TipoUsuario.PESSOA_JURIDICA
              ? CodigoTipo.EMPRESA
              : CodigoTipo.USUARIO,
        },
      });

      return { ...usuario, codigoUsuario: codigo.codigo };
    });
  } catch (error) {
    console.error(`❌ [${correlationId}] Erro na transação de banco:`, error);

    // Tratamento específico para erros de constraint do Prisma
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      throw new Error(
        "Dados duplicados: email, CPF, CNPJ ou ID do Supabase já existem"
      );
    }

    throw error;
  }
}

/**
 * Gera ID de correlação único para rastreamento
 */
function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 8);
  return `reg-${timestamp}-${random}`;
}
