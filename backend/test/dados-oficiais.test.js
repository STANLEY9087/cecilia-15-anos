/* =========================================================
   Testes — integridade dos 39 convites oficiais
========================================================= */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ARQUIVO = path.join(
    __dirname,
    "..",
    "data",
    "convidados-oficiais.json"
);

const convites = JSON.parse(fs.readFileSync(ARQUIVO, "utf8"));

test("dados oficiais possuem 39 convites e 91 pessoas", () => {
    assert.ok(Array.isArray(convites));
    assert.equal(convites.length, 39);

    const totalPessoas = convites.reduce(
        (total, convite) => total + 1 + convite.membros.length,
        0
    );

    assert.equal(totalPessoas, 91);
    assert.ok(totalPessoas <= 100);
});

test("cada convite tem título, responsável e lista de membros válida", () => {
    convites.forEach((convite, indice) => {
        assert.equal(typeof convite.titulo, "string", `convite ${indice + 1}`);
        assert.ok(convite.titulo.trim().length > 0);
        assert.ok(convite.titulo.length <= 150);

        assert.equal(
            typeof convite.responsavel,
            "string",
            `convite ${indice + 1}`
        );
        assert.ok(convite.responsavel.trim().length > 0);

        assert.ok(Array.isArray(convite.membros));

        convite.membros.forEach((nome) => {
            assert.equal(typeof nome, "string");
            assert.ok(nome.trim().length > 0);
            assert.ok(nome.length <= 150);
        });
    });
});

test("convites compostos mantêm os agrupamentos definidos", () => {
    const porTitulo = new Map(
        convites.map((convite) => [convite.titulo, convite])
    );

    const flavia = porTitulo.get("Flávia & família");
    assert.equal(flavia.responsavel, "Flávia");
    assert.deepEqual(flavia.membros, [
        "Cecília",
        "André",
        "Ana",
        "Stanley",
        "Benício"
    ]);

    const kelly = porTitulo.get("Kelly & família");
    assert.equal(kelly.responsavel, "Kelly");
    assert.deepEqual(kelly.membros, [
        "Rodrigo",
        "Gustavo",
        "Victor",
        "Isabela"
    ]);

    const tiaBii = porTitulo.get("Tia Bii");
    assert.equal(tiaBii.responsavel, "Tia Bii");
    assert.deepEqual(tiaBii.membros, []);
});
