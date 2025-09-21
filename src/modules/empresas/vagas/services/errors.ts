export class EmpresaSemPlanoAtivoError extends Error {
  code = 'EMPRESA_SEM_PLANO_ATIVO';

  constructor() {
    super('A empresa não possui um plano parceiro ativo no momento.');
    this.name = 'EmpresaSemPlanoAtivoError';
  }
}

export class UsuarioNaoEmpresaError extends Error {
  code = 'USUARIO_NAO_EMPRESA';

  constructor() {
    super('Somente usuários do tipo pessoa jurídica podem realizar esta operação.');
    this.name = 'UsuarioNaoEmpresaError';
  }
}

export class LimiteVagasPlanoAtingidoError extends Error {
  code = 'PLANO_EMPRESARIAL_LIMIT_VAGAS';
  readonly limite: number;

  constructor(limite: number) {
    super('O limite de vagas simultâneas do plano foi atingido.');
    this.name = 'LimiteVagasPlanoAtingidoError';
    this.limite = limite;
  }
}

export class PlanoNaoPermiteVagaDestaqueError extends Error {
  code = 'PLANO_EMPRESARIAL_SEM_DESTAQUE';

  constructor() {
    super('O plano atual não permite publicar vagas em destaque.');
    this.name = 'PlanoNaoPermiteVagaDestaqueError';
  }
}

export class LimiteVagasDestaqueAtingidoError extends Error {
  code = 'PLANO_EMPRESARIAL_LIMIT_DESTAQUE';
  readonly limite: number;

  constructor(limite: number) {
    super('O limite de vagas em destaque do plano foi atingido.');
    this.name = 'LimiteVagasDestaqueAtingidoError';
    this.limite = limite;
  }
}

type AreaSubareaReason = 'SUBAREA_REQUIRED' | 'SUBAREA_NOT_FOUND' | 'AREA_NOT_FOUND' | 'MISMATCH';

const AREA_SUBAREA_MESSAGES: Record<
  AreaSubareaReason,
  { message: string; code: string; status: number }
> = {
  SUBAREA_REQUIRED: {
    code: 'VAGA_SUBAREA_OBRIGATORIA',
    status: 400,
    message: 'Selecione uma subárea de interesse válida para a vaga.',
  },
  SUBAREA_NOT_FOUND: {
    code: 'VAGA_SUBAREA_INTERESSE_NAO_ENCONTRADA',
    status: 404,
    message: 'A subárea de interesse informada não foi encontrada.',
  },
  AREA_NOT_FOUND: {
    code: 'VAGA_AREA_INTERESSE_NAO_ENCONTRADA',
    status: 404,
    message: 'A área de interesse informada não foi encontrada.',
  },
  MISMATCH: {
    code: 'VAGA_AREA_SUBAREA_INCONSISTENTE',
    status: 400,
    message: 'A subárea selecionada não pertence à área de interesse informada.',
  },
};

export class VagaAreaSubareaError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(reason: AreaSubareaReason) {
    const { message, code, status } = AREA_SUBAREA_MESSAGES[reason];
    super(message);
    this.name = 'VagaAreaSubareaError';
    this.code = code;
    this.status = status;
  }
}
