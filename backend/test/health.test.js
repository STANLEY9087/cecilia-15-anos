/* =========================================================
   Testes — health check
========================================================= */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const criarApp = require("../src/app");
const { criarPoolFalso } = require("./helpers/fakePool");

test("GET /api/health retorna 200 quando o banco responde", async () => {
    const pool = criarPoolFalso();
    const app = criarApp({ pool, rateLimitEnabled: false });

    const resposta = await request(app).get("/api/health");

    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.ok, true);
    assert.equal(resposta.body.data.status, "ok");
    assert.equal(resposta.body.data.banco, "ok");
    assert.ok(!Number.isNaN(Date.parse(resposta.body.data.horario)));
});

test("GET /api/health retorna 503 quando o banco falha", async () => {
    const pool = criarPoolFalso({ falharBanco: true });
    const app = criarApp({ pool, rateLimitEnabled: false });

    const resposta = await request(app).get("/api/health");

    assert.equal(resposta.status, 503);
    assert.equal(resposta.body.ok, false);
    assert.equal(resposta.body.erro.codigo, "BANCO_INDISPONIVEL");
});

test("rota inexistente retorna 404 padronizado", async () => {
    const pool = criarPoolFalso();
    const app = criarApp({ pool, rateLimitEnabled: false });

    const resposta = await request(app).get("/api/nao-existe");

    assert.equal(resposta.status, 404);
    assert.equal(resposta.body.ok, false);
    assert.equal(resposta.body.erro.codigo, "ROTA_NAO_ENCONTRADA");
});
