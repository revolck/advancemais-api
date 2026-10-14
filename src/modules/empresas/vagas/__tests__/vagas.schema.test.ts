import { createVagaSchema, detalharErrosVaga, updateVagaSchema } from '../validators/vagas.schema';

const base = {
  usuarioId: '7d3c1f4e-1111-4a2b-9c3d-000000000001',
  regimeDeTrabalho: 'CLT',
  modalidade: 'PRESENCIAL',
  titulo: 'Atendente',
  jornada: 'INTEGRAL',
  descricao: 'Descrição',
  requisitos: { obrigatorios: ['Ensino médio'] },
  atividades: { principais: ['Atender clientes'] },
  salarioConfidencial: true,
};

const paragrafo =
  'Experiência comprovada em atendimento ao cliente, boa comunicação verbal e escrita, conhecimento do pacote Office, disponibilidade para trabalhar aos sábados, ensino médio completo e residir próximo ao local de trabalho para facilitar o deslocamento diário.';

describe('validação da vaga', () => {
  it('aceita requisito escrito como parágrafo (antes recusava acima de 255 caracteres)', () => {
    expect(paragrafo.length).toBeGreaterThan(255);
    const r = createVagaSchema.safeParse({
      ...base,
      requisitos: { obrigatorios: [paragrafo] },
      atividades: { principais: [paragrafo] },
      beneficios: { lista: [paragrafo] },
    });
    expect(r.success).toBe(true);
  });

  it('recusa item acima de 1000 caracteres, com caminho e mensagem claros', () => {
    const r = createVagaSchema.safeParse({
      ...base,
      requisitos: { obrigatorios: ['ok', 'x'.repeat(1001)] },
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    const { campos, primeira } = detalharErrosVaga(r.error);
    expect(campos).toEqual([
      {
        campo: 'requisitos.obrigatorios.1',
        mensagem: 'Cada requisito obrigatório deve ter no máximo 1000 caracteres',
      },
    ]);
    expect(primeira).toContain('1000 caracteres');
  });

  it('edição usa o mesmo limite', () => {
    expect(updateVagaSchema.safeParse({ atividades: { principais: [paragrafo] } }).success).toBe(
      true,
    );
  });
});
