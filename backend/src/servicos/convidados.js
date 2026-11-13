/* =========================================================
   Acesso aos dados dos convidados
========================================================= */

const SQL_BUSCAR_CONVIDADO =
    "SELECT nome, status FROM convidados WHERE token = $1";

const SQL_ATUALIZAR_RSVP = `
    UPDATE convidados
       SET status = $2,
           respondido_em = NOW(),
           atualizado_em = NOW()
     WHERE token = $1
 RETURNING nome, status
`;

async function buscarConvidadoPorToken(pool, token) {
    const resultado = await pool.query(SQL_BUSCAR_CONVIDADO, [token]);
    return resultado.rows[0] || null;
}

async function atualizarRsvp(pool, token, status) {
    const resultado = await pool.query(SQL_ATUALIZAR_RSVP, [token, status]);
    return resultado.rows[0] || null;
}

async function verificarBanco(pool) {
    await pool.query("SELECT 1");
}

module.exports = {
    buscarConvidadoPorToken,
    atualizarRsvp,
    verificarBanco
};
