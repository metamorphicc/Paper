import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { validateBackup, type DatabaseBackup } from './backup.js';
const format = 'paperclub-encrypted-backup-v1';
const maxPlainBytes = 20_010_000;
export const MAX_ENCRYPTED_BACKUP_BYTES = 28_000_000;
type Envelope = {
  format: typeof format;
  algorithm: 'aes-256-gcm';
  keyId: string;
  iv: string;
  tag: string;
  ciphertext: string;
};
function secret(input: string) {
  if (!/^[\da-f]{64}$/i.test(input)) throw new Error('Use a random 32-byte hex backup key');
  return Buffer.from(input, 'hex');
}
function keyId(key: Buffer) {
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}
function decode(value: unknown, bytes?: number) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(value))
    throw new Error('Invalid encrypted backup encoding');
  const data = Buffer.from(value, 'base64');
  if (data.toString('base64') !== value || (bytes !== undefined && data.length !== bytes))
    throw new Error('Invalid encrypted backup encoding');
  return data;
}
export function encryptBackup(input: DatabaseBackup, keyHex: string): string {
  const plaintext = Buffer.from(JSON.stringify(validateBackup(input))),
    key = secret(keyHex);
  try {
    if (plaintext.length > maxPlainBytes) throw new Error('Backup exceeds encrypted export limit');
    const iv = randomBytes(12),
      id = keyId(key),
      cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(format + ':' + id));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const envelope: Envelope = {
      format,
      algorithm: 'aes-256-gcm',
      keyId: id,
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };
    return JSON.stringify(envelope) + '\n';
  } finally {
    key.fill(0);
    plaintext.fill(0);
  }
}
export function decryptBackup(input: string, keyHex: string): DatabaseBackup {
  if (Buffer.byteLength(input) > MAX_ENCRYPTED_BACKUP_BYTES)
    throw new Error('Encrypted backup exceeds byte limit');
  const key = secret(keyHex);
  let plaintext: Buffer | undefined;
  try {
    const value = JSON.parse(input) as Envelope;
    if (
      !value ||
      typeof value !== 'object' ||
      Object.keys(value).sort().join(',') !== 'algorithm,ciphertext,format,iv,keyId,tag' ||
      value.format !== format ||
      value.algorithm !== 'aes-256-gcm' ||
      value.keyId !== keyId(key)
    )
      throw new Error('Invalid encrypted backup');
    const ciphertext = decode(value.ciphertext);
    if (ciphertext.length > maxPlainBytes)
      throw new Error('Encrypted backup exceeds plaintext limit');
    const decipher = createDecipheriv('aes-256-gcm', key, decode(value.iv, 12));
    decipher.setAAD(Buffer.from(format + ':' + value.keyId));
    decipher.setAuthTag(decode(value.tag, 16));
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return validateBackup(JSON.parse(plaintext.toString('utf8')));
  } catch {
    throw new Error('Encrypted backup could not be authenticated or validated');
  } finally {
    key.fill(0);
    plaintext?.fill(0);
  }
}
