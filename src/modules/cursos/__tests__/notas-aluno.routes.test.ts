import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('rotas de notas do aluno', () => {
  it('registra /me/notas antes da rota genérica /:cursoId/notas', () => {
    const routesSource = readFileSync(resolve(__dirname, '../routes/index.ts'), 'utf8');

    const minhasNotasIndex = routesSource.indexOf("'/me/notas'");
    const notasPorCursoIndex = routesSource.indexOf("'/:cursoId/notas'");

    expect(minhasNotasIndex).toBeGreaterThanOrEqual(0);
    expect(notasPorCursoIndex).toBeGreaterThanOrEqual(0);
    expect(minhasNotasIndex).toBeLessThan(notasPorCursoIndex);
  });

  it('registra endpoints pessoais de frequência e estágios antes das rotas genéricas', () => {
    const routesSource = readFileSync(resolve(__dirname, '../routes/index.ts'), 'utf8');

    const minhasFrequenciasIndex = routesSource.indexOf("'/me/frequencias'");
    const frequenciasGlobaisIndex = routesSource.indexOf("'/frequencias'");
    const meusEstagiosIndex = routesSource.indexOf("'/me/estagios'");
    const estagiosGenericosIndex = routesSource.indexOf(
      "'/:cursoId/turmas/:turmaId/inscricoes/:inscricaoId/estagios'",
    );

    expect(minhasFrequenciasIndex).toBeGreaterThanOrEqual(0);
    expect(frequenciasGlobaisIndex).toBeGreaterThanOrEqual(0);
    expect(minhasFrequenciasIndex).toBeLessThan(frequenciasGlobaisIndex);
    expect(meusEstagiosIndex).toBeGreaterThanOrEqual(0);
    expect(estagiosGenericosIndex).toBeGreaterThanOrEqual(0);
    expect(meusEstagiosIndex).toBeLessThan(estagiosGenericosIndex);
  });

  it('registra pagamentos e acesso a recuperacao como rotas pessoais autenticadas', () => {
    const routesSource = readFileSync(resolve(__dirname, '../routes/index.ts'), 'utf8');

    expect(routesSource).toContain("'/me/pagamentos'");
    expect(routesSource).toContain("'/me/pagamentos/recuperacoes/:pagamentoId/checkout'");
    expect(routesSource).toContain("'/me/recuperacoes/:provaId/acesso'");
    expect(routesSource.indexOf("'/me/pagamentos'")).toBeLessThan(
      routesSource.indexOf("'/:cursoId/notas'"),
    );
  });
});
