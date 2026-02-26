import crypto from 'crypto';

// Derive a 256-bit AES key from an environment secret.
// In production, CHAT_ENCRYPTION_KEY should be a strong random value.
const RAW_KEY = process.env.CHAT_ENCRYPTION_KEY || 'dev-chat-encryption-key-please-change';
const KEY = crypto.createHash('sha256').update(RAW_KEY).digest(); // 32 bytes

const KEY_REF = process.env.CHAT_ENCRYPTION_KEY_REF || 'default_v1';

export const encryptMessage = (plaintext) => {
  if (!plaintext) {
    return { ciphertext: '', keyRef: KEY_REF };
  }

  const iv = crypto.randomBytes(12); // 96-bit nonce for AES-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag().toString('base64');
  const payload = `${iv.toString('base64')}:${authTag}:${encrypted}`;

  return { ciphertext: payload, keyRef: KEY_REF };
};

export const decryptMessage = (ciphertext) => {
  if (!ciphertext) return '';

  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) return ciphertext; // Legacy/plaintext fallback

    const [ivB64, tagB64, dataB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(tagB64, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(dataB64, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Failed to decrypt chat message', err);
    // As a safety fallback, return the raw ciphertext so the UI still shows something.
    return ciphertext;
  }
};
