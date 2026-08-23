const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

/**
 * Generates a readable-but-random temporary password for staff accounts
 * created by an Owner/Manager/Superadmin (e.g. "Chef-7F3K9Q").
 */
function generateTempPassword(prefix = 'Temp') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let suffix = '';
  for (let i = 0; i < 8; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}-${suffix}`;
}

module.exports = { hashPassword, comparePassword, generateTempPassword };
