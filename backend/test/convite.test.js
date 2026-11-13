/* =========================================================
   Testes — consulta e RSVP
========================================================= */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const criarApp = require("../src/app");
const { criarPoolFalso } = require("./helpers/fakePool");

const TOKEN = "A".repeat(43);
const OUTRO_TOKEN = "B".repeat(43);
const NOME = "Maria Silva";

function criarCenario({ status = "pendente", agora } = {}) {
    const pool = criarPoolFalso({
        convidados: [{ nome: NOME, token: TOKEN, status }],
        agora
    });

    const app = criarApp({
        pool,
        frontendUrl: "https://cecilia.example",
        rateLimitEnabled: false
    });

    return { pool, app };
}

test("GET /api/convite/:token retorna somente nome e status", async () => {
    const { app } = criarCenario();

    const resposta = await request(app).get(`/api/convite/${TOKEN}`);

    assert.equal(resposta.status, 200);
    assert.deepEqual(resposta.body, {
        ok: true,
        data: { nome: NOME, status: "pendente" }
    });
    assert.equal(resposta.body.data.token, undefined);
    assert.equal(resposta.body.data.id, undefined);
    assert.equal(resposta.body.data.respondido_em, undefined);
});

test("GET /api/convite/:token retorna 404 para token inexistente", async () => {
    const { app } = criarCenario();

    const resposta = await request(app).get(`/api/convite/${OUTRO_TOKEN}`);

    assert.equal(resposta.status, 404);
    assert.equal(resposta.body.ok, false);
    assert.equal(resposta.body.erro.codigo, "TOKEN_NAO_ENCONTRADO");
});

test("GET /api/convite/:token retorna 404 para token malformado", async () => {
    const { app, pool } = criarCenario();

    const resposta = await request(app).get("/api/convite/curto");

    assert.equal(resposta.status, 404);
    assert.equal(resposta.body.erro.codigo, "TOKEN_NAO_ENCONTRADO");
    assert.equal(pool.chamadas.length, 0);
});

test("POST /api/convite/:token/rsvp confirma presença", async () => {
    const { app, pool } = criarCenario();

    const resposta = await request(app)
        .post(`/api/convite/${TOKEN}/rsvp`)
        .send({ status: "confirmado" });

    assert.equal(resposta.status, 200);
    assert.deepEqual(resposta.body, {
        ok: true,
        data: { nome: NOME, status: "confirmado" }
    });
    assert.equal(pool.registros[0].status, "confirmado");
});

test("POST /api/convite/:token/rsvp recusa presença", async () => {
    const { app, pool } = criarCenario();

    const resposta = await request(app)
        .post(`/api/convite/${TOKEN}/rsvp`)
        .send({ status: "recusado" });

    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.data.status, "recusado");
    assert.equal(pool.registros[0].status, "recusado");
});

test("convidado pode alterar confirmação para recusa", async () => {
    const { app, pool } = criarCenario();

    await request(app)
        .post(`/api/convite/${TOKEN}/rsvp`)
        .send({ status: "confirmado" });

    const resposta = await request(app)
        .post(`/api/convite/${TOKEN}/rsvp`)
        .send({ status: "recusado" });

    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.data.status, "recusado");
    assert.equal(pool.registros[0].status, "recusado");
});

test("convidado pode alterar recusa para confirmação", async () => {
    const { app, pool } = criarCenario({ status: "recusado" });

    const resposta = await request(app)
        .post(`/api/convite/${TOKEN}/rsvp`)
        .send({ status: "confirmado" });

    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.data.status, "confirmado");
    assert.equal(pool.registros[0].status, "confirmado");
});

test("POST com status inválido retorna 400 e não altera o registro", async () => {
    const { app, pool } = criarCenario();

    const resposta = await request(app)
        .post(`/api/convite/${TOKEN}/rsvp`)
        .send({ status: "talvez" });

    assert.equal(resposta.status, 400);
    assert.equal(resposta.body.erro.codigo, "STATUS_INVALIDO");
    assert.equal(pool.registros[0].status, "pendente");
    assert.equal(pool.registros[0].respondido_em, null);
});

test("POST sem o campo status retorna 400", async () => {
    const { app } = criarCenario();

    const resposta = await request(app)
        .post(`/api/convite/${TOKEN}/rsvp`)
        .send({});

    assert.equal(resposta.status, 400);
    assert.equal(resposta.body.erro.codigo, "DADOS_INVALIDOS");
});

test("POST com campo extra retorna 400", async () => {
    const { app } = criarCenario();

    const resposta = await request(app)
        .post(`/api/convite/${TOKEN}/rsvp`)
        .send({ status: "confirmado", nome: "Outro nome" });

    assert.equal(resposta.status, 400);
    assert.equal(resposta.body.erro.codigo, "DADOS_INVALIDOS");
});

test("POST com JSON inválido retorna 400", async () => {
    const { app } = criarCenario();

    const resposta = await request(app)
        .post(`/api/convite/${TOKEN}/rsvp`)
        .set("Content-Type", "application/json")
        .send('{"status":');

    assert.equal(resposta.status, 400);
    assert.equal(resposta.body.ok, false);
    assert.equal(resposta.body.erro.codigo, "JSON_INVALIDO");
});

test("POST para token inexistente retorna 404", async () => {
    const { app, pool } = criarCenario();

    const resposta = await request(app)
        .post(`/api/convite/${OUTRO_TOKEN}/rsvp`)
        .send({ status: "confirmado" });

    assert.equal(resposta.status, 404);
    assert.equal(resposta.body.erro.codigo, "TOKEN_NAO_ENCONTRADO");
    assert.equal(pool.registros[0].status, "pendente");
});

test("resposta atualiza respondido_em e atualizado_em", async () => {
    let tick = 0;
    const agora = () => new Date(Date.UTC(2027, 2, 20, 22, 0, tick++));
    const { app, pool } = criarCenario({ agora });

    await request(app)
        .post(`/api/convite/${TOKEN}/rsvp`)
        .send({ status: "confirmado" });

    const primeiroRespondido = pool.registros[0].respondido_em;
    const primeiroAtualizado = pool.registros[0].atualizado_em;

    assert.ok(primeiroRespondido instanceof Date);
    assert.ok(primeiroAtualizado instanceof Date);
    assert.equal(
        primeiroRespondido.getTime(),
        primeiroAtualizado.getTime()
    );

    await request(app)
        .post(`/api/convite/${TOKEN}/rsvp`)
        .send({ status: "recusado" });

    const segundoRespondido = pool.registros[0].respondido_em;
    const segundoAtualizado = pool.registros[0].atualizado_em;

    assert.ok(segundoRespondido > primeiroRespondido);
    assert.ok(segundoAtualizado > primeiroAtualizado);

    const consultaUpdate = pool.chamadas.find((chamada) =>
        /^UPDATE convidados/i.test(chamada.texto.trim())
    );

    assert.match(consultaUpdate.texto, /respondido_em = NOW\(\)/);
    assert.match(consultaUpdate.texto, /atualizado_em = NOW\(\)/);
});

test("SQL é parametrizado e não interpola o token", async () => {
    const { app, pool } = criarCenario();

    await request(app)
        .post(`/api/convite/${TOKEN}/rsvp`)
        .send({ status: "confirmado" });

    const consultaUpdate = pool.chamadas.find((chamada) =>
        /^UPDATE convidados/i.test(chamada.texto.trim())
    );

    assert.deepEqual(consultaUpdate.parametros, [TOKEN, "confirmado"]);
    assert.ok(!consultaUpdate.texto.includes(TOKEN));
});
