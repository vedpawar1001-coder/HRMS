const crypto = require('crypto');

// Use fixed key from env or generate once and store (for development)
// IMPORTANT: In production, use a secure, fixed ENCRYPTION_KEY in .env file
let ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  // For development only - use a fixed key
  ENCRYPTION_KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'; // 64 char hex string
}
const ALGORITHM = 'aes-256-cbc';

// Encrypt sensitive data
function encrypt(text) {
  if (!text) return null;
  
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32), 'hex'), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    return null;
  }
}

// Decrypt sensitive data
function decrypt(encryptedText) {
  if (!encryptedText) return null;
  
  try {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32), 'hex'), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}

// Mask sensitive numbers (e.g., Aadhaar: XXXX-XXXX-1234)
function maskAadhaar(aadhaar) {
  if (!aadhaar) return '';
  const decrypted = decrypt(aadhaar);
  if (!decrypted || decrypted.length < 4) return 'XXXX-XXXX-XXXX';
  return 'XXXX-XXXX-' + decrypted.slice(-4);
}

function maskPAN(pan) {
  if (!pan) return '';
  const decrypted = decrypt(pan);
  if (!decrypted || decrypted.length < 4) return 'XXXXX1234X';
  return 'XXXXX' + decrypted.slice(-4);
}

function maskMobile(mobile) {
  if (!mobile || mobile.length < 10) return 'XXXXXX1234';
  return 'XXXXXX' + mobile.slice(-4);
}

module.exports = {
  encrypt,
  decrypt,
  maskAadhaar,
  maskPAN,
  maskMobile
};

