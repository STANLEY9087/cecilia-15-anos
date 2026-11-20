/* =========================================================
   Acesso aos dados dos convites e convidados
========================================================= */

const LIMITE_MAXIMO_CONVIDADOS = 100;

const SQL_BUSCAR_CONVITE = `
    SELECT id, titulo, responsavel_nome, status, respondido_em
      FROM convites
     WHERE token = $1
`;

const SQL_LISTAR_MEMBROS = `
    SELECT id, nome, status, eh_extra
      FROM convidados
     WHERE convite_id = $1
       AND eh_responsavel = FALSE
  ORDER BY id
`;

const SQL_CONTAR_ATIVOS = `
    SELECT COUNT(*)::int AS total
      FROM convidados
     WHERE status <> 'recusado'
`;

/**
 * Executa as operações dentro de uma transação quando o pool real
 * está disponível. O pool falso dos testes não expõe connect().
 */
async function emTransacao(pool, operacao) {
    if (typeof pool.connect !== "function") {
        return operacao(pool);
    }

    const cliente = await pool.connect();

    try {
        await cliente.query("BEGIN");
        const resultado = await operacao(cliente);
        await cliente.query("COMMIT");
        return resultado;
    } catch (erro) {
        try {
            await cliente.query("ROLLBACK");
        } catch (rollbackErro) {
            console.error("[db] Falha no ROLLBACK:", rollbackErro.message);
        }

        throw erro;
    } finally {
        cliente.release();
    }
}

async function buscarConvitePorToken(pool, token) {
    const resultado = await pool.query(SQL_BUSCAR_CONVITE, [token]);
    return resultado.rows[0] || null;
}

async function listarMembros(pool, conviteId) {
    const resultado = await pool.query(SQL_LISTAR_MEMBROS, [conviteId]);
    return resultado.rows;
}

async function contarAtivos(pool) {
    const resultado = await pool.query(SQL_CONTAR_ATIVOS);
    return resultado.rows[0].total;
}

function calcularVagas(totalAtivos) {
    return Math.max(0, LIMITE_MAXIMO_CONVIDADOS - totalAtivos);
}

/**
 * Monta a resposta pública de um convite: dados do convite,
 * familiares (sem o responsável) e vagas disponíveis na festa.
 */
async function obterConvitePorToken(pool, token) {
    const convite = await buscarConvitePorToken(pool, token);

    if (!convite) {
        return null;
    }

    const membros = await listarMembros(pool, convite.id);
    const totalAtivos = await contarAtivos(pool);

    return {
        ...convite,
        membros,
        vagas_disponiveis: calcularVagas(totalAtivos)
    };
}

async function atualizarRsvp(pool, token, status) {
    const convite = await buscarConvitePorToken(pool, token);

    if (!convite) {
        return null;
    }

    await emTransacao(pool, async (db) => {
        await db.query(
            `UPDATE convites
                SET status = $2,
                    respondido_em = NOW()
              WHERE id = $1`,
            [convite.id, status]
        );

        await db.query(
            `UPDATE convidados
                SET status = $2,
                    respondido_em = NOW()
              WHERE convite_id = $1
                AND eh_responsavel = TRUE`,
            [convite.id, status]
        );

        if (status === "recusado") {
            await db.query(
                `UPDATE convidados
                    SET status = 'recusado',
                        respondido_em = NOW()
                  WHERE convite_id = $1
                    AND eh_responsavel = FALSE`,
                [convite.id]
            );
        }
    });

    return obterConvitePorToken(pool, token);
}

async function atualizarMembro(pool, token, membroId, status) {
    const convite = await buscarConvitePorToken(pool, token);

    if (!convite) {
        return { convite: null, encontrado: false };
    }

    const resultado = await pool.query(
        `UPDATE convidados
            SET status = $3,
                respondido_em = NOW()
          WHERE id = $1
            AND convite_id = $2
            AND eh_responsavel = FALSE
      RETURNING id, nome, status, eh_extra`,
        [membroId, convite.id, status]
    );

    if (!resultado.rows[0]) {
        return { convite, encontrado: false };
    }

    const atualizado = await obterConvitePorToken(pool, token);

    return { convite: atualizado, encontrado: true };
}

async function adicionarMembro(pool, token, nome) {
    const convite = await buscarConvitePorToken(pool, token);

    if (!convite) {
        return { convite: null, erro: "TOKEN_NAO_ENCONTRADO" };
    }

    if (convite.status !== "confirmado") {
        return { convite, erro: "CONVITE_NAO_CONFIRMADO" };
    }

    return emTransacao(pool, async (db) => {
        /* Serializa adições concorrentes para não ultrapassar o teto. */
        await db.query(
            "SELECT pg_advisory_xact_lock(hashtext('cecilia_15_anos_teto'))"
        );

        const totalAtivos = await contarAtivos(db);

        if (totalAtivos >= LIMITE_MAXIMO_CONVIDADOS) {
            return { convite, erro: "LIMITE_ATINGIDO" };
        }

        const resultado = await db.query(
            `INSERT INTO convidados
                 (convite_id, nome, eh_responsavel, eh_extra, status)
             VALUES ($1, $2, FALSE, TRUE, 'confirmado')
         RETURNING id, nome, status, eh_extra`,
            [convite.id, nome]
        );

        return { convite, membro: resultado.rows[0], erro: null };
    });
}

async function verificarBanco(pool) {
    await pool.query("SELECT 1");
}

module.exports = {
    LIMITE_MAXIMO_CONVIDADOS,
    buscarConvitePorToken,
    listarMembros,
    contarAtivos,
    obterConvitePorToken,
    atualizarRsvp,
    atualizarMembro,
    adicionarMembro,
    verificarBanco
};
