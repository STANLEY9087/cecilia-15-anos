/* =========================================================
   Tratamento de rotas inexistentes
========================================================= */

function naoEncontrado(req, res) {
    return res.status(404).json({
        ok: false,
        erro: {
            codigo: "ROTA_NAO_ENCONTRADA",
            mensagem: "Rota não encontrada."
        }
    });
}

module.exports = naoEncontrado;
