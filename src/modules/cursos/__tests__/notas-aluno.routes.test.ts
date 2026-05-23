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
});
