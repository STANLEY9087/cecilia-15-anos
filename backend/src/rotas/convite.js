/* =========================================================
   Rotas do convite e do RSVP por família
========================================================= */

const express = require("express");
const { HttpError } = require("../utils/httpError");
const {
    validarToken,
    validarCorpoRsvp,
    validarCorpoMembro,
    validarIdMembro,
    validarCorpoNovoMembro
} = require("../validacoes/convite");
const {
    obterConvitePorToken,
    atualizarRsvp,
    atualizarMembro,
    adicionarMembro
} = require("../servicos/convidados");

function erroTokenNaoEncontrado() {
    return new HttpError(
        404,
        "TOKEN_NAO_ENCONTRADO",
        "Convite não encontrado."
    );
}

function criarRotasConvite(pool) {
    const router = express.Router();

    /* GET /api/convite/:token */
    router.get("/:token", async (req, res, next) => {
        try {
            const token = validarToken(req.params.token);
            const convite = await obterConvitePorToken(pool, token);

            if (!convite) {
                throw erroTokenNaoEncontrado();
            }

            return res.status(200).json({ ok: true, data: convite });
        } catch (erro) {
            return next(erro);
        }
    });

    /* POST /api/convite/:token/rsvp */
    router.post("/:token/rsvp", async (req, res, next) => {
        try {
            const token = validarToken(req.params.token);
            const status = validarCorpoRsvp(req.body);
            const convite = await atualizarRsvp(pool, token, status);

            if (!convite) {
                throw erroTokenNaoEncontrado();
            }

            return res.status(200).json({ ok: true, data: convite });
        } catch (erro) {
            return next(erro);
        }
    });

    /* PATCH /api/convite/:token/membros/:membroId */
    router.patch("/:token/membros/:membroId", async (req, res, next) => {
        try {
            const token = validarToken(req.params.token);
            const membroId = validarIdMembro(req.params.membroId);
            const status = validarCorpoMembro(req.body);

            const resultado = await atualizarMembro(
                pool,
                token,
                membroId,
                status
            );

            if (!resultado.convite) {
                throw erroTokenNaoEncontrado();
            }

            if (!resultado.encontrado) {
                throw new HttpError(
                    404,
                    "MEMBRO_NAO_ENCONTRADO",
                    "Familiar não encontrado neste convite."
                );
            }

            return res.status(200).json({
                ok: true,
                data: resultado.convite
            });
        } catch (erro) {
            return next(erro);
        }
    });

    /* POST /api/convite/:token/membros */
    router.post("/:token/membros", async (req, res, next) => {
        try {
            const token = validarToken(req.params.token);
            const nome = validarCorpoNovoMembro(req.body);

            const resultado = await adicionarMembro(pool, token, nome);

            if (!resultado.convite) {
                throw erroTokenNaoEncontrado();
            }

            if (resultado.erro === "CONVITE_NAO_CONFIRMADO") {
                throw new HttpError(
                    409,
                    "CONVITE_NAO_CONFIRMADO",
                    "Confirme a presença do convite antes de adicionar convidados."
                );
            }

            if (resultado.erro === "LIMITE_ATINGIDO") {
                throw new HttpError(
                    409,
                    "LIMITE_ATINGIDO",
                    "O limite de 100 convidados da festa já foi atingido."
                );
            }

            return res.status(201).json({
                ok: true,
                data: resultado.membro
            });
        } catch (erro) {
            return next(erro);
        }
    });

    return router;
}

module.exports = criarRotasConvite;
