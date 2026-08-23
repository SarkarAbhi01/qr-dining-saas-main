const crypto = require('crypto');

// Refresh tokens are stored hashed (never raw) so a DB leak doesn't hand
// out valid sessions. This is a fast one-way hash — fine here because the
// token itself already has high entropy (unlike a user-chosen password).
function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

module.exports = { sha256 };
