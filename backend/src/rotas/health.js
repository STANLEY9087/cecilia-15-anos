/* =========================================================
   Rota de health check
========================================================= */

const express = require("express");
const { HttpError } = require("../utils/httpError");
const { verificarBanco } = require("../servicos/convidados");

function criarRotasHealth(pool) {
    const router = express.Router();

    router.get("/", async (req, res, next) => {
        try {
            await verificarBanco(pool);

            return res.status(200).json({
                ok: true,
                data: {
                    status: "ok",
                    banco: "ok",
                    horario: new Date().toISOString()
                }
            });
        } catch (erro) {
            return next(
                new HttpError(
                    503,
                    "BANCO_INDISPONIVEL",
                    "Não foi possível acessar o banco de dados."
                )
            );
        }
    });

    return router;
}

module.exports = criarRotasHealth;
