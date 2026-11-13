/* =========================================================
   Executor de migrações — execução controlada
   Uso: npm run migrate -- --confirm
========================================================= */

const fs = require("node:fs");
const path = require("node:path");

require("dotenv").config();

const { Pool } = require("pg");

const CONFIRMADO = process.argv.includes("--confirm");
const DIRETORIO_MIGRACOES = path.join(__dirname, "..", "migrations");
const CHAVE_LOCK = "cecilia_15_anos_migracoes";

async function executar() {
    if (!CONFIRMADO) {
        console.error("Migração NÃO executada.");
        console.error(
            "Este script exige confirmação explícita: npm run migrate -- --confirm"
        );
        process.exitCode = 1;
        return;
    }

    if (!process.env.DATABASE_URL) {
        console.error("DATABASE_URL não configurada. Migração NÃO executada.");
        process.exitCode = 1;
        return;
    }

    const url = new URL(process.env.DATABASE_URL);
    console.log(`Banco alvo: ${url.hostname}${url.pathname}`);

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
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

        const arquivos = fs
            .readdirSync(DIRETORIO_MIGRACOES)
            .filter((arquivo) => arquivo.endsWith(".sql"))
            .sort();

        for (const arquivo of arquivos) {
            const jaAplicada = await cliente.query(
                "SELECT 1 FROM public.schema_migrations WHERE nome = $1",
                [arquivo]
            );

            if (jaAplicada.rowCount > 0) {
                console.log(`- ${arquivo}: já aplicada`);
                continue;
            }

            const sql = fs.readFileSync(
                path.join(DIRETORIO_MIGRACOES, arquivo),
                "utf8"
            );

            console.log(`- ${arquivo}: aplicando...`);

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

        console.log("Migrações concluídas.");
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
