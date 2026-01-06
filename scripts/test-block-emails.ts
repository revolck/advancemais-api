/**
 * Script para testar envio de emails de bloqueio e desbloqueio via Brevo
 *
 * Uso: pnpm tsx scripts/test-block-emails.ts
 */

import 'dotenv/config';
import { EmailService } from '../src/modules/brevo/services/email-service';
import { EmailTemplates } from '../src/modules/brevo/templates/email-templates';
import { TiposDeBloqueios } from '@prisma/client';

async function testBlockEmails() {
  console.log('📧 Testando envio de emails de bloqueio/desbloqueio via Brevo...\n');

  const emailService = new EmailService();
  const testEmail = 'devfilipemarques@gmail.com';
  const testUser = {
    id: 'test-user-block-123',
    email: testEmail,
    nomeCompleto: 'Filipe Reis Marques',
  };

  try {
    // Teste 1: Email de bloqueio temporário
    console.log('📤 1/4 Enviando email de BLOQUEIO TEMPORÁRIO...');
    const bloqueioTemporarioTemplate = EmailTemplates.generateUserBlockedEmail({
      nomeCompleto: testUser.nomeCompleto,
      motivo: 'Violação de termos de uso',
      fim: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
      descricao:
        'Conta bloqueada temporariamente por violação das políticas da plataforma. O bloqueio será automaticamente removido após o período de suspensão.',
      tipo: 'TEMPORARIO' as TiposDeBloqueios,
    });

    const resultado1 = await emailService.sendAssinaturaNotificacao(
      testUser,
      bloqueioTemporarioTemplate,
    );
    if (resultado1.success) {
      console.log('   ✅ Email de bloqueio temporário enviado!');
      if (resultado1.messageId) console.log(`   📨 Message ID: ${resultado1.messageId}`);
      if (resultado1.simulated) console.log('   ⚠️  (Modo simulado)');
    } else {
      console.log(`   ❌ Falha: ${resultado1.error}`);
    }

    console.log('\n⏳ Aguardando 2 segundos...\n');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Teste 2: Email de bloqueio permanente
    console.log('📤 2/4 Enviando email de BLOQUEIO PERMANENTE...');
    const bloqueioPermanenteTemplate = EmailTemplates.generateUserBlockedEmail({
      nomeCompleto: testUser.nomeCompleto,
      motivo: 'Atividades fraudulentas detectadas',
      fim: null,
      descricao:
        'Conta bloqueada permanentemente devido a atividades que violam nossos termos de serviço.',
      tipo: 'PERMANENTE' as TiposDeBloqueios,
    });

    const resultado2 = await emailService.sendAssinaturaNotificacao(
      testUser,
      bloqueioPermanenteTemplate,
    );
    if (resultado2.success) {
      console.log('   ✅ Email de bloqueio permanente enviado!');
      if (resultado2.messageId) console.log(`   📨 Message ID: ${resultado2.messageId}`);
      if (resultado2.simulated) console.log('   ⚠️  (Modo simulado)');
    } else {
      console.log(`   ❌ Falha: ${resultado2.error}`);
    }

    console.log('\n⏳ Aguardando 2 segundos...\n');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Teste 3: Email de bloqueio com restrição de recurso
    console.log('📤 3/4 Enviando email de RESTRIÇÃO DE RECURSO...');
    const restricaoTemplate = EmailTemplates.generateUserBlockedEmail({
      nomeCompleto: testUser.nomeCompleto,
      motivo: 'Limite de tentativas excedido',
      fim: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
      descricao:
        'Acesso restrito temporariamente devido ao limite de tentativas. Você poderá acessar novamente após o período de bloqueio.',
      tipo: 'RESTRICAO_DE_RECURSO' as TiposDeBloqueios,
    });

    const resultado3 = await emailService.sendAssinaturaNotificacao(testUser, restricaoTemplate);
    if (resultado3.success) {
      console.log('   ✅ Email de restrição de recurso enviado!');
      if (resultado3.messageId) console.log(`   📨 Message ID: ${resultado3.messageId}`);
      if (resultado3.simulated) console.log('   ⚠️  (Modo simulado)');
    } else {
      console.log(`   ❌ Falha: ${resultado3.error}`);
    }

    console.log('\n⏳ Aguardando 2 segundos...\n');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Teste 4: Email de desbloqueio
    console.log('📤 4/4 Enviando email de DESBLOQUEIO...');
    const desbloqueioTemplate = EmailTemplates.generateUserUnblockedEmail({
      nomeCompleto: testUser.nomeCompleto,
    });

    const resultado4 = await emailService.sendAssinaturaNotificacao(testUser, desbloqueioTemplate);
    if (resultado4.success) {
      console.log('   ✅ Email de desbloqueio enviado!');
      if (resultado4.messageId) console.log(`   📨 Message ID: ${resultado4.messageId}`);
      if (resultado4.simulated) console.log('   ⚠️  (Modo simulado)');
    } else {
      console.log(`   ❌ Falha: ${resultado4.error}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Testes concluídos!');
    console.log(`📧 Verifique a caixa de entrada de ${testEmail}`);
    console.log('='.repeat(60));
    console.log('\n📋 Emails enviados:');
    console.log('   1. Bloqueio Temporário (7 dias)');
    console.log('   2. Bloqueio Permanente');
    console.log('   3. Restrição de Recurso (24 horas)');
    console.log('   4. Desbloqueio');
  } catch (error) {
    console.error('\n❌ Erro ao enviar emails:', error);
    process.exit(1);
  }
}

// Executar
testBlockEmails()
  .then(() => {
    console.log('\n✅ Script finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro no script:', error);
    process.exit(1);
  });
