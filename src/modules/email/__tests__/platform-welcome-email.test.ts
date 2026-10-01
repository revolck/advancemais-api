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

    expect(email.subject).toBe('A nova Advance+ está no ar 💻');
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
    expect(email.html).not.toContain('Novidade</div>');
  });

  it('liga o GIF e o link "Assistir ao vídeo" ao vídeo completo', () => {
    const email = EmailTemplates.generatePlatformWelcomeEmail({
      ...baseData,
      heroImageUrl: 'https://advancemais.com/images/emails/nova-plataforma.gif',
      videoUrl: 'https://advancemais.com/videos/novo-site-advancemais.mp4',
    });

    expect(email.html).toContain('Assistir ao vídeo completo');
    expect(
      email.html.match(/href="https:\/\/advancemais.com\/videos\/novo-site-advancemais.mp4"/g),
    ).toHaveLength(2);
    expect(email.text).toContain(
      'Assista ao vídeo: https://advancemais.com/videos/novo-site-advancemais.mp4',
    );
  });

  it('mostra login por CPF mascarado, senha provisória e troca obrigatória no primeiro acesso', () => {
    const email = EmailTemplates.generatePlatformWelcomeEmail({
      ...baseData,
      primeiroAcesso: { cpf: '123.456.789-09', senhaProvisoria: 'Kq7-mPz4-Rt' },
    });

    expect(email.html).toContain('Seu primeiro acesso');
    expect(email.html).toContain('Seu CPF (***.456.789-**)');
    expect(email.html).not.toContain('123.456.789-09');
    expect(email.html).toContain('Kq7-mPz4-Rt');
    expect(email.html).toContain('no primeiro acesso você vai criar uma nova senha');
    expect(email.html).toContain('Fazer meu primeiro acesso');
    expect(email.html).not.toContain('Use o mesmo e-mail e senha de sempre');
    expect(email.text).toContain('Senha provisória: Kq7-mPz4-Rt');
  });
});
