/* =========================================================
   Testes — geração e formato dos tokens
========================================================= */

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
    gerarToken,
    tokenTemFormatoValido
} = require("../src/utils/token");

test("gerarToken cria tokens únicos, aleatórios e seguros para URL", () => {
    const tokens = new Set();

    for (let i = 0; i < 500; i++) {
        const token = gerarToken();

        assert.match(token, /^[A-Za-z0-9_-]{43}$/);
        assert.equal(tokenTemFormatoValido(token), true);
        tokens.add(token);
    }

    assert.equal(tokens.size, 500);
});

test("tokenTemFormatoValido rejeita formatos inseguros", () => {
    assert.equal(tokenTemFormatoValido(""), false);
    assert.equal(tokenTemFormatoValido("curto"), false);
    assert.equal(tokenTemFormatoValido("A".repeat(19)), false);
    assert.equal(tokenTemFormatoValido("A".repeat(20)), true);
    assert.equal(tokenTemFormatoValido("A".repeat(129)), false);
    assert.equal(tokenTemFormatoValido("token/com/barra".padEnd(43, "A")), false);
    assert.equal(tokenTemFormatoValido("token com espaço".padEnd(43, "A")), false);
    assert.equal(tokenTemFormatoValido(null), false);
    assert.equal(tokenTemFormatoValido(123), false);
});
