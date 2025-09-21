export class VagaProcessoVagaNaoEncontradaError extends Error {
  readonly code = 'VAGA_PROCESSO_VAGA_NOT_FOUND';
  readonly status = 404;

  constructor() {
    super('Vaga não encontrada para associar o processo seletivo.');
    this.name = 'VagaProcessoVagaNaoEncontradaError';
  }
}

export class VagaProcessoCandidatoNaoEncontradoError extends Error {
  readonly code = 'VAGA_PROCESSO_CANDIDATO_NOT_FOUND';
  readonly status = 404;

  constructor() {
    super('Candidato não encontrado ou com perfil inválido para o processo seletivo.');
    this.name = 'VagaProcessoCandidatoNaoEncontradoError';
  }
}

export class VagaProcessoCandidatoInvalidoError extends Error {
  readonly code = 'VAGA_PROCESSO_INVALID_CANDIDATE_ROLE';
  readonly status = 400;

  constructor() {
    super('Somente perfis com role ALUNO_CANDIDATO podem ser vinculados a processos seletivos.');
    this.name = 'VagaProcessoCandidatoInvalidoError';
  }
}

export class VagaProcessoDuplicadoError extends Error {
  readonly code = 'VAGA_PROCESSO_DUPLICATED';
  readonly status = 409;

  constructor() {
    super('Já existe um processo seletivo ativo para o candidato nesta vaga.');
    this.name = 'VagaProcessoDuplicadoError';
  }
}

export class VagaProcessoNaoEncontradoError extends Error {
  readonly code = 'VAGA_PROCESSO_NOT_FOUND';
  readonly status = 404;

  constructor() {
    super('Processo seletivo não encontrado para a vaga informada.');
    this.name = 'VagaProcessoNaoEncontradoError';
  }
}
