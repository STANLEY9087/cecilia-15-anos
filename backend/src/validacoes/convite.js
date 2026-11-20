/* =========================================================
   Validações do RSVP por convite / família
========================================================= */

const { HttpError } = require("../utils/httpError");
const {
    normalizarToken,
    tokenTemFormatoValido
} = require("../utils/token");

const STATUS_PERMITIDOS = Object.freeze(["confirmado", "recusado"]);
const TAMANHO_MAXIMO_NOME = 150;

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

function validarStatus(corpo) {
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

function validarCorpoRsvp(corpo) {
    return validarStatus(corpo);
}

function validarCorpoMembro(corpo) {
    return validarStatus(corpo);
}

function validarIdMembro(valor) {
    const id = Number(valor);

    if (!Number.isInteger(id) || id < 1) {
        throw new HttpError(
            400,
            "MEMBRO_INVALIDO",
            "Identificador de familiar inválido."
        );
    }

    return id;
}

function validarCorpoNovoMembro(corpo) {
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
        throw new HttpError(
            400,
            "DADOS_INVALIDOS",
            "Envie um objeto JSON com o campo nome."
        );
    }

    const chaves = Object.keys(corpo);

    if (chaves.length !== 1 || chaves[0] !== "nome") {
        throw new HttpError(
            400,
            "DADOS_INVALIDOS",
            "Envie somente o campo nome."
        );
    }

    if (typeof corpo.nome !== "string") {
        throw new HttpError(
            400,
            "NOME_INVALIDO",
            "O nome do convidado deve ser um texto."
        );
    }

    const nome = corpo.nome.trim();

    if (!nome || nome.length > TAMANHO_MAXIMO_NOME) {
        throw new HttpError(
            400,
            "NOME_INVALIDO",
            `O nome do convidado deve ter entre 1 e ${TAMANHO_MAXIMO_NOME} caracteres.`
        );
    }

    return nome;
}

module.exports = {
    STATUS_PERMITIDOS,
    TAMANHO_MAXIMO_NOME,
    validarToken,
    validarCorpoRsvp,
    validarCorpoMembro,
    validarIdMembro,
    validarCorpoNovoMembro
};
