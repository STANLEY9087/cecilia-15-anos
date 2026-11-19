/* =========================================================
   Seed controlado dos convidados oficiais
   Uso: npm run seed -- --confirm

   Regras:
   - exige --confirm na linha de comando;
   - nunca insere se a tabela public.convidados já tiver registros;
   - respeita o teto máximo de 100 convidados;
   - gera tokens únicos com crypto.randomBytes (base64url);
   - gera localmente o CSV com os links (ignorado pelo Git).
========================================================= */

const fs = require("node:fs");
const path = require("node:path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { Pool } = require("pg");
const { gerarToken } = require("../src/utils/token");

const LIMITE_MAXIMO_CONVIDADOS = 100;
const CONFIRMADO = process.argv.includes("--confirm");

const ARQUIVO_CONVIDADOS = path.join(
    __dirname,
    "..",
    "data",
    "convidados-oficiais.json"
);
const ARQUIVO_SAIDA = path.join(
    __dirname,
    "..",
    "saida-links-convidados.csv"
);

const BASE_URL = String(
    process.env.SITE_URL || "https://convite-cecilia.netlify.app"
).replace(/\/+$/, "");

/**
 * Carrega e valida a lista de nomes antes de qualquer conexão.
 */
function carregarNomes() {
    let bruto;

    try {
        bruto = fs.readFileSync(ARQUIVO_CONVIDADOS, "utf8");
    } catch (erro) {
        throw new Error(
            `Não foi possível ler ${ARQUIVO_CONVIDADOS}: ${erro.message}`
        );
    }

    let lista;

    try {
        lista = JSON.parse(bruto);
    } catch (erro) {
        throw new Error(`JSON inválido em ${ARQUIVO_CONVIDADOS}: ${erro.message}`);
    }

    if (!Array.isArray(lista)) {
        throw new Error("O arquivo de convidados deve conter um array JSON.");
    }

    /* Mantém a ordem e as repetições; descarta apenas itens vazios. */
    const nomes = lista
        .map((nome) => (typeof nome === "string" ? nome.trim() : ""))
        .filter(Boolean);

    if (nomes.length < 1) {
        throw new Error("A lista de convidados está vazia.");
    }

    if (nomes.length > LIMITE_MAXIMO_CONVIDADOS) {
        throw new Error(
            `A lista possui ${nomes.length} convidados; o limite máximo é ${LIMITE_MAXIMO_CONVIDADOS}.`
        );
    }

    return nomes;
}

function campoCsv(valor) {
    const texto = String(valor === undefined || valor === null ? "" : valor);

    if (/[";\r\n]/.test(texto)) {
        return `"${texto.replace(/"/g, '""')}"`;
    }

    return texto;
}

function montarCsv(registros) {
    const linhas = ["Numero;ID;Nome;Status;Token;Link"];

    registros.forEach((registro, indice) => {
        const link = `${BASE_URL}/convite.html?token=${registro.token}`;

        linhas.push(
            [
                indice + 1,
                registro.id,
                registro.nome,
                registro.status,
                registro.token,
                link
            ]
                .map(campoCsv)
                .join(";")
        );
    });

    return linhas.join("\r\n") + "\r\n";
}

function mascararToken(token) {
    const texto = String(token || "");

    if (texto.length <= 8) {
        return "****";
    }

    return `${texto.slice(0, 4)}…${texto.slice(-4)}`;
}

async function executar() {
    if (!CONFIRMADO) {
        console.error("Seed NÃO executado.");
        console.error(
            "Este script exige confirmação explícita: npm run seed -- --confirm"
        );
        process.exitCode = 1;
        return;
    }

    const connectionString =
        process.env.DIRECT_URL || process.env.DATABASE_URL;

    if (!connectionString) {
        console.error(
            "DIRECT_URL ou DATABASE_URL não configurada. Seed NÃO executado."
        );
        process.exitCode = 1;
        return;
    }

    let nomes;

    try {
        nomes = carregarNomes();
    } catch (erro) {
        console.error(`${erro.message} Seed NÃO executado.`);
        process.exitCode = 1;
        return;
    }

    if (nomes.length > LIMITE_MAXIMO_CONVIDADOS) {
        console.error(
            `Limite de ${LIMITE_MAXIMO_CONVIDADOS} convidados excedido. Seed NÃO executado.`
        );
        process.exitCode = 1;
        return;
    }

    const pool = new Pool({
        connectionString,
        connectionTimeoutMillis: 10000
    });

    let cliente = null;

    try {
        cliente = await pool.connect();

        const contagem = await cliente.query(
            "SELECT COUNT(*)::int AS total FROM public.convidados"
        );
        const totalAtual = contagem.rows[0].total;

        if (totalAtual > 0) {
            console.error(
                `A tabela public.convidados já possui ${totalAtual} registro(s). ` +
                    "Nada foi inserido para evitar duplicação."
            );
            process.exitCode = 1;
            return;
        }

        if (totalAtual + nomes.length > LIMITE_MAXIMO_CONVIDADOS) {
            console.error(
                `A inserção ultrapassaria o limite de ${LIMITE_MAXIMO_CONVIDADOS} convidados. ` +
                    "Nada foi inserido."
            );
            process.exitCode = 1;
            return;
        }

        const inseridos = [];

        await cliente.query("BEGIN");

        try {
            for (const nome of nomes) {
                const token = gerarToken();

                const resultado = await cliente.query(
                    `INSERT INTO public.convidados (nome, token, status)
                     VALUES ($1, $2, 'pendente')
                     RETURNING id, nome, token, status`,
                    [nome, token]
                );

                inseridos.push(resultado.rows[0]);
            }

            await cliente.query("COMMIT");
        } catch (erro) {
            await cliente.query("ROLLBACK");
            throw erro;
        }

        fs.writeFileSync(
            ARQUIVO_SAIDA,
            "\uFEFF" + montarCsv(inseridos),
            "utf8"
        );

        const vagasRestantes = LIMITE_MAXIMO_CONVIDADOS - inseridos.length;

        console.log("");
        console.log("Seed concluído com sucesso.");
        console.log(
            `- Convidados inseridos: ${inseridos.length} de ${LIMITE_MAXIMO_CONVIDADOS} vagas`
        );
        console.log(`- Vagas restantes: ${vagasRestantes}`);
        console.log(`- CSV gerado: ${ARQUIVO_SAIDA}`);
        console.log("- Primeiros convidados (tokens mascarados):");

        inseridos.slice(0, 3).forEach((registro, indice) => {
            console.log(
                `  ${indice + 1}. ${registro.nome} — token ${mascararToken(registro.token)}`
            );
        });
    } finally {
        if (cliente) {
            cliente.release();
        }

        await pool.end();
    }
}

executar().catch((erro) => {
    console.error("Falha no seed:", erro.message);
    process.exitCode = 1;
});
