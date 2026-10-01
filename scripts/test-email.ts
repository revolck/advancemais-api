/**
 * Script para testar envio de email via SMTP
 *
 * Uso: pnpm ts-node scripts/test-email.ts
 */

import 'dotenv/config';
import { SmtpClient } from '../src/modules/email/client/smtp-client';

async function testEmail() {
  console.log('📧 Testando envio de email via SMTP...\n');

  const client = SmtpClient.getInstance();

  // Health check: conecta e autentica no servidor SMTP
  const health = await client.healthCheck();
  console.log(`${health ? '✅' : '❌'} Health check SMTP: ${health ? 'OK' : 'FALHOU'}`);
  if (!health) {
    console.log(client.getLastOperationalIssue());
  }
  if (client.isSimulated()) {
    console.log('⚠️  SMTP não configurado: o envio será simulado');
  }
  console.log('');

  // Email de teste
  const testEmail = 'devfilipemarques@gmail.com';
  const testSubject = 'Teste de Email - Advance+ API';
  const testHtml = `
    <html>
      <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h1 style="color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px;">
            🎉 Teste de Email
          </h1>
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            Este é um email de teste enviado da API Advance+ via SMTP.
          </p>
          <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #4CAF50; margin: 20px 0;">
            <p style="margin: 0; color: #555;">
              <strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
            </p>
            <p style="margin: 5px 0 0 0; color: #555;">
              <strong>Serviço:</strong> SMTP (${client.getConfig().smtp.host})
            </p>
          </div>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            Se você recebeu este email, significa que a configuração SMTP está funcionando corretamente! ✅
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            Advance+ API - Sistema de Email
          </p>
        </div>
      </body>
    </html>
  `;

  const testText = `
Teste de Email - Advance+ API

Este é um email de teste enviado da API Advance+ via SMTP.

Data/Hora: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
Serviço: SMTP (${client.getConfig().smtp.host})

Se você recebeu este email, significa que a configuração SMTP está funcionando corretamente! ✅

---
Advance+ API - Sistema de Email
  `;

  try {
    console.log(`📤 Enviando email para: ${testEmail}`);
    console.log(`📋 Assunto: ${testSubject}\n`);

    const result = await client.sendEmail({
      to: testEmail,
      toName: 'Filipe (Teste)',
      subject: testSubject,
      html: testHtml,
      text: testText,
    });

    if (result.success) {
      console.log('✅ Email enviado com sucesso!');
      console.log(`📨 Message ID: ${result.messageId}`);
      if (result.simulated) {
        console.log('⚠️  NOTA: Email foi simulado (modo de teste)');
      }
      console.log(`\n📧 Verifique a caixa de entrada de ${testEmail}`);
    } else {
      console.error('❌ Falha ao enviar email');
      if (result.error) {
        console.error(`Erro: ${result.error}`);
      }
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Erro ao enviar email:', error);
    process.exit(1);
  }
}

// Executar
testEmail()
  .then(() => {
    console.log('\n✅ Teste concluído');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro no teste:', error);
    process.exit(1);
  });
