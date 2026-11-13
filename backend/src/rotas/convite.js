/* =========================================================
   Rotas do convite e do RSVP
========================================================= */

const express = require("express");
const { HttpError } = require("../utils/httpError");
const { validarToken, validarCorpoRsvp } = require("../validacoes/convite");
const {
    buscarConvidadoPorToken,
    atualizarRsvp
} = require("../servicos/convidados");

function criarRotasConvite(pool) {
    const router = express.Router();

    /* GET /api/convite/:token */
    router.get("/:token", async (req, res, next) => {
        try {
            const token = validarToken(req.params.token);
            const convidado = await buscarConvidadoPorToken(pool, token);

            if (!convidado) {
                throw new HttpError(
                    404,
                    "TOKEN_NAO_ENCONTRADO",
                    "Convite não encontrado."
                );
            }

            return res.status(200).json({
                ok: true,
                data: {
                    nome: convidado.nome,
                    status: convidado.status
                }
            });
        } catch (erro) {
            return next(erro);
        }
    });

    /* POST /api/convite/:token/rsvp */
    router.post("/:token/rsvp", async (req, res, next) => {
        try {
            const token = validarToken(req.params.token);
            const status = validarCorpoRsvp(req.body);
            const convidado = await atualizarRsvp(pool, token, status);

            if (!convidado) {
                throw new HttpError(
                    404,
                    "TOKEN_NAO_ENCONTRADO",
                    "Convite não encontrado."
                );
            }

            return res.status(200).json({
                ok: true,
                data: {
                    nome: convidado.nome,
                    status: convidado.status
                }
            });
        } catch (erro) {
            return next(erro);
        }
    });

    return router;
}

module.exports = criarRotasConvite;
