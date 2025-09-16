export class EmpresaSemPlanoAtivoError extends Error {
  code = 'EMPRESA_SEM_PLANO_ATIVO';

  constructor() {
    super('A empresa não possui um plano parceiro ativo no momento.');
    this.name = 'EmpresaSemPlanoAtivoError';
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
