/* =========================================================
   Geração e validação de tokens de convite
========================================================= */

const crypto = require("node:crypto");

const TAMANHO_TOKEN_BYTES = 32;
const FORMATO_TOKEN = /^[A-Za-z0-9_-]{20,128}$/;

/**
 * 32 bytes aleatórios em base64url => 43 caracteres seguros para URL.
 */
function gerarToken() {
    return crypto.randomBytes(TAMANHO_TOKEN_BYTES).toString("base64url");
}

function normalizarToken(token) {
    return typeof token === "string" ? token.trim() : "";
}

function tokenTemFormatoValido(token) {
    return FORMATO_TOKEN.test(normalizarToken(token));
}

module.exports = {
    gerarToken,
    normalizarToken,
    tokenTemFormatoValido,
    TAMANHO_TOKEN_BYTES
};
