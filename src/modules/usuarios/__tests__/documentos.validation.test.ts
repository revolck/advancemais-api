import {
  identificarTipoDocumento,
  normalizarCNPJ,
  normalizarCPF,
  normalizarDocumento,
  validarCNPJ,
  validarCPF,
} from '../utils/validation';

describe('documentos validation', () => {
  it('normaliza CPF apenas com dígitos', () => {
    expect(normalizarCPF(' 087.054.204-40 ')).toBe('08705420440');
    expect(validarCPF('087.054.204-40')).toBe(true);
  });

  it('normaliza e valida CNPJ alfanumérico com letras minúsculas e máscara', () => {
    expect(normalizarCNPJ('12.abc.345/01de-35')).toBe('12ABC34501DE35');
    expect(validarCNPJ('12.abc.345/01de-35')).toBe(true);
  });

  it('rejeita CNPJ alfanumérico com dígito verificador incorreto', () => {
    expect(validarCNPJ('12ABC34501DE00')).toBe(false);
  });

  it('identifica CPF e CNPJ no campo unificado', () => {
    expect(normalizarDocumento(' ab.12c.345/01de-02 ')).toBe('AB12C34501DE02');
    expect(identificarTipoDocumento('087.054.204-40')).toBe('cpf');
    expect(identificarTipoDocumento('12.abc.345/01de-35')).toBe('cnpj');
    expect(identificarTipoDocumento('12345678901234')).toBe('cnpj');
  });
});
