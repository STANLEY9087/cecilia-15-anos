/* =========================================================
   Pool PostgreSQL falso, em memória, para testes isolados.
   Nenhuma conexão com o banco real é aberta.
========================================================= */

function criarPoolFalso({
    convidados = [],
    falharBanco = false,
    agora = () => new Date()
} = {}) {
    const registros = convidados.map((convidado) => ({
        respondido_em: null,
        atualizado_em: null,
        ...convidado
    }));

    const chamadas = [];

    return {
        chamadas,
        registros,

        async query(texto, parametros = []) {
            chamadas.push({ texto, parametros });

            if (falharBanco) {
                throw new Error("falha simulada no banco");
            }

            const sql = String(texto).replace(/\s+/g, " ").trim();

            if (/^SELECT 1$/i.test(sql)) {
                return { rows: [{ ok: 1 }], rowCount: 1 };
            }

            if (
                /^SELECT nome, status FROM convidados WHERE token = \$1$/i.test(
                    sql
                )
            ) {
                const convidado = registros.find(
                    (registro) => registro.token === parametros[0]
                );

                if (!convidado) {
                    return { rows: [], rowCount: 0 };
                }

                return {
                    rows: [{ nome: convidado.nome, status: convidado.status }],
                    rowCount: 1
                };
            }

            if (
                /^UPDATE convidados SET status = \$2, respondido_em = NOW\(\), atualizado_em = NOW\(\) WHERE token = \$1 RETURNING nome, status$/i.test(
                    sql
                )
            ) {
                const convidado = registros.find(
                    (registro) => registro.token === parametros[0]
                );

                if (!convidado) {
                    return { rows: [], rowCount: 0 };
                }

                const momento = agora();

                convidado.status = parametros[1];
                convidado.respondido_em = momento;
                convidado.atualizado_em = momento;

                return {
                    rows: [{ nome: convidado.nome, status: convidado.status }],
                    rowCount: 1
                };
            }

            throw new Error(`SQL inesperado no pool falso: ${sql}`);
        }
    };
}

module.exports = { criarPoolFalso };
