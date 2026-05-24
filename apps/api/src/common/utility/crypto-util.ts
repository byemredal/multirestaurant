import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import type { TenantOnboardingApplicationStatus } from '../../modules/tenant-onboarding/entities/tenant-onboarding.entity';

const STATE_TOKEN_IV_BYTES = 12;
const STATE_TOKEN_SEPARATOR = '.';
const STATE_TOKEN_ALGORITHM = 'aes-256-gcm';

function getStateTokenKey() {
  const secret = process.env.STATE_TOKEN_SECRET ?? process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('State token secret is not configured. Set STATE_TOKEN_SECRET or JWT_SECRET.');
  }
  return createHash('sha256').update(secret).digest();
}

function randomTokenSalt() {
  return randomBytes(10).toString('base64url');
}

function isTerminalStatus(status: TenantOnboardingApplicationStatus) {
  return ['approved', 'active', 'rejected', 'suspended'].includes(status);
}

function encryptStateToken(payload: Record<string, unknown>) {
  const iv = randomBytes(STATE_TOKEN_IV_BYTES);
  const cipher = createCipheriv(STATE_TOKEN_ALGORITHM, getStateTokenKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, ciphertext, tag].map((buffer) => buffer.toString('base64url')).join(STATE_TOKEN_SEPARATOR);
}

function decryptStateToken(token: string) {
  const parts = token.split(STATE_TOKEN_SEPARATOR);
  if (parts.length !== 3) {
    throw new Error('Invalid state token format.');
  }

  const [ivPart, cipherPart, tagPart] = parts;
  try {
    const iv = Buffer.from(ivPart, 'base64url');
    const ciphertext = Buffer.from(cipherPart, 'base64url');
    const tag = Buffer.from(tagPart, 'base64url');
    const decipher = createDecipheriv(STATE_TOKEN_ALGORITHM, getStateTokenKey(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    return JSON.parse(plaintext) as Record<string, unknown>;
  } catch {
    throw new Error('Invalid or expired state token.');
  }
}

export const CryptoUtil = {
  encryptStateToken,
  decryptStateToken,
    randomTokenSalt,
    isTerminalStatus,
};