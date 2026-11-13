/* =========================================================
   Testes — CORS
========================================================= */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const criarApp = require("../src/app");
const { criarPoolFalso } = require("./helpers/fakePool");

const ORIGEM = "https://cecilia.example";

function criarAppComCors() {
    return criarApp({
        pool: criarPoolFalso(),
        frontendUrl: ORIGEM,
        rateLimitEnabled: false
    });
}

test("CORS libera a origem configurada", async () => {
    const resposta = await request(criarAppComCors())
        .get("/api/health")
        .set("Origin", ORIGEM);

    assert.equal(resposta.status, 200);
    assert.equal(resposta.headers["access-control-allow-origin"], ORIGEM);
});

test("CORS não libera origem desconhecida", async () => {
    const resposta = await request(criarAppComCors())
        .get("/api/health")
        .set("Origin", "https://invasor.example");

    assert.equal(resposta.status, 200);
    assert.equal(resposta.headers["access-control-allow-origin"], undefined);
});

test("CORS responde ao preflight", async () => {
    const resposta = await request(criarAppComCors())
        .options("/api/convite/token/rsvp")
        .set("Origin", ORIGEM)
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "Content-Type");

    assert.equal(resposta.status, 204);
    assert.equal(resposta.headers["access-control-allow-origin"], ORIGEM);
});
