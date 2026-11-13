/* =========================================================
   Validações do RSVP
========================================================= */

const { HttpError } = require("../utils/httpError");
const {
    normalizarToken,
    tokenTemFormatoValido
} = require("../utils/token");

const STATUS_PERMITIDOS = Object.freeze(["confirmado", "recusado"]);

/**
 * Token malformado recebe o mesmo 404 de token inexistente,
 * para não revelar detalhes sobre tokens válidos.
 */
function validarToken(token) {
    const tokenNormalizado = normalizarToken(token);

    if (!tokenTemFormatoValido(tokenNormalizado)) {
        throw new HttpError(
            404,
            "TOKEN_NAO_ENCONTRADO",
            "Convite não encontrado."
        );
    }

    return tokenNormalizado;
}

function validarCorpoRsvp(corpo) {
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
        throw new HttpError(
            400,
            "DADOS_INVALIDOS",
            "Envie um objeto JSON com o campo status."
        );
    }

    const chaves = Object.keys(corpo);

    if (chaves.length !== 1 || chaves[0] !== "status") {
        throw new HttpError(
            400,
            "DADOS_INVALIDOS",
            "Envie somente o campo status."
        );
    }

    if (
        typeof corpo.status !== "string" ||
        !STATUS_PERMITIDOS.includes(corpo.status)
    ) {
        throw new HttpError(
            400,
            "STATUS_INVALIDO",
            'O status deve ser "confirmado" ou "recusado".'
        );
    }

    return corpo.status;
}

module.exports = {
    STATUS_PERMITIDOS,
    validarToken,
    validarCorpoRsvp
};
