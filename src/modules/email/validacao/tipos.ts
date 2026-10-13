/**
 * Categorias de validação de um endereço:
 * - VALIDO: caixa confirmada (validador externo ou entrega real); elegível para envio
 * - INVALIDO: não existe / domínio não recebe e-mail; não enviar
 * - RISCO: aceita qualquer endereço, erro de digitação, descartável, armadilha; não enviar automaticamente
 * - DESCONHECIDO: o validador não conseguiu concluir; revisão manual
 * - TEMPORARIO: falha temporária (DNS, servidor ocupado); valida de novo mais tarde
 * - BLOQUEADO: bloqueado na Brevo (devolução, denúncia de spam, descadastro); nunca enviar
 * - PENDENTE: passou nas checagens locais, aguardando o validador externo
 */
export const RESULTADOS_VALIDACAO = [
  'VALIDO',
  'INVALIDO',
  'RISCO',
  'DESCONHECIDO',
  'TEMPORARIO',
  'BLOQUEADO',
  'PENDENTE',
] as const;

export type ResultadoValidacao = (typeof RESULTADOS_VALIDACAO)[number];

export type FonteValidacao = 'LOCAL' | 'BREVO' | 'ZEROBOUNCE' | 'NEVERBOUNCE' | 'KICKBOX';

export interface ValidacaoEmail {
  resultado: ResultadoValidacao;
  motivo: string;
  sugestao?: string | null;
  detalhes?: Record<string, unknown>;
}

export type CodigoErroValidador =
  | 'CREDENCIAL_INVALIDA'
  | 'SEM_CREDITOS'
  | 'LIMITE_DE_TAXA'
  | 'INDISPONIVEL';

/** Falha do serviço de validação (não do endereço): interrompe o lote sem classificar ninguém */
export class ErroValidador extends Error {
  constructor(
    public readonly codigo: CodigoErroValidador,
    message: string,
  ) {
    super(message);
    this.name = 'ErroValidador';
  }
}

export interface ValidadorExterno {
  readonly fonte: FonteValidacao;
  validar(email: string): Promise<ValidacaoEmail>;
}
