/* =========================================================
   Testes — painel administrativo
========================================================= */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const criarApp = require("../src/app");
const { criarPoolFalso } = require("./helpers/fakePool");

const SENHA = "senha-admin-de-teste";
const AUTORIZACAO = `Bearer ${SENHA}`;

process.env.ADMIN_PASSWORD = SENHA;

function criarCenario({ convites = [], convidados = [] } = {}) {
    const pool = criarPoolFalso({ convites, convidados });

    const app = criarApp({
        pool,
        frontendUrl: "https://cecilia.example",
        rateLimitEnabled: false
    });

    return { pool, app };
}

function cenarioConsolidado() {
    return criarCenario({
        convites: [
            {
                id: 1,
                titulo: "Maria & família",
                responsavel_nome: "Maria",
                token: "A".repeat(43),
                status: "confirmado"
            },
            {
                id: 2,
                titulo: "João & família",
                responsavel_nome: "João",
                token: "B".repeat(43),
                status: "pendente"
            },
            {
                id: 3,
                titulo: "Ana",
                responsavel_nome: "Ana",
                token: "C".repeat(43),
                status: "recusado"
            }
        ],
        convidados: [
            {
                id: 1,
                convite_id: 1,
                nome: "Maria",
                eh_responsavel: true,
                status: "confirmado"
            },
            {
                id: 2,
                convite_id: 1,
                nome: "Bia",
                eh_responsavel: false,
                status: "confirmado"
            },
            {
                id: 3,
                convite_id: 1,
                nome: "Amigo Extra",
                eh_responsavel: false,
                eh_extra: true,
                status: "confirmado"
            },
            {
                id: 4,
                convite_id: 2,
                nome: "João",
                eh_responsavel: true,
                status: "pendente"
            },
            {
                id: 5,
                convite_id: 2,
                nome: "José",
                eh_responsavel: false,
                status: "recusado"
            },
            {
                id: 6,
                convite_id: 3,
                nome: "Ana",
                eh_responsavel: true,
                status: "recusado"
            }
        ]
    });
}

function criarPessoasAtivas(quantidade) {
    return Array.from({ length: quantidade }, (_, indice) => ({
        id: 1000 + indice,
        convite_id: 99,
        nome: `Pessoa ${indice + 1}`,
        eh_responsavel: false,
        status: "confirmado"
    }));
}

/* ---------------------------------------------------------
   Autenticação
--------------------------------------------------------- */

test("admin sem senha retorna 401", async () => {
    const { app } = criarCenario();

    const resposta = await request(app).get("/api/admin/convites");

    assert.equal(resposta.status, 401);
    assert.equal(resposta.body.ok, false);
    assert.equal(resposta.body.erro.codigo, "NAO_AUTORIZADO");
});

test("admin com senha errada retorna 401", async () => {
    const { app } = criarCenario();

    const resposta = await request(app)
        .get("/api/admin/convites")
        .set("Authorization", "Bearer senha-errada");

    assert.equal(resposta.status, 401);
    assert.equal(resposta.body.erro.codigo, "NAO_AUTORIZADO");
});

test("admin com senha certa acessa a listagem", async () => {
    const { app } = criarCenario();

    const resposta = await request(app)
        .get("/api/admin/convites")
        .set("Authorization", AUTORIZACAO);

    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.ok, true);
});

test("admin retorna 503 quando ADMIN_PASSWORD não está configurada", async () => {
    const senhaAnterior = process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_PASSWORD;

    try {
        const { app } = criarCenario();

        const resposta = await request(app)
            .get("/api/admin/convites")
            .set("Authorization", AUTORIZACAO);

        assert.equal(resposta.status, 503);
        assert.equal(resposta.body.erro.codigo, "ADMIN_NAO_CONFIGURADO");
    } finally {
        process.env.ADMIN_PASSWORD = senhaAnterior;
    }
});

/* ---------------------------------------------------------
   Listagem consolidada
--------------------------------------------------------- */

test("GET /api/admin/convites retorna resumo e convites com membros", async () => {
    const { app } = cenarioConsolidado();

    const resposta = await request(app)
        .get("/api/admin/convites")
        .set("Authorization", AUTORIZACAO);

    assert.equal(resposta.status, 200);

    const { resumo, convites } = resposta.body.data;

    assert.deepEqual(resumo, {
        total_convites: 3,
        convites_confirmados: 1,
        convites_pendentes: 1,
        convites_recusados: 1,
        total_pessoas: 6,
        pessoas_confirmadas: 3,
        pessoas_pendentes: 1,
        pessoas_recusadas: 2,
        limite_maximo: 100,
        vagas_disponiveis: 96
    });

    assert.equal(convites.length, 3);

    const primeiro = convites[0];

    assert.equal(primeiro.titulo, "Maria & família");
    assert.equal(primeiro.link, `https://cecilia.example/?token=${"A".repeat(43)}`);
    assert.equal(primeiro.token, undefined);
    assert.equal(primeiro.membros.length, 3);

    const responsavel = primeiro.membros.find(
        (membro) => membro.eh_responsavel
    );
    const extra = primeiro.membros.find((membro) => membro.eh_extra);

    assert.equal(responsavel.nome, "Maria");
    assert.equal(extra.nome, "Amigo Extra");
    assert.equal(extra.status, "confirmado");
    assert.ok(primeiro.membros.every((membro) => membro.convite_id === undefined));

    const recusado = convites.find((convite) => convite.id === 3);
    assert.equal(recusado.status, "recusado");
    assert.equal(recusado.membros[0].eh_responsavel, true);
});

test("GET /api/admin/convites funciona com painel vazio", async () => {
    const { app } = criarCenario();

    const resposta = await request(app)
        .get("/api/admin/convites")
        .set("Authorization", AUTORIZACAO);

    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.data.resumo.total_convites, 0);
    assert.equal(resposta.body.data.resumo.total_pessoas, 0);
    assert.equal(resposta.body.data.resumo.vagas_disponiveis, 100);
    assert.deepEqual(resposta.body.data.convites, []);
});

/* ---------------------------------------------------------
   Criação de convite
--------------------------------------------------------- */

test("POST /api/admin/convites cria convite familiar com token novo", async () => {
    const { app, pool } = criarCenario();

    const resposta = await request(app)
        .post("/api/admin/convites")
        .set("Authorization", AUTORIZACAO)
        .send({
            titulo: "Carla & família",
            responsavel_nome: "Carla",
            membros: ["  Ana  ", "Bia"]
        });

    assert.equal(resposta.status, 201);
    assert.equal(resposta.body.ok, true);

    const convite = resposta.body.data;

    assert.equal(convite.titulo, "Carla & família");
    assert.equal(convite.responsavel_nome, "Carla");
    assert.equal(convite.status, "pendente");
    assert.equal(convite.membros.length, 3);
    assert.match(convite.link, /^https:\/\/cecilia\.example\/\?token=/);

    const registros = pool.convites[0];
    assert.match(registros.token, /^[A-Za-z0-9_-]{43}$/);
    assert.ok(convite.link.endsWith(encodeURIComponent(registros.token)));

    const responsavel = convite.membros.find(
        (membro) => membro.eh_responsavel
    );
    const familiares = convite.membros.filter(
        (membro) => !membro.eh_responsavel
    );

    assert.equal(responsavel.nome, "Carla");
    assert.equal(familiares.length, 2);
    assert.deepEqual(
        familiares.map((membro) => membro.nome),
        ["Ana", "Bia"]
    );
    assert.ok(
        familiares.every(
            (membro) => membro.eh_extra === false && membro.status === "pendente"
        )
    );

    const listagem = await request(app)
        .get("/api/admin/convites")
        .set("Authorization", AUTORIZACAO);

    assert.equal(listagem.body.data.resumo.total_convites, 1);
    assert.equal(listagem.body.data.resumo.total_pessoas, 3);
    assert.equal(listagem.body.data.resumo.vagas_disponiveis, 97);
});

test("POST /api/admin/convites cria convite individual sem membros", async () => {
    const { app } = criarCenario();

    const resposta = await request(app)
        .post("/api/admin/convites")
        .set("Authorization", AUTORIZACAO)
        .send({
            titulo: "Lucas",
            responsavel_nome: "Lucas"
        });

    assert.equal(resposta.status, 201);
    assert.equal(resposta.body.data.membros.length, 1);
    assert.equal(resposta.body.data.membros[0].eh_responsavel, true);
});

test("POST /api/admin/convites bloqueia quando o teto de 100 é atingido", async () => {
    const { app, pool } = criarCenario({
        convidados: criarPessoasAtivas(100)
    });

    const resposta = await request(app)
        .post("/api/admin/convites")
        .set("Authorization", AUTORIZACAO)
        .send({
            titulo: "Nova Família",
            responsavel_nome: "Nova Pessoa"
        });

    assert.equal(resposta.status, 409);
    assert.equal(resposta.body.erro.codigo, "LIMITE_ATINGIDO");
    assert.equal(pool.convites.length, 0);
    assert.equal(pool.convidados.length, 100);
});

test("POST /api/admin/convites valida os dados enviados", async () => {
    const { app } = criarCenario();

    const semTitulo = await request(app)
        .post("/api/admin/convites")
        .set("Authorization", AUTORIZACAO)
        .send({ responsavel_nome: "Carla" });

    assert.equal(semTitulo.status, 400);
    assert.equal(semTitulo.body.erro.codigo, "TITULO_INVALIDO");

    const membroInvalido = await request(app)
        .post("/api/admin/convites")
        .set("Authorization", AUTORIZACAO)
        .send({
            titulo: "Família",
            responsavel_nome: "Carla",
            membros: ["Ana", "   "]
        });

    assert.equal(membroInvalido.status, 400);
    assert.equal(membroInvalido.body.erro.codigo, "NOME_INVALIDO");

    const campoExtra = await request(app)
        .post("/api/admin/convites")
        .set("Authorization", AUTORIZACAO)
        .send({
            titulo: "Família",
            responsavel_nome: "Carla",
            token: "forjado"
        });

    assert.equal(campoExtra.status, 400);
    assert.equal(campoExtra.body.erro.codigo, "DADOS_INVALIDOS");
});
