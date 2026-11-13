/* =========================================================
   Tratamento centralizado de erros
========================================================= */

const { HttpError } = require("../utils/httpError");

function responderErro(res, status, codigo, mensagem) {
    return res.status(status).json({
        ok: false,
        erro: { codigo, mensagem }
    });
}

function tratarErros(erro, req, res, next) {
    if (res.headersSent) {
        return next(erro);
    }

    if (erro instanceof HttpError) {
        return responderErro(res, erro.status, erro.codigo, erro.mensagem);
    }

    /* JSON malformado enviado ao express.json() */
    if (erro && erro.type === "entity.parse.failed") {
        return responderErro(
            res,
            400,
            "JSON_INVALIDO",
            "O corpo da requisição não é um JSON válido."
        );
    }

    /* Corpo maior que o limite permitido */
    if (erro && erro.type === "entity.too.large") {
        return responderErro(
            res,
            413,
            "CORPO_MUITO_GRANDE",
            "O corpo da requisição excede o limite permitido."
        );
    }

    /*
     * Nunca registra a URL completa: o token do convite faz parte do path.
     * req.route.path expõe apenas o padrão da rota (ex.: /:token/rsvp).
     */
    const rota = req.route && req.route.path ? req.route.path : "desconhecida";
    const token = req.params && typeof req.params.token === "string"
        ? req.params.token
        : "";

    let mensagem = erro && erro.message
        ? String(erro.message)
        : "erro desconhecido";

    /* Garante que o token nunca apareça integralmente no log. */
    if (token) {
        mensagem = mensagem.split(token).join("[token omitido]");
    }

    console.error(`[erro] ${req.method} ${rota}:`, mensagem);

    return responderErro(
        res,
        500,
        "ERRO_INTERNO",
        "Erro interno do servidor."
    );
}

module.exports = tratarErros;
