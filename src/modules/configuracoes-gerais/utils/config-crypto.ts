import crypto from 'crypto';

const ENCRYPTION_VERSION = 'v1';

export function isConfigEncryptionKeyConfigured(): boolean {
  return Boolean(process.env.CONFIG_ENCRYPTION_KEY?.trim());
}

function getEncryptionKey(): Buffer {
  const raw = process.env.CONFIG_ENCRYPTION_KEY;
  if (!raw?.trim()) {
    throw Object.assign(new Error('CONFIG_ENCRYPTION_KEY não configurada'), {
      code: 'CONFIG_ENCRYPTION_KEY_MISSING',
      statusCode: 500,
    });
  }

  const trimmed = raw.trim();
  const base64 = Buffer.from(trimmed, 'base64');
  if (base64.length === 32) {
    return base64;
  }

  return crypto.createHash('sha256').update(trimmed).digest();
}

export function encryptSecret(value: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

export function decryptSecret(payload: string): string {
  const [version, ivBase64, tagBase64, encryptedBase64] = payload.split(':');
  if (version !== ENCRYPTION_VERSION || !ivBase64 || !tagBase64 || !encryptedBase64) {
    throw Object.assign(new Error('Payload criptografado inválido'), {
      code: 'INVALID_ENCRYPTED_CONFIG_PAYLOAD',
      statusCode: 500,
    });
  }

  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivBase64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

export function fingerprintSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  const digest = crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
  return `sha256:${digest}:len:${value.length}`;
}

export function maskSecretPreview(value: string | null | undefined): string | null {
  if (!value) return null;

  const normalized = String(value).trim();
  if (!normalized) return null;

  const visibleLength = normalized.length > 10 ? 6 : Math.min(4, normalized.length);
  const hiddenLength = Math.max(8, normalized.length - visibleLength);

  return `${'*'.repeat(hiddenLength)}${normalized.slice(-visibleLength)}`;
}
