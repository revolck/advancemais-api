import { listNotificacoesSchema } from '../validators/notificacoes.schema';

describe('listNotificacoesSchema', () => {
  it('aceita filtro simples enviado como string única', () => {
    const parsed = listNotificacoesSchema.parse({
      page: '1',
      pageSize: '10',
      tipo: 'RECUPERACAO_FINAL_PAGAMENTO_PENDENTE',
      apenasNaoLidas: 'true',
    });

    expect(parsed.tipo).toEqual(['RECUPERACAO_FINAL_PAGAMENTO_PENDENTE']);
    expect(parsed.apenasNaoLidas).toBe(true);
  });

  it('aceita CSV e arrays repetidos para status e prioridade', () => {
    const parsed = listNotificacoesSchema.parse({
      status: 'NAO_LIDA,LIDA',
      prioridade: ['ALTA', 'URGENTE'],
    });

    expect(parsed.status).toEqual(['NAO_LIDA', 'LIDA']);
    expect(parsed.prioridade).toEqual(['ALTA', 'URGENTE']);
  });

  it('normaliza aliases com colchetes', () => {
    const parsed = listNotificacoesSchema.parse({
      'tipo[]': 'RECUPERACAO_FINAL_PAGAMENTO_PENDENTE',
      'status[]': ['NAO_LIDA'],
      'prioridade[]': 'ALTA',
    });

    expect(parsed.tipo).toEqual(['RECUPERACAO_FINAL_PAGAMENTO_PENDENTE']);
    expect(parsed.status).toEqual(['NAO_LIDA']);
    expect(parsed.prioridade).toEqual(['ALTA']);
  });
});
