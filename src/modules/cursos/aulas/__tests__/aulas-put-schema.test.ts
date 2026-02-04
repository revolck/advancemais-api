import { putUpdateAulaSchema } from '../validators/aulas.schema';

describe('putUpdateAulaSchema', () => {
  const base = {
    titulo: 'Aula 01',
    descricao: 'Descrição da aula',
    modalidade: 'ONLINE' as const,
    duracaoMinutos: 60,
    obrigatoria: true,
  };

  it('rejeita cursoId sem turmaId', () => {
    const result = putUpdateAulaSchema.safeParse({
      ...base,
      cursoId: '00000000-0000-0000-0000-000000000000',
      turmaId: null,
    });

    expect(result.success).toBe(false);
  });

  it('rejeita mais de 3 materiais', () => {
    const result = putUpdateAulaSchema.safeParse({
      ...base,
      materiais: [
        'https://example.com/1.pdf',
        'https://example.com/2.pdf',
        'https://example.com/3.pdf',
        'https://example.com/4.pdf',
      ],
    });

    expect(result.success).toBe(false);
  });
});
