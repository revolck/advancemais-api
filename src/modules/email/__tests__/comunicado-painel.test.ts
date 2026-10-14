jest.mock('@/config/prisma', () => ({ prisma: {} }));
jest.mock('@/modules/configuracoes-gerais', () => ({ runtimeConfigService: {} }));
jest.mock('../client/brevo-client', () => ({ BrevoClient: { getInstance: () => ({}) } }));
jest.mock('../comunicados/primeiro-acesso.cron', () => ({
  RESERVA_CREDITOS_BREVO: 300,
  getEstadoExecucao: () => ({}),
}));

import {
  avaliarSituacao,
  classificarPendencia,
  classificarProgresso,
  mascararCpf,
  type EntradaSituacao,
} from '../comunicados/primeiro-acesso.painel';

const validacao = (resultado: string, extra: Record<string, unknown> = {}) => ({
  email: 'a@x.com',
  resultado,
  fonte: 'ZEROBOUNCE',
  motivo: `MOTIVO_${resultado}`,
  sugestao: null,
  tentativas: 1,
  validadoEm: new Date(),
  proximaTentativaEm: null,
  ...extra,
});
const envio = (status: string, extra: Record<string, unknown> = {}) => ({
  status,
  email: 'a@gmail.com',
  tentativas: 1,
  erro: null,
  ...extra,
});

describe('pendências', () => {
  it('senha entregue em domínio com erro de digitação aparece como possivelmente exposta', () => {
    const p = classificarPendencia(
      { email: 'joao@hotmail.com.com', precisaTrocarSenha: true },
      envio('ENVIADO', { email: 'joao@hotmail.com.com' }),
      undefined,
    );
    expect(p).toMatchObject({ tipo: 'SENHA_POSSIVELMENTE_EXPOSTA', sugestao: 'joao@hotmail.com' });
  });

  it('não é pendência se o aluno já trocou a senha', () => {
    expect(
      classificarPendencia(
        { email: 'joao@hotmail.com.com', precisaTrocarSenha: false },
        envio('ENVIADO', { email: 'joao@hotmail.com.com' }),
        undefined,
      ),
    ).toBeNull();
  });

  it.each([
    ['DEVOLVIDO', 'EMAIL_DEVOLVIDO'],
    ['REVOGADO', 'SENHA_REVOGADA'],
    ['INCERTO', 'ENVIO_INCERTO'],
    ['DESCARTADO', 'EMAIL_INVALIDO'],
  ])('envio %s → %s', (status, tipo) => {
    expect(
      classificarPendencia(
        { email: 'a@gmail.com', precisaTrocarSenha: true },
        envio(status),
        undefined,
      )?.tipo,
    ).toBe(tipo);
  });

  it('quem ativou o acesso pelo CPF não é pendência', () => {
    expect(
      classificarPendencia(
        { email: 'a@gmail.com', precisaTrocarSenha: false },
        envio('CONCLUIDO_PELO_ALUNO'),
        validacao('INVALIDO'),
      ),
    ).toBeNull();
  });

  it('falha e devolução temporária só viram pendência depois do limite de tentativas', () => {
    const u = { email: 'a@gmail.com', precisaTrocarSenha: false };
    expect(classificarPendencia(u, envio('FALHA', { tentativas: 2 }), undefined)).toBeNull();
    expect(classificarPendencia(u, envio('FALHA', { tentativas: 3 }), undefined)?.tipo).toBe(
      'FALHA_NO_ENVIO',
    );
    expect(
      classificarPendencia(u, envio('DEVOLUCAO_TEMPORARIA', { tentativas: 2 }), undefined)?.tipo,
    ).toBe('DEVOLUCAO_TEMPORARIA_PERSISTENTE');
  });

  it.each([
    ['INVALIDO', 'EMAIL_INVALIDO'],
    ['BLOQUEADO', 'EMAIL_BLOQUEADO'],
    ['RISCO', 'EMAIL_DE_RISCO'],
    ['DESCONHECIDO', 'VALIDACAO_INCONCLUSIVA'],
  ])('ainda não enviado com validação %s → %s', (resultado, tipo) => {
    expect(
      classificarPendencia(
        { email: 'a@x.com', precisaTrocarSenha: false },
        undefined,
        validacao(resultado),
      )?.tipo,
    ).toBe(tipo);
  });

  it('VALIDO, PENDENTE e TEMPORARIO não são pendência', () => {
    for (const resultado of ['VALIDO', 'PENDENTE', 'TEMPORARIO']) {
      expect(
        classificarPendencia(
          { email: 'a@x.com', precisaTrocarSenha: false },
          undefined,
          validacao(resultado),
        ),
      ).toBeNull();
    }
  });

  it('mascara o CPF', () => {
    expect(mascararCpf('123.456.789-09')).toBe('***.456.789-**');
    expect(mascararCpf(null)).toBeNull();
  });
});

describe('progresso dos alunos', () => {
  const semLogin = { ultimoLogin: null };
  const pendencia = { tipo: 'EMAIL_DEVOLVIDO' as const, motivo: 'x', sugestao: null };

  it('pendência vem primeiro, para bater com a lista de pendências', () => {
    expect(classificarProgresso({ ultimoLogin: new Date() }, undefined, pendencia, false)).toBe(
      'precisamAtencao',
    );
  });

  it('já acessou: entrou na plataforma ou criou a senha pela recuperação', () => {
    expect(classificarProgresso({ ultimoLogin: new Date() }, undefined, null, false)).toBe(
      'jaAcessaram',
    );
    expect(
      classificarProgresso(
        semLogin,
        { status: 'CONCLUIDO_PELO_ALUNO', enviadoEm: null },
        null,
        false,
      ),
    ).toBe('jaAcessaram');
  });

  it('recebeu o comunicado e ainda não entrou', () => {
    expect(
      classificarProgresso(semLogin, { status: 'ENVIADO', enviadoEm: new Date() }, null, false),
    ).toBe('receberamComunicado');
  });

  it('na fila sem envio; o resto está em processamento ou nova tentativa', () => {
    expect(classificarProgresso(semLogin, undefined, null, true)).toBe('aguardandoPrimeiroAcesso');
    expect(classificarProgresso(semLogin, { status: 'FALHA', enviadoEm: null }, null, false)).toBe(
      'emAndamento',
    );
  });
});

describe('situação da campanha', () => {
  const base: EntradaSituacao = {
    ativo: true,
    restantes: 2900,
    prontosParaEnvio: 500,
    aguardandoValidacao: 0,
    temValidador: true,
    sincronizacaoOk: true,
    taxa: { pausado: false, taxaPercentual: 1, limite: 5, previsaoFim: null },
    rampa: { disponivelHoje: 100, limiteHoje: 200, limiteAmanha: 400 },
    creditosDisponiveis: 4000,
  };

  it('em andamento quando nada bloqueia', () => {
    expect(avaliarSituacao(base)[0].codigo).toBe('EM_ANDAMENTO');
  });

  it('pausa por devolução explica o motivo e quando retoma', () => {
    const [s] = avaliarSituacao({
      ...base,
      taxa: {
        pausado: true,
        taxaPercentual: 17.2,
        limite: 5,
        previsaoFim: new Date('2026-10-14T18:40:00Z'),
      },
    });
    expect(s.codigo).toBe('TAXA_DEVOLUCAO_ALTA');
    expect(s.detalhe).toContain('17.2%');
    expect(s.condicoesRetomada[0]).toContain('14/10/2026');
  });

  it('sem validador e sem validados: aguarda configuração', () => {
    const situacoes = avaliarSituacao({
      ...base,
      temValidador: false,
      prontosParaEnvio: 0,
      ativo: false,
    });
    expect(situacoes.map((s) => s.codigo)).toEqual(['SEM_VALIDADOR', 'DESLIGADO']);
  });

  it('falha de sincronização vem antes de tudo', () => {
    expect(avaliarSituacao({ ...base, sincronizacaoOk: false })[0].codigo).toBe(
      'FALHA_SINCRONIZACAO_BREVO',
    );
  });

  it('concluída quando não resta ninguém na fila', () => {
    expect(avaliarSituacao({ ...base, restantes: 0 })[0].codigo).toBe('CONCLUIDO');
  });
});
