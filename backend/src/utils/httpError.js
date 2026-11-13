/* =========================================================
   Erro HTTP controlado
========================================================= */

class HttpError extends Error {
    constructor(status, codigo, mensagem) {
        super(mensagem);
        this.name = "HttpError";
        this.status = status;
        this.codigo = codigo;
    }
}

module.exports = { HttpError };
