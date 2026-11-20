/* =========================================================
   Pool PostgreSQL falso, em memória, para testes isolados.
   Nenhuma conexão com o banco real é aberta.
========================================================= */

function criarPoolFalso({
    convites = [],
    convidados = [],
    falharBanco = false,
    agora = () => new Date()
} = {}) {
    const registrosConvites = convites.map((convite) => ({
        respondido_em: null,
        ...convite
    }));

    const registrosConvidados = convidados.map((convidado) => ({
        eh_responsavel: false,
        eh_extra: false,
        respondido_em: null,
        ...convidado
    }));

    const chamadas = [];

    let proximoIdConvidado =
        registrosConvidados.reduce(
            (maior, registro) => Math.max(maior, registro.id || 0),
            0
        ) + 1;

    let proximoIdConvite =
        registrosConvites.reduce(
            (maior, registro) => Math.max(maior, registro.id || 0),
            0
        ) + 1;

    function buscarConvitePorId(id) {
        return registrosConvites.find((convite) => convite.id === id) || null;
    }

    function buscarConvitePorToken(token) {
        return (
            registrosConvites.find((convite) => convite.token === token) || null
        );
    }

    function membrosDoConvite(conviteId) {
        return registrosConvidados
            .filter(
                (registro) =>
                    registro.convite_id === conviteId &&
                    registro.eh_responsavel === false
            )
            .sort((a, b) => a.id - b.id);
    }

    function resumoMembro(registro) {
        return {
            id: registro.id,
            nome: registro.nome,
            status: registro.status,
            eh_extra: registro.eh_extra
        };
    }

    return {
        chamadas,
        convites: registrosConvites,
        convidados: registrosConvidados,

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
                /^SELECT pg_advisory_xact_lock\(hashtext\('cecilia_15_anos_teto'\)\)$/i.test(
                    sql
                )
            ) {
                return { rows: [{}], rowCount: 1 };
            }

            if (
                /^SELECT id, titulo, responsavel_nome, token, status, respondido_em FROM convites ORDER BY id$/i.test(
                    sql
                )
            ) {
                const convitesOrdenados = [...registrosConvites].sort(
                    (a, b) => a.id - b.id
                );

                return {
                    rows: convitesOrdenados,
                    rowCount: convitesOrdenados.length
                };
            }

            if (
                /^SELECT id, convite_id, nome, eh_responsavel, eh_extra, status, respondido_em FROM convidados ORDER BY id$/i.test(
                    sql
                )
            ) {
                const convidadosOrdenados = [...registrosConvidados].sort(
                    (a, b) => a.id - b.id
                );

                return {
                    rows: convidadosOrdenados,
                    rowCount: convidadosOrdenados.length
                };
            }

            if (
                /^SELECT id, titulo, responsavel_nome, status, respondido_em FROM convites WHERE token = \$1$/i.test(
                    sql
                )
            ) {
                const convite = buscarConvitePorToken(parametros[0]);

                if (!convite) {
                    return { rows: [], rowCount: 0 };
                }

                return {
                    rows: [
                        {
                            id: convite.id,
                            titulo: convite.titulo,
                            responsavel_nome: convite.responsavel_nome,
                            status: convite.status,
                            respondido_em: convite.respondido_em
                        }
                    ],
                    rowCount: 1
                };
            }

            if (
                /^SELECT id, nome, status, eh_extra FROM convidados WHERE convite_id = \$1 AND eh_responsavel = FALSE ORDER BY id$/i.test(
                    sql
                )
            ) {
                const membros = membrosDoConvite(parametros[0]).map(
                    resumoMembro
                );

                return { rows: membros, rowCount: membros.length };
            }

            if (
                /^SELECT COUNT\(\*\)::int AS total FROM convidados WHERE status <> 'recusado'$/i.test(
                    sql
                )
            ) {
                const total = registrosConvidados.filter(
                    (registro) => registro.status !== "recusado"
                ).length;

                return { rows: [{ total }], rowCount: 1 };
            }

            if (
                /^UPDATE convites SET status = \$2, respondido_em = NOW\(\) WHERE id = \$1$/i.test(
                    sql
                )
            ) {
                const convite = buscarConvitePorId(parametros[0]);

                if (!convite) {
                    return { rows: [], rowCount: 0 };
                }

                convite.status = parametros[1];
                convite.respondido_em = agora();

                return { rows: [convite], rowCount: 1 };
            }

            if (
                /^UPDATE convidados SET status = \$2, respondido_em = NOW\(\) WHERE convite_id = \$1 AND eh_responsavel = TRUE$/i.test(
                    sql
                )
            ) {
                const alvos = registrosConvidados.filter(
                    (registro) =>
                        registro.convite_id === parametros[0] &&
                        registro.eh_responsavel === true
                );

                alvos.forEach((registro) => {
                    registro.status = parametros[1];
                    registro.respondido_em = agora();
                });

                return { rows: alvos, rowCount: alvos.length };
            }

            if (
                /^UPDATE convidados SET status = 'recusado', respondido_em = NOW\(\) WHERE convite_id = \$1 AND eh_responsavel = FALSE$/i.test(
                    sql
                )
            ) {
                const alvos = membrosDoConvite(parametros[0]);

                alvos.forEach((registro) => {
                    registro.status = "recusado";
                    registro.respondido_em = agora();
                });

                return { rows: alvos, rowCount: alvos.length };
            }

            if (
                /^UPDATE convidados SET status = \$3, respondido_em = NOW\(\) WHERE id = \$1 AND convite_id = \$2 AND eh_responsavel = FALSE RETURNING id, nome, status, eh_extra$/i.test(
                    sql
                )
            ) {
                const registro = registrosConvidados.find(
                    (item) =>
                        item.id === parametros[0] &&
                        item.convite_id === parametros[1] &&
                        item.eh_responsavel === false
                );

                if (!registro) {
                    return { rows: [], rowCount: 0 };
                }

                registro.status = parametros[2];
                registro.respondido_em = agora();

                return {
                    rows: [resumoMembro(registro)],
                    rowCount: 1
                };
            }

            if (
                /^INSERT INTO convites \(titulo, responsavel_nome, token, status\) VALUES \(\$1, \$2, \$3, 'pendente'\) RETURNING id, titulo, responsavel_nome, token, status, respondido_em$/i.test(
                    sql
                )
            ) {
                const convite = {
                    id: proximoIdConvite++,
                    titulo: parametros[0],
                    responsavel_nome: parametros[1],
                    token: parametros[2],
                    status: "pendente",
                    respondido_em: null
                };

                registrosConvites.push(convite);

                return { rows: [convite], rowCount: 1 };
            }

            const insercaoPessoa = sql.match(
                /^INSERT INTO convidados \(convite_id, nome, eh_responsavel, eh_extra, status\) VALUES \(\$1, \$2, (TRUE|FALSE), FALSE, 'pendente'\) RETURNING id, nome, eh_responsavel, eh_extra, status, respondido_em$/i
            );

            if (insercaoPessoa) {
                const registro = {
                    id: proximoIdConvidado++,
                    convite_id: parametros[0],
                    nome: parametros[1],
                    eh_responsavel:
                        insercaoPessoa[1].toUpperCase() === "TRUE",
                    eh_extra: false,
                    status: "pendente",
                    respondido_em: null
                };

                registrosConvidados.push(registro);

                return { rows: [registro], rowCount: 1 };
            }

            if (
                /^INSERT INTO convidados \(convite_id, nome, eh_responsavel, eh_extra, status\) VALUES \(\$1, \$2, FALSE, TRUE, 'confirmado'\) RETURNING id, nome, status, eh_extra$/i.test(
                    sql
                )
            ) {
                const registro = {
                    id: proximoIdConvidado++,
                    convite_id: parametros[0],
                    nome: parametros[1],
                    eh_responsavel: false,
                    eh_extra: true,
                    status: "confirmado",
                    respondido_em: agora()
                };

                registrosConvidados.push(registro);

                return {
                    rows: [resumoMembro(registro)],
                    rowCount: 1
                };
            }

            throw new Error(`SQL inesperado no pool falso: ${sql}`);
        }
    };
}

module.exports = { criarPoolFalso };
