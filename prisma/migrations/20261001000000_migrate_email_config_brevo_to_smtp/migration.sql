-- Migração Brevo -> SMTP (configurações gerais, categoria "emails").
-- Overrides que continuam válidos são renomeados para as novas chaves.
-- O remetente (brevo_from_email) não é migrado: no SMTP ele precisa ser a
-- própria caixa autenticada, definida por SMTP_FROM_EMAIL.
UPDATE "SistemaConfiguracoes" AS c
SET "chave" = m.nova, "atualizadoEm" = NOW()
FROM (VALUES
  ('brevo_from_name', 'smtp_from_name'),
  ('brevo_password_recovery_expiration_hours', 'password_recovery_expiration_hours'),
  ('brevo_password_recovery_max_attempts', 'password_recovery_max_attempts'),
  ('brevo_password_recovery_cooldown_minutes', 'password_recovery_cooldown_minutes')
) AS m(antiga, nova)
WHERE c."categoria" = 'emails'
  AND c."chave" = m.antiga
  AND NOT EXISTS (
    SELECT 1
    FROM "SistemaConfiguracoes" AS existente
    WHERE existente."categoria" = 'emails'
      AND existente."chave" = m.nova
  );

-- Remove as configurações exclusivas da Brevo (API key, relay SMTP da Brevo,
-- SMS, limites, retries e templates).
DELETE FROM "SistemaConfiguracoes"
WHERE "categoria" = 'emails'
  AND "chave" LIKE 'brevo\_%';
