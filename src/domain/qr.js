/**
 * CampusShare v2 - Domain Module: Custody Passport & Signed QR Tokens
 * Generates and cryptographically verifies time-bound HMAC-SHA256 tokens.
 * Unlocks physical IoT interlocks and transfers equipment custody.
 */

const crypto = require('node:crypto');

const DEFAULT_SECRET = 'campusshare-hmac-secret-2026-production-vault';

/**
 * Base64URL encoder helper.
 * @param {string|Buffer} str
 * @returns {string}
 */
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Base64URL decoder helper.
 * @param {string} str
 * @returns {string}
 */
function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Generates an HMAC-SHA256 signed passport token.
 * Token valid window: [start_at - 15 min, end_at + 30 min]
 *
 * @param {Object} params
 * @param {string} params.bookingId
 * @param {string} params.resourceId
 * @param {string} params.userId
 * @param {Date|string} params.startAt
 * @param {Date|string} params.endAt
 * @param {string} [params.secretKey]
 * @returns {{ token: string, notBefore: string, expiresAt: string, jti: string }}
 */
function signPassportToken({
  bookingId,
  resourceId,
  userId,
  startAt,
  endAt,
  secretKey = DEFAULT_SECRET
}) {
  const startTime = new Date(startAt).getTime();
  const endTime = new Date(endAt).getTime();

  // Valid 15 mins before start, until 30 mins after end
  const nbf = new Date(startTime - 15 * 60 * 1000).toISOString();
  const exp = new Date(endTime + 30 * 60 * 1000).toISOString();
  const jti = crypto.randomUUID();

  const payload = {
    bid: bookingId,
    rid: resourceId,
    uid: userId,
    nbf,
    exp,
    jti,
    iss: 'CampusShare-Gatekeeper',
    iat: new Date().toISOString()
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const message = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(message)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const token = `${message}.${signature}`;

  return {
    token,
    notBefore: nbf,
    expiresAt: exp,
    jti
  };
}

/**
 * Validates a signed passport token for physical check-in.
 *
 * @param {Object} params
 * @param {string} params.token
 * @param {string} params.expectedUserId
 * @param {string} params.expectedBookingId
 * @param {boolean} params.checklistComplete
 * @param {Date} [params.now]
 * @param {string} [params.secretKey]
 * @returns {{ valid: boolean, error?: string, payload?: Object }}
 */
function verifyPassportToken({
  token,
  expectedUserId,
  expectedBookingId,
  checklistComplete = true,
  now = new Date(),
  secretKey = DEFAULT_SECRET
}) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token missing or invalid format' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Malformed token structure' };
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const message = `${encodedHeader}.${encodedPayload}`;

  // 1. Verify HMAC Signature
  const expectedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(message)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (signature !== expectedSignature) {
    return { valid: false, error: 'HMAC signature verification failed. Token forged or tampered.' };
  }

  // 2. Parse Payload
  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch (err) {
    return { valid: false, error: 'Corrupted payload JSON' };
  }

  // 3. User Identity Check
  if (expectedUserId && payload.uid !== expectedUserId) {
    return { valid: false, error: 'Token user identity does not match current session user.' };
  }

  // 4. Booking ID Check
  if (expectedBookingId && payload.bid !== expectedBookingId) {
    return { valid: false, error: 'Token is bound to a different booking.' };
  }

  // 5. Time Window Enforcement
  const currentTime = new Date(now).getTime();
  const nbfTime = new Date(payload.nbf).getTime();
  const expTime = new Date(payload.exp).getTime();

  if (currentTime < nbfTime) {
    return { valid: false, error: 'Check-in window has not opened yet (15 min pre-flight buffer).' };
  }
  if (currentTime > expTime) {
    return { valid: false, error: 'Custody token has expired. Request extension or contact custodian.' };
  }

  // 6. Pre-flight Checklist Verification
  if (!checklistComplete) {
    return { valid: false, error: 'Pre-operation safety checklist must be completed before physical unlock.' };
  }

  return {
    valid: true,
    payload
  };
}

module.exports = {
  signPassportToken,
  verifyPassportToken,
  DEFAULT_SECRET
};
