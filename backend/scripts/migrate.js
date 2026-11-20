/* =========================================================
   Executor de migrações — execução controlada
   Uso: npm run migrate -- --confirm
========================================================= */

const fs = require("node:fs");
const path = require("node:path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { Pool } = require("pg");

const CONFIRMADO = process.argv.includes("--confirm");
const DIRETORIO_MIGRACOES = path.join(__dirname, "..", "migrations");
const CHAVE_LOCK = "cecilia_15_anos_migracoes";
const PADRAO_MIGRACAO = /^\d{3}_[A-Za-z0-9_-]+\.sql$/;

async function executar() {
    if (!CONFIRMADO) {
        console.error("Migração NÃO executada.");
        console.error(
            "Este script exige confirmação explícita: npm run migrate -- --confirm"
        );
        process.exitCode = 1;
        return;
    }

    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

    if (!connectionString) {
        console.error(
            "DIRECT_URL ou DATABASE_URL não configurada. Migração NÃO executada."
        );
        process.exitCode = 1;
        return;
    }

    const origemConexao = process.env.DIRECT_URL
        ? "DIRECT_URL"
        : "DATABASE_URL";

    const url = new URL(connectionString);
    console.log(`Origem da conexão: ${origemConexao}`);
    console.log(`Banco alvo: ${url.hostname}${url.pathname}`);

    const pool = new Pool({
        connectionString,
        connectionTimeoutMillis: 10000
    });

    let cliente = null;
    let lockAdquirido = false;

    try {
        cliente = await pool.connect();

        await cliente.query(
            `SELECT pg_advisory_lock(hashtext('${CHAVE_LOCK}')::bigint)`
        );
        lockAdquirido = true;

        await cliente.query(`
            CREATE TABLE IF NOT EXISTS public.schema_migrations (
                nome        VARCHAR(255) PRIMARY KEY,
                aplicada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        if (!fs.existsSync(DIRETORIO_MIGRACOES)) {
            throw new Error(
                `Diretório de migrações não encontrado: ${DIRETORIO_MIGRACOES}`
            );
        }

        const arquivos = fs
            .readdirSync(DIRETORIO_MIGRACOES)
            .filter((arquivo) => PADRAO_MIGRACAO.test(arquivo))
            .sort((a, b) => a.localeCompare(b, "en"));

        if (arquivos.length === 0) {
            console.log("Nenhuma migração encontrada.");
            return;
        }

        for (const [indice, arquivo] of arquivos.entries()) {
            const progresso = `[${indice + 1}/${arquivos.length}]`;
            const jaAplicada = await cliente.query(
                "SELECT 1 FROM public.schema_migrations WHERE nome = $1",
                [arquivo]
            );

            if (jaAplicada.rowCount > 0) {
                console.log(`${progresso} ${arquivo}: já aplicada`);
                continue;
            }

            const sql = fs.readFileSync(
                path.join(DIRETORIO_MIGRACOES, arquivo),
                "utf8"
            );

            console.log(`${progresso} ${arquivo}: aplicando...`);

            await cliente.query("BEGIN");

            try {
                await cliente.query(sql);
                await cliente.query(
                    "INSERT INTO public.schema_migrations (nome) VALUES ($1)",
                    [arquivo]
                );
                await cliente.query("COMMIT");
                console.log(`  ${arquivo}: concluída`);
            } catch (erro) {
                await cliente.query("ROLLBACK");
                throw erro;
            }
        }

        console.log(`Migrações concluídas (${arquivos.length} arquivo(s)).`);
    } finally {
        if (cliente) {
            if (lockAdquirido) {
                try {
                    await cliente.query(
                        `SELECT pg_advisory_unlock(hashtext('${CHAVE_LOCK}')::bigint)`
                    );
                } catch (erro) {
                    console.error("Falha ao liberar o lock:", erro.message);
                }
            }

            cliente.release();
        }

        await pool.end();
    }
}

executar().catch((erro) => {
    console.error("Falha na migração:", erro.message);
    process.exitCode = 1;
});
