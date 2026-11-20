/* =========================================================
   Validações do painel administrativo
========================================================= */

const { HttpError } = require("../utils/httpError");

const TAMANHO_MAXIMO_TEXTO = 150;
const CAMPOS_PERMITIDOS = ["titulo", "responsavel_nome", "membros"];

function textoValido(valor) {
    return (
        typeof valor === "string" &&
        valor.trim().length > 0 &&
        valor.trim().length <= TAMANHO_MAXIMO_TEXTO
    );
}

function validarNovoConvite(corpo) {
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
        throw new HttpError(
            400,
            "DADOS_INVALIDOS",
            "Envie um objeto JSON com título, responsável e membros."
        );
    }

    const chaves = Object.keys(corpo);
    const campoInvalido = chaves.find(
        (chave) => !CAMPOS_PERMITIDOS.includes(chave)
    );

    if (campoInvalido) {
        throw new HttpError(
            400,
            "DADOS_INVALIDOS",
            `Campo não permitido: ${campoInvalido}.`
        );
    }

    if (!textoValido(corpo.titulo)) {
        throw new HttpError(
            400,
            "TITULO_INVALIDO",
            `O título deve ter entre 1 e ${TAMANHO_MAXIMO_TEXTO} caracteres.`
        );
    }

    if (!textoValido(corpo.responsavel_nome)) {
        throw new HttpError(
            400,
            "RESPONSAVEL_INVALIDO",
            `O responsável deve ter entre 1 e ${TAMANHO_MAXIMO_TEXTO} caracteres.`
        );
    }

    if (
        corpo.membros !== undefined &&
        !Array.isArray(corpo.membros)
    ) {
        throw new HttpError(
            400,
            "DADOS_INVALIDOS",
            "O campo membros deve ser um array de nomes."
        );
    }

    const membrosBrutos = corpo.membros || [];

    const membros = membrosBrutos.map((nome, indice) => {
        if (!textoValido(nome)) {
            throw new HttpError(
                400,
                "NOME_INVALIDO",
                `O membro ${indice + 1} deve ter entre 1 e ${TAMANHO_MAXIMO_TEXTO} caracteres.`
            );
        }

        return nome.trim();
    });

    return {
        titulo: corpo.titulo.trim(),
        responsavelNome: corpo.responsavel_nome.trim(),
        membros
    };
}

module.exports = {
    TAMANHO_MAXIMO_TEXTO,
    validarNovoConvite
};
