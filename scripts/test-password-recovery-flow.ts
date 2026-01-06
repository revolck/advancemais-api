/**
 * Script para testar o fluxo completo de recuperação de senha
 */
import 'dotenv/config';
import { EmailService } from '../src/modules/brevo/services/email-service';
import { prisma } from '../src/config/prisma';
import { logger } from '../src/utils/logger';

const log = logger.child({ module: 'PasswordRecoveryTest' });

async function testPasswordRecovery() {
  const cpf = '08705420440';
  const cpfLimpo = cpf.replace(/\D/g, '');

  log.info(`🔍 Buscando usuário com CPF: ${cpfLimpo}`);

  const usuario = await prisma.usuarios.findFirst({
    where: {
      cpf: cpfLimpo,
      status: 'ATIVO',
    },
    select: {
      id: true,
      email: true,
      nomeCompleto: true,
      cpf: true,
      status: true,
    },
  });

  if (!usuario) {
    log.error('❌ Usuário não encontrado');
    await prisma.$disconnect();
    return;
  }

  log.info('✅ Usuário encontrado:', {
    id: usuario.id,
    email: usuario.email,
    nomeCompleto: usuario.nomeCompleto,
  });

  // Testar envio de email
  const emailService = new EmailService();
  const token = 'test-token-' + Date.now();

  log.info('📧 Enviando email de recuperação...');
  const result = await emailService.enviarEmailRecuperacaoSenha(usuario, token);

  if (result.success) {
    log.info('✅ Email enviado com sucesso!', {
      messageId: result.messageId,
      simulated: result.simulated,
    });
  } else {
    log.error('❌ Falha ao enviar email:', {
      error: result.error,
    });
  }

  await prisma.$disconnect();
}

testPasswordRecovery().catch((error) => {
  logger.error({ err: error }, '❌ Erro no teste');
  process.exit(1);
});
