import { documentoDeLogin } from '../utils/documento-login';
import { EmailTemplates } from '@/modules/email/templates/email-templates';

describe('documento de login mostrado na recuperação', () => {
  it('empresa entra com o CNPJ (mascarado)', () => {
    expect(documentoDeLogin({ cnpj: '38.364.257/0001-90', cpf: null })).toEqual({
      tipo: 'CNPJ',
      mascarado: '**.***.257/0001-**',
    });
  });

  it('pessoa física entra com o CPF (mascarado)', () => {
    expect(documentoDeLogin({ cpf: '123.456.789-09' })).toEqual({
      tipo: 'CPF',
      mascarado: '***.456.789-**',
    });
  });

  it('sem documento válido não orienta', () => {
    expect(documentoDeLogin({ cpf: null, cnpj: '' })).toBeNull();
  });

  it('e-mail de recuperação diz com qual documento entrar', () => {
    const t = EmailTemplates.generatePasswordRecoveryEmail({
      nomeCompleto: 'Empresa X',
      linkRecuperacao: 'https://auth.advancemais.com/recuperar-senha?tp=x',
      expiracaoHoras: 1,
      maxTentativas: 3,
      loginDocumento: { tipo: 'CNPJ', mascarado: '**.***.257/0001-**' },
    });
    expect(t.html).toContain('entre com o seu <strong>CNPJ (**.***.257/0001-**)</strong>');
    expect(t.text).toContain('entre com o seu CNPJ (**.***.257/0001-**)');
  });
});
