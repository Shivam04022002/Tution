import crypto from 'crypto';

// Derives a stable 32-byte AES key from SMTP_ENCRYPTION_KEY (or falls back to
// JWT_SECRET so existing deployments don't need a new env var to work).
const getKey = (): Buffer => {
  const secret = process.env.SMTP_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('SMTP_ENCRYPTION_KEY or JWT_SECRET must be set to encrypt/decrypt stored credentials');
  }
  return crypto.scryptSync(secret, 'smtp-config-salt', 32);
};

// AES-256-GCM: ciphertext stored as "iv:authTag:encrypted" (all hex)
export const encrypt = (plainText: string): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
};

export const decrypt = (cipherText: string): string => {
  const [ivHex, authTagHex, encryptedHex] = cipherText.split(':');
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Malformed encrypted value');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
};
