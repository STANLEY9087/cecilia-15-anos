/* =========================================================
   Rotas do painel administrativo (protegidas por senha)
========================================================= */

const crypto = require("node:crypto");
const express = require("express");
const { HttpError } = require("../utils/httpError");
const { validarNovoConvite } = require("../validacoes/admin");
const {
    obterPainelAdmin,
    criarConviteAdmin
} = require("../servicos/convidados");

function responderErro(res, status, codigo, mensagem) {
    return res.status(status).json({
        ok: false,
        erro: { codigo, mensagem }
    });
}

/**
 * Compara senhas em tempo constante. O hash garante buffers do mesmo
 * tamanho, permitindo usar crypto.timingSafeEqual com segurança.
 */
function senhasIguais(recebida, esperada) {
    const hashRecebida = crypto
        .createHash("sha256")
        .update(String(recebida))
        .digest();

    const hashEsperada = crypto
        .createHash("sha256")
        .update(String(esperada))
        .digest();

    return crypto.timingSafeEqual(hashRecebida, hashEsperada);
}

function validarSenhaAdmin(req, res, next) {
    const senhaEsperada = process.env.ADMIN_PASSWORD;

    if (!senhaEsperada) {
        return responderErro(
            res,
            503,
            "ADMIN_NAO_CONFIGURADO",
            "O painel administrativo não está configurado no servidor."
        );
    }

    const cabecalho = String(req.get("authorization") || "").trim();
    const correspondencia = /^Bearer\s+(.+)$/i.exec(cabecalho);
    const senhaRecebida = correspondencia ? correspondencia[1] : "";

    if (!senhaRecebida || !senhasIguais(senhaRecebida, senhaEsperada)) {
        res.set("WWW-Authenticate", 'Bearer realm="admin"');

        return responderErro(
            res,
            401,
            "NAO_AUTORIZADO",
            "Senha administrativa inválida."
        );
    }

    return next();
}

function criarRotasAdmin({ pool, frontendUrl = "" } = {}) {
    const router = express.Router();

    /* GET /api/admin/convites */
    router.get("/convites", validarSenhaAdmin, async (req, res, next) => {
        try {
            const dados = await obterPainelAdmin(pool, frontendUrl);

            return res.status(200).json({ ok: true, data: dados });
        } catch (erro) {
            return next(erro);
        }
    });

    /* POST /api/admin/convites */
    router.post("/convites", validarSenhaAdmin, async (req, res, next) => {
        try {
            const dados = validarNovoConvite(req.body);

            const resultado = await criarConviteAdmin(pool, {
                ...dados,
                frontendUrl
            });

            if (resultado.erro === "LIMITE_ATINGIDO") {
                throw new HttpError(
                    409,
                    "LIMITE_ATINGIDO",
                    "O teto de 100 pessoas ativas da festa seria ultrapassado."
                );
            }

            return res.status(201).json({
                ok: true,
                data: resultado.convite
            });
        } catch (erro) {
            return next(erro);
        }
    });

    return router;
}

module.exports = criarRotasAdmin;
module.exports.validarSenhaAdmin = validarSenhaAdmin;
module.exports.senhasIguais = senhasIguais;
