import { Roles, TiposDeUsuarios } from '../enums';
import { processUserTypeSpecificData } from '../register/user-creation-helpers';
import { adminCreateUserSchema } from '../validators/auth.schema';

describe('processUserTypeSpecificData', () => {
  const basePessoaFisica = {
    nomeCompleto: 'Maria Teste',
    telefone: '82999999999',
    email: 'maria.teste@example.com',
    senha: 'Senha123',
    confirmarSenha: 'Senha123',
    aceitarTermos: true,
    tipoUsuario: TiposDeUsuarios.PESSOA_FISICA,
    role: Roles.ALUNO_CANDIDATO,
    cpf: '00000000000',
  };

  it('aceita dataNascimento como alias de dataNasc no cadastro administrativo', async () => {
    const parsed = adminCreateUserSchema.parse({
      ...basePessoaFisica,
      dataNascimento: '1990-05-10',
    });

    const result = await processUserTypeSpecificData(parsed);

    expect(result.success).toBe(true);
    expect(result.dataNascimento?.toISOString()).toBe('1990-05-10T00:00:00.000Z');
  });

  it('normaliza CNPJ alfanumérico de pessoa jurídica sem máscara e em maiúsculas', async () => {
    const parsed = adminCreateUserSchema.parse({
      nomeCompleto: 'Empresa Teste',
      telefone: '82999999999',
      email: 'empresa.teste@example.com',
      senha: 'Senha123',
      confirmarSenha: 'Senha123',
      aceitarTermos: true,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      role: Roles.EMPRESA,
      cnpj: '12.abc.345/01de-35',
    });

    const result = await processUserTypeSpecificData(parsed);

    expect(result.success).toBe(true);
    expect(result.cnpjLimpo).toBe('12ABC34501DE35');
  });
});
