/**
 * Utilitários para o módulo MercadoPago
 */

/**
 * Formata valor monetário para o formato do MercadoPago
 * @param value Valor em centavos ou reais
 * @param fromCents Se o valor está em centavos
 * @returns Valor formatado para MercadoPago (sempre em unidade monetária)
 */
export const formatCurrency = (
  value: number,
  fromCents: boolean = false
): number => {
  if (fromCents) {
    return Math.round(value) / 100;
  }
  return Math.round(value * 100) / 100;
};

/**
 * Converte valor de reais para centavos
 * @param value Valor em reais
 * @returns Valor em centavos
 */
export const toCents = (value: number): number => {
  return Math.round(value * 100);
};

/**
 * Converte valor de centavos para reais
 * @param value Valor em centavos
 * @returns Valor em reais
 */
export const fromCents = (value: number): number => {
  return Math.round(value) / 100;
};

/**
 * Valida se um valor monetário é válido
 * @param value Valor para validar
 * @returns true se válido
 */
export const isValidAmount = (value: number): boolean => {
  return (
    typeof value === "number" && !isNaN(value) && isFinite(value) && value > 0
  );
};

/**
 * Gera external_reference único baseado em dados do usuário
 * @param usuarioId ID do usuário
 * @param type Tipo da transação
 * @returns External reference único
 */
export const generateExternalReference = (
  usuarioId: string,
  type: "order" | "subscription" = "order"
): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 5);
  return `${type}_${usuarioId}_${timestamp}_${random}`;
};

/**
 * Valida formato de documento (CPF/CNPJ)
 * @param document Documento para validar
 * @returns Objeto com tipo e validação
 */
export const validateDocument = (
  document: string
): {
  type: "CPF" | "CNPJ" | "INVALID";
  isValid: boolean;
  cleaned: string;
} => {
  const cleaned = document.replace(/\D/g, "");

  if (cleaned.length === 11) {
    return {
      type: "CPF",
      isValid: isValidCPF(cleaned),
      cleaned,
    };
  } else if (cleaned.length === 14) {
    return {
      type: "CNPJ",
      isValid: isValidCNPJ(cleaned),
      cleaned,
    };
  }

  return {
    type: "INVALID",
    isValid: false,
    cleaned,
  };
};

/**
 * Valida CPF
 * @param cpf CPF limpo (apenas números)
 * @returns true se válido
 */
const isValidCPF = (cpf: string): boolean => {
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i)) * (10 - i);
  }

  let remainder = 11 - (sum % 11);
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i)) * (11 - i);
  }

  remainder = 11 - (sum % 11);
  if (remainder === 10 || remainder === 11) remainder = 0;

  return remainder === parseInt(cpf.charAt(10));
};

/**
 * Valida CNPJ
 * @param cnpj CNPJ limpo (apenas números)
 * @returns true se válido
 */
const isValidCNPJ = (cnpj: string): boolean => {
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) {
    return false;
  }

  const weights = [6, 7, 8, 9, 2, 3, 4, 5, 6, 7, 8, 9];

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cnpj.charAt(i)) * weights[i];
  }

  let remainder = sum % 11;
  if (remainder < 2) remainder = 0;
  else remainder = 11 - remainder;

  if (remainder !== parseInt(cnpj.charAt(12))) return false;

  sum = 0;
  weights.unshift(5);
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cnpj.charAt(i)) * weights[i];
  }

  remainder = sum % 11;
  if (remainder < 2) remainder = 0;
  else remainder = 11 - remainder;

  return remainder === parseInt(cnpj.charAt(13));
};

/**
 * Formata telefone para padrão brasileiro
 * @param phone Telefone para formatar
 * @returns Telefone formatado
 */
export const formatPhone = (
  phone: string
): {
  areaCode: string;
  number: string;
  formatted: string;
} => {
  const cleaned = phone.replace(/\D/g, "");

  if (cleaned.length === 11) {
    const areaCode = cleaned.substr(0, 2);
    const number = cleaned.substr(2);
    return {
      areaCode,
      number,
      formatted: `(${areaCode}) ${number.substr(0, 5)}-${number.substr(5)}`,
    };
  } else if (cleaned.length === 10) {
    const areaCode = cleaned.substr(0, 2);
    const number = cleaned.substr(2);
    return {
      areaCode,
      number,
      formatted: `(${areaCode}) ${number.substr(0, 4)}-${number.substr(4)}`,
    };
  }

  return {
    areaCode: "",
    number: cleaned,
    formatted: phone,
  };
};

/**
 * Calcula hash para idempotência
 * @param data Dados para calcular hash
 * @returns Hash MD5
 */
export const calculateIdempotencyKey = (data: any): string => {
  const crypto = require("crypto");
  const str = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash("md5").update(str).digest("hex");
};

/**
 * Máscara de dados sensíveis para logs
 * @param data Dados para mascarar
 * @returns Dados mascarados
 */
export const maskSensitiveData = (data: any): any => {
  const masked = JSON.parse(JSON.stringify(data));

  const sensitiveFields = [
    "access_token",
    "card_token",
    "security_code",
    "token",
    "password",
    "secret",
  ];

  const maskValue = (obj: any, key: string) => {
    if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
      obj[key] = "***MASKED***";
    }
  };

  const traverse = (obj: any) => {
    if (obj && typeof obj === "object") {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          maskValue(obj, key);
          if (typeof obj[key] === "object") {
            traverse(obj[key]);
          }
        }
      }
    }
  };

  traverse(masked);
  return masked;
};

/**
 * Converte status do MercadoPago para status interno
 * @param mpStatus Status do MercadoPago
 * @returns Status interno padronizado
 */
export const mapMercadoPagoStatus = (mpStatus: string): string => {
  const statusMap: Record<string, string> = {
    pending: "PENDENTE",
    approved: "APROVADO",
    authorized: "AUTORIZADO",
    in_process: "PROCESSANDO",
    in_mediation: "EM_MEDIACAO",
    rejected: "REJEITADO",
    cancelled: "CANCELADO",
    refunded: "REEMBOLSADO",
    charged_back: "CHARGEBACK",
    opened: "ABERTO",
    closed: "FECHADO",
    expired: "EXPIRADO",
    paused: "PAUSADO",
  };

  return statusMap[mpStatus] || mpStatus.toUpperCase();
};
