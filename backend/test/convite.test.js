/* =========================================================
   Testes — consulta e RSVP por convite / família
========================================================= */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const criarApp = require("../src/app");
const { criarPoolFalso } = require("./helpers/fakePool");

const TOKEN = "A".repeat(43);
const OUTRO_TOKEN = "B".repeat(43);
const TITULO = "Dani & família";
const RESPONSAVEL = "Dani";

function criarCenario({
    statusConvite = "pendente",
    statusMembros = ["pendente", "pendente"],
    extras = [],
    agora
} = {}) {
    const membros = statusMembros.map((status, indice) => ({
        id: 10 + indice,
        convite_id: 1,
        nome: `Familiar ${indice + 1}`,
        eh_responsavel: false,
        eh_extra: false,
        status
    }));

    const convidados = [
        {
            id: 1,
            convite_id: 1,
            nome: RESPONSAVEL,
            eh_responsavel: true,
            eh_extra: false,
            status: statusConvite
        },
        ...membros,
        ...extras
    ];

    const pool = criarPoolFalso({
        convites: [
            {
                id: 1,
                titulo: TITULO,
                responsavel_nome: RESPONSAVEL,
                token: TOKEN,
                status: statusConvite
            }
        ],
        convidados,
        agora
    });

    const app = criarApp({
        pool,
        frontendUrl: "https://cecilia.example",
        rateLimitEnabled: false
    });

    return { pool, app };
}

function criarConvidadosAtivos(quantidade) {
    return Array.from({ length: quantidade }, (_, indice) => ({
        id: 1000 + indice,
        convite_id: 2,
        nome: `Filler ${indice + 1}`,
        eh_responsavel: false,
        eh_extra: false,
        status: "confirmado"
    }));
}

/* ---------------------------------------------------------
   Consulta do convite
--------------------------------------------------------- */

test("GET /api/convite/:token retorna o convite e os familiares", async () => {
    const { app } = criarCenario();

    const resposta = await request(app).get(`/api/convite/${TOKEN}`);

    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.ok, true);

    const { data } = resposta.body;

    assert.equal(data.id, 1);
    assert.equal(data.titulo, TITULO);
    assert.equal(data.responsavel_nome, RESPONSAVEL);
    assert.equal(data.status, "pendente");
    assert.equal(data.respondido_em, null);
    assert.equal(data.vagas_disponiveis, 97);

    assert.equal(data.membros.length, 2);
    assert.deepEqual(data.membros[0], {
        id: 10,
        nome: "Familiar 1",
        status: "pendente",
        eh_extra: false
    });

    /* O responsável não aparece na lista de familiares. */
    assert.ok(
        data.membros.every((membro) => membro.nome !== RESPONSAVEL)
    );

    /* O token nunca é exposto pela API. */
    assert.equal(data.token, undefined);
    assert.ok(!JSON.stringify(resposta.body).includes(TOKEN));
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

test("GET calcula vagas_disponiveis sem contar recusados e nunca fica negativo", async () => {
    const extras = [
        ...criarConvidadosAtivos(95),
        {
            id: 2000,
            convite_id: 2,
            nome: "Recusado",
            eh_responsavel: false,
            status: "recusado"
        }
    ];

    /* 1 responsável + 2 familiares + 95 ativos = 98 ativos. */
    const { app } = criarCenario({ extras });
    const resposta = await request(app).get(`/api/convite/${TOKEN}`);

    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.data.vagas_disponiveis, 2);

    const cheio = criarCenario({
        extras: criarConvidadosAtivos(120)
    });
    const respostaCheia = await request(cheio.app).get(
        `/api/convite/${TOKEN}`
    );

    assert.equal(respostaCheia.body.data.vagas_disponiveis, 0);
});

/* ---------------------------------------------------------
   RSVP do responsável
--------------------------------------------------------- */

test("POST /api/convite/:token/rsvp confirma o convite e o responsável", async () => {
    const { app, pool } = criarCenario();

    const resposta = await request(app)
        .post(`/api/convite/${TOKEN}/rsvp`)
        .send({ status: "confirmado" });

    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.data.status, "confirmado");

    const responsavel = pool.convidados.find(
        (convidado) => convidado.eh_responsavel
    );

    assert.equal(responsavel.status, "confirmado");
    assert.ok(responsavel.respondido_em instanceof Date);
    assert.equal(pool.convites[0].status, "confirmado");
    assert.ok(pool.convites[0].respondido_em instanceof Date);

    /* Os familiares só mudam quando confirmados individualmente. */
    assert.deepEqual(
        resposta.body.data.membros.map((membro) => membro.status),
        ["pendente", "pendente"]
    );
});

test("POST /api/convite/:token/rsvp recusado marca toda a família", async () => {
    const { app, pool } = criarCenario({ statusConvite: "confirmado" });

    const resposta = await request(app)
        .post(`/api/convite/${TOKEN}/rsvp`)
        .send({ status: "recusado" });

    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.data.status, "recusado");
    assert.deepEqual(
        resposta.body.data.membros.map((membro) => membro.status),
        ["recusado", "recusado"]
    );

    assert.ok(
        pool.convidados.every(
            (convidado) =>
                convidado.status === "recusado" &&
                convidado.respondido_em instanceof Date
        )
    );
});

test("convite pode alternar entre confirmação e recusa", async () => {
    const { app } = criarCenario();

    const confirmado = await request(app)
        .post(`/api/convite/${TOKEN}/rsvp`)
        .send({ status: "confirmado" });

    assert.equal(confirmado.body.data.status, "confirmado");

    const recusado = await request(app)
        .post(`/api/convite/${TOKEN}/rsvp`)
        .send({ status: "recusado" });

    assert.equal(recusado.body.data.status, "recusado");

    const reconfirmado = await request(app)
        .post(`/api/convite/${TOKEN}/rsvp`)
        .send({ status: "confirmado" });

    assert.equal(reconfirmado.body.data.status, "confirmado");
});

test("POST /api/convite/:token/rsvp retorna 404 para token inexistente", async () => {
    const { app, pool } = criarCenario();

    const resposta = await request(app)
        .post(`/api/convite/${OUTRO_TOKEN}/rsvp`)
        .send({ status: "confirmado" });

    assert.equal(resposta.status, 404);
    assert.equal(resposta.body.erro.codigo, "TOKEN_NAO_ENCONTRADO");
    assert.equal(pool.convites[0].status, "pendente");
});

test("POST /rsvp valida status, campos extras e JSON", async () => {
    const { app, pool } = criarCenario();

    const invalido = await request(app)
        .post(`/api/convite/${TOKEN}/rsvp`)
        .send({ status: "talvez" });

    assert.equal(invalido.status, 400);
    assert.equal(invalido.body.erro.codigo, "STATUS_INVALIDO");

    const extra = await request(app)
        .post(`/api/convite/${TOKEN}/rsvp`)
        .send({ status: "confirmado", nome: "Outro" });

    assert.equal(extra.status, 400);
    assert.equal(extra.body.erro.codigo, "DADOS_INVALIDOS");

    const vazio = await request(app)
        .post(`/api/convite/${TOKEN}/rsvp`)
        .send({});

    assert.equal(vazio.status, 400);
    assert.equal(vazio.body.erro.codigo, "DADOS_INVALIDOS");

    const jsonInvalido = await request(app)
        .post(`/api/convite/${TOKEN}/rsvp`)
        .set("Content-Type", "application/json")
        .send('{"status":');

    assert.equal(jsonInvalido.status, 400);
    assert.equal(jsonInvalido.body.erro.codigo, "JSON_INVALIDO");

    assert.equal(pool.convites[0].status, "pendente");
});

test("SQL do RSVP é parametrizado e não interpola o token", async () => {
    const { app, pool } = criarCenario();

    await request(app)
        .post(`/api/convite/${TOKEN}/rsvp`)
        .send({ status: "confirmado" });

    const consultaConvite = pool.chamadas.find((chamada) =>
        /^UPDATE convites/i.test(chamada.texto.trim())
    );

    assert.deepEqual(consultaConvite.parametros, [1, "confirmado"]);
    assert.ok(!consultaConvite.texto.includes(TOKEN));

    const consultaResponsavel = pool.chamadas.find((chamada) =>
        /^UPDATE convidados[\s\S]*eh_responsavel = TRUE/i.test(
            chamada.texto.trim()
        )
    );

    assert.deepEqual(consultaResponsavel.parametros, [1, "confirmado"]);
});

/* ---------------------------------------------------------
   Familiares individualmente
--------------------------------------------------------- */

test("PATCH confirma um familiar individualmente", async () => {
    const { app, pool } = criarCenario({ statusConvite: "confirmado" });

    const resposta = await request(app)
        .patch(`/api/convite/${TOKEN}/membros/10`)
        .send({ status: "confirmado" });

    assert.equal(resposta.status, 200);

    const membro = resposta.body.data.membros.find(
        (item) => item.id === 10
    );

    assert.equal(membro.status, "confirmado");
    assert.equal(
        resposta.body.data.membros.find((item) => item.id === 11).status,
        "pendente"
    );

    const registro = pool.convidados.find((item) => item.id === 10);
    assert.equal(registro.status, "confirmado");
    assert.ok(registro.respondido_em instanceof Date);
});

test("PATCH marca um familiar como recusado (remover)", async () => {
    const { app } = criarCenario({
        statusConvite: "confirmado",
        statusMembros: ["confirmado", "confirmado"]
    });

    const resposta = await request(app)
        .patch(`/api/convite/${TOKEN}/membros/10`)
        .send({ status: "recusado" });

    assert.equal(resposta.status, 200);
    assert.equal(
        resposta.body.data.membros.find((item) => item.id === 10).status,
        "recusado"
    );
    assert.equal(
        resposta.body.data.membros.find((item) => item.id === 11).status,
        "confirmado"
    );
});

test("PATCH não altera familiar de outro convite", async () => {
    const { app, pool } = criarCenario({
        statusConvite: "confirmado",
        extras: [
            {
                id: 90,
                convite_id: 2,
                nome: "De outro convite",
                eh_responsavel: false,
                status: "confirmado"
            }
        ]
    });

    const resposta = await request(app)
        .patch(`/api/convite/${TOKEN}/membros/90`)
        .send({ status: "recusado" });

    assert.equal(resposta.status, 404);
    assert.equal(resposta.body.erro.codigo, "MEMBRO_NAO_ENCONTRADO");
    assert.equal(
        pool.convidados.find((item) => item.id === 90).status,
        "confirmado"
    );
});

test("PATCH não permite alterar o responsável pela rota de familiares", async () => {
    const { app, pool } = criarCenario({ statusConvite: "confirmado" });

    const resposta = await request(app)
        .patch(`/api/convite/${TOKEN}/membros/1`)
        .send({ status: "recusado" });

    assert.equal(resposta.status, 404);
    assert.equal(resposta.body.erro.codigo, "MEMBRO_NAO_ENCONTRADO");
    assert.equal(
        pool.convidados.find((item) => item.id === 1).status,
        "confirmado"
    );
});

test("PATCH retorna 404 para token inexistente", async () => {
    const { app } = criarCenario({ statusConvite: "confirmado" });

    const resposta = await request(app)
        .patch(`/api/convite/${OUTRO_TOKEN}/membros/10`)
        .send({ status: "confirmado" });

    assert.equal(resposta.status, 404);
    assert.equal(resposta.body.erro.codigo, "TOKEN_NAO_ENCONTRADO");
});

test("PATCH valida status e identificador do familiar", async () => {
    const { app } = criarCenario({ statusConvite: "confirmado" });

    const statusInvalido = await request(app)
        .patch(`/api/convite/${TOKEN}/membros/10`)
        .send({ status: "talvez" });

    assert.equal(statusInvalido.status, 400);
    assert.equal(statusInvalido.body.erro.codigo, "STATUS_INVALIDO");

    const idInvalido = await request(app)
        .patch(`/api/convite/${TOKEN}/membros/abc`)
        .send({ status: "confirmado" });

    assert.equal(idInvalido.status, 400);
    assert.equal(idInvalido.body.erro.codigo, "MEMBRO_INVALIDO");
});

/* ---------------------------------------------------------
   Convidado extra
--------------------------------------------------------- */

test("POST cria convidado extra quando o convite está confirmado", async () => {
    const { app, pool } = criarCenario({ statusConvite: "confirmado" });

    const resposta = await request(app)
        .post(`/api/convite/${TOKEN}/membros`)
        .send({ nome: "  Novo Convidado  " });

    assert.equal(resposta.status, 201);
    assert.equal(resposta.body.ok, true);
    assert.equal(resposta.body.data.nome, "Novo Convidado");
    assert.equal(resposta.body.data.status, "confirmado");
    assert.equal(resposta.body.data.eh_extra, true);
    assert.ok(resposta.body.data.id > 11);

    const registro = pool.convidados.find(
        (item) => item.id === resposta.body.data.id
    );

    assert.equal(registro.convite_id, 1);
    assert.equal(registro.eh_responsavel, false);
    assert.equal(registro.eh_extra, true);
});

test("POST bloqueia convidado extra enquanto o convite está pendente", async () => {
    const { app, pool } = criarCenario({ statusConvite: "pendente" });
    const antes = pool.convidados.length;

    const resposta = await request(app)
        .post(`/api/convite/${TOKEN}/membros`)
        .send({ nome: "Novo Convidado" });

    assert.equal(resposta.status, 409);
    assert.equal(resposta.body.erro.codigo, "CONVITE_NAO_CONFIRMADO");
    assert.equal(pool.convidados.length, antes);
});

test("POST bloqueia convidado extra ao atingir o teto de 100 pessoas", async () => {
    /* 1 responsável + 2 familiares + 97 ativos = 100 ativos. */
    const { app, pool } = criarCenario({
        statusConvite: "confirmado",
        extras: criarConvidadosAtivos(97)
    });

    const resposta = await request(app)
        .post(`/api/convite/${TOKEN}/membros`)
        .send({ nome: "Pessoa 101" });

    assert.equal(resposta.status, 409);
    assert.equal(resposta.body.erro.codigo, "LIMITE_ATINGIDO");
    assert.equal(pool.convidados.length, 100);
    assert.ok(
        !pool.convidados.some((item) => item.nome === "Pessoa 101")
    );
});

test("POST valida o nome e campos extras", async () => {
    const { app } = criarCenario({ statusConvite: "confirmado" });

    const vazio = await request(app)
        .post(`/api/convite/${TOKEN}/membros`)
        .send({ nome: "   " });

    assert.equal(vazio.status, 400);
    assert.equal(vazio.body.erro.codigo, "NOME_INVALIDO");

    const extra = await request(app)
        .post(`/api/convite/${TOKEN}/membros`)
        .send({ nome: "Ana", idade: 20 });

    assert.equal(extra.status, 400);
    assert.equal(extra.body.erro.codigo, "DADOS_INVALIDOS");

    const tipo = await request(app)
        .post(`/api/convite/${TOKEN}/membros`)
        .send({ nome: 123 });

    assert.equal(tipo.status, 400);
    assert.equal(tipo.body.erro.codigo, "NOME_INVALIDO");
});

test("POST de convidado extra retorna 404 para token inexistente", async () => {
    const { app } = criarCenario({ statusConvite: "confirmado" });

    const resposta = await request(app)
        .post(`/api/convite/${OUTRO_TOKEN}/membros`)
        .send({ nome: "Novo Convidado" });

    assert.equal(resposta.status, 404);
    assert.equal(resposta.body.erro.codigo, "TOKEN_NAO_ENCONTRADO");
});

/* ---------------------------------------------------------
   Timestamps
--------------------------------------------------------- */

test("respostas atualizam respondido_em do convite e dos familiares", async () => {
    let tick = 0;
    const agora = () => new Date(Date.UTC(2027, 2, 20, 22, 0, tick++));
    const { app, pool } = criarCenario({ agora });

    await request(app)
        .post(`/api/convite/${TOKEN}/rsvp`)
        .send({ status: "confirmado" });

    await request(app)
        .patch(`/api/convite/${TOKEN}/membros/10`)
        .send({ status: "confirmado" });

    assert.ok(pool.convites[0].respondido_em instanceof Date);
    assert.ok(
        pool.convidados.find((item) => item.id === 10).respondido_em instanceof
            Date
    );
});
