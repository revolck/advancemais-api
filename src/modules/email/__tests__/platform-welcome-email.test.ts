import { EmailTemplates } from '../templates/email-templates';

const baseData = {
  nomeCompleto: 'Maria da Silva',
  platformUrl: 'https://auth.advancemais.com/login',
  coursesUrl: 'https://advancemais.com/cursos',
  jobsUrl: 'https://advancemais.com/vagas',
  resumeUrl: 'https://advancemais.com/dashboard/curriculo',
  maxCurriculos: 5,
};

describe('EmailTemplates.generatePlatformWelcomeEmail', () => {
  it('personaliza o primeiro nome e mostra o limite de currículos', () => {
    const email = EmailTemplates.generatePlatformWelcomeEmail(baseData);

    expect(email.subject).toBe('A Advance+ mudou: cursos, estudos e vagas em um só lugar');
    expect(email.html).toContain('Olá, Maria!');
    expect(email.html).toContain('Até 5 currículos para se candidatar');
    expect(email.html).toContain('href="https://auth.advancemais.com/login"');
    expect(email.text).toContain('Acesse a plataforma: https://auth.advancemais.com/login');
  });

  it('inclui o link de descadastro apenas quando informado', () => {
    const without = EmailTemplates.generatePlatformWelcomeEmail(baseData);
    const withLink = EmailTemplates.generatePlatformWelcomeEmail({
      ...baseData,
      unsubscribeUrl: 'https://advancemais.com/descadastro?t=abc',
    });

    expect(without.html).not.toContain('Não quero mais receber');
    expect(withLink.html).toContain('href="https://advancemais.com/descadastro?t=abc"');
    expect(withLink.text).toContain('https://advancemais.com/descadastro?t=abc');
  });

  it('usa a imagem/GIF de topo quando informada', () => {
    const email = EmailTemplates.generatePlatformWelcomeEmail({
      ...baseData,
      heroImageUrl: 'https://advancemais.com/images/emails/nova-plataforma.gif',
    });

    expect(email.html).toContain('src="https://advancemais.com/images/emails/nova-plataforma.gif"');
    expect(email.html).not.toContain('E ficou muito mais completa.');
  });
});
