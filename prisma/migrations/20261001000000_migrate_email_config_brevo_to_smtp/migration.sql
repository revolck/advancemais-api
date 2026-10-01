-- Migração Brevo -> SMTP + Brevo (configurações gerais, categoria "emails").
-- Overrides que continuam válidos são renomeados para as novas chaves.
-- O remetente (brevo_from_email) não é migrado: no SMTP ele precisa ser a
-- própria caixa autenticada, definida por SMTP_FROM_EMAIL.
-- brevo_api_key continua em uso (canal Brevo) e não é alterada.
UPDATE "SistemaConfiguracoes" AS c
SET "chave" = m.nova, "atualizadoEm" = NOW()
FROM (VALUES
  ('brevo_from_name', 'smtp_from_name'),
  ('brevo_password_recovery_expiration_hours', 'password_recovery_expiration_hours'),
  ('brevo_password_recovery_max_attempts', 'password_recovery_max_attempts'),
  ('brevo_password_recovery_cooldown_minutes', 'password_recovery_cooldown_minutes'),
  ('brevo_daily_email_limit', 'brevo_daily_limit')
) AS m(antiga, nova)
WHERE c."categoria" = 'emails'
  AND c."chave" = m.antiga
  AND NOT EXISTS (
    SELECT 1
    FROM "SistemaConfiguracoes" AS existente
    WHERE existente."categoria" = 'emails'
      AND existente."chave" = m.nova
  );

-- Remove as configurações antigas que deixaram de existir (relay SMTP da
-- Brevo, SMS, retries, templates e remetente).
DELETE FROM "SistemaConfiguracoes"
WHERE "categoria" = 'emails'
  AND "chave" IN (
    'brevo_from_email',
    'brevo_from_name',
    'brevo_smtp_host',
    'brevo_smtp_port',
    'brevo_smtp_user',
    'brevo_smtp_password',
    'brevo_password_recovery_expiration_hours',
    'brevo_password_recovery_max_attempts',
    'brevo_password_recovery_cooldown_minutes',
    'brevo_max_retries',
    'brevo_retry_delay',
    'brevo_timeout',
    'brevo_daily_email_limit',
    'brevo_daily_sms_limit',
    'brevo_sms_sender',
    'brevo_sms_unicode',
    'brevo_template_cache',
    'brevo_preload_templates'
  );
