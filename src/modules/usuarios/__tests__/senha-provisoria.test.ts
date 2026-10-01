import { gerarSenhaProvisoria } from '../utils/senha-provisoria';

describe('gerarSenhaProvisoria', () => {
  it('gera 12 caracteres com maiúscula, minúscula, número e símbolo', () => {
    for (let i = 0; i < 200; i++) {
      const senha = gerarSenhaProvisoria();
      expect(senha).toHaveLength(12);
      expect(senha).toMatch(/[A-Z]/);
      expect(senha).toMatch(/[a-z]/);
      expect(senha).toMatch(/[2-9]/);
      expect(senha).toMatch(/[@#$%*!?]/);
      expect(senha).not.toMatch(/[0O1lI]/);
    }
  });

  it('gera senhas diferentes a cada chamada', () => {
    const senhas = new Set(Array.from({ length: 500 }, () => gerarSenhaProvisoria()));
    expect(senhas.size).toBe(500);
  });

  it('recusa tamanhos menores que 8', () => {
    expect(() => gerarSenhaProvisoria(6)).toThrow();
  });
});
