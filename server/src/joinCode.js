const crypto = require('node:crypto');
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateJoinCode() {
  let code = '';
  while (code.length < 6) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return code;
}
module.exports = { generateJoinCode };
