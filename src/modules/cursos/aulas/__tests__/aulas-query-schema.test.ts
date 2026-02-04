import { listAulasQuerySchema } from '../validators/aulas.schema';

describe('listAulasQuerySchema', () => {
  it('parseia obrigatoria=false corretamente (string)', () => {
    const parsed = listAulasQuerySchema.parse({
      page: '1',
      pageSize: '10',
      obrigatoria: 'false',
    });

    expect(parsed.obrigatoria).toBe(false);
  });

  it('aceita arrays em modalidade/status e normaliza para CSV', () => {
    const parsed = listAulasQuerySchema.parse({
      page: '1',
      pageSize: '10',
      modalidade: ['ONLINE', 'AO_VIVO'],
      status: ['PUBLICADA', 'RASCUNHO'],
    });

    expect(parsed.modalidade).toBe('ONLINE,AO_VIVO');
    expect(parsed.status).toBe('PUBLICADA,RASCUNHO');
  });

  it('normaliza dataInicio/dataFim quando enviado como YYYY-MM-DD', () => {
    const parsed = listAulasQuerySchema.parse({
      page: '1',
      pageSize: '10',
      dataInicio: '2026-01-01',
      dataFim: '2026-01-31',
    });

    expect(parsed.dataInicio?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(parsed.dataFim?.toISOString()).toBe('2026-01-31T23:59:59.999Z');
  });

  it('aceita alias titulo (compat com telas que enviam "titulo")', () => {
    const parsed = listAulasQuerySchema.parse({
      page: '1',
      pageSize: '10',
      titulo: 'aula 1',
    });

    expect(parsed.titulo).toBe('aula 1');
  });
});
