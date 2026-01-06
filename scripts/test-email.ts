/**
 * Script para testar envio de email via Brevo
 *
 * Uso: pnpm ts-node scripts/test-email.ts
 */

import 'dotenv/config';
import { BrevoClient } from '../src/modules/brevo/client/brevo-client';

async function testEmail() {
  console.log('📧 Testando envio de email via Brevo...\n');

  const client = BrevoClient.getInstance();

  // Verificar se está configurado (mas não bloquear se falhar - pode ser apenas IP não autorizado)
  const health = await client.healthCheck();
  console.log(
    `✅ Health check: ${health ? 'OK' : 'FALHOU (pode ser apenas IP não autorizado - tentaremos enviar mesmo assim)'}\n`,
  );

  // Não bloquear se health check falhar - pode ser apenas restrição de IP
  // O envio de email pode funcionar mesmo assim

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
            Este é um email de teste enviado da API Advance+ usando o serviço Brevo.
          </p>
          <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #4CAF50; margin: 20px 0;">
            <p style="margin: 0; color: #555;">
              <strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
            </p>
            <p style="margin: 5px 0 0 0; color: #555;">
              <strong>Serviço:</strong> Brevo API
            </p>
          </div>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            Se você recebeu este email, significa que a configuração do Brevo está funcionando corretamente! ✅
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

Este é um email de teste enviado da API Advance+ usando o serviço Brevo.

Data/Hora: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
Serviço: Brevo API

Se você recebeu este email, significa que a configuração do Brevo está funcionando corretamente! ✅

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
