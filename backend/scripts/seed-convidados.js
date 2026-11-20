/* =========================================================
   Seed controlado dos convites e convidados oficiais
   Uso: npm run seed -- --confirm

   Regras:
   - exige --confirm na linha de comando;
   - nunca insere se public.convites ou public.convidados
     já tiverem registros;
   - respeita o teto máximo de 100 pessoas;
   - gera um token único por convite (base64url);
   - insere o responsável e os membros dentro de uma transação;
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
    process.env.FRONTEND_URL ||
        process.env.SITE_URL ||
        "https://convite-cecilia.netlify.app"
).replace(/\/+$/, "");

/**
 * Carrega e valida os 39 convites antes de qualquer conexão.
 */
function carregarConvites() {
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

    if (lista.length === 0) {
        throw new Error("A lista de convites está vazia.");
    }

    const convites = lista.map((item, indice) => {
        const posicao = indice + 1;

        if (!item || typeof item !== "object" || Array.isArray(item)) {
            throw new Error(`Convite ${posicao}: formato inválido.`);
        }

        const titulo =
            typeof item.titulo === "string" ? item.titulo.trim() : "";
        const responsavel =
            typeof item.responsavel === "string"
                ? item.responsavel.trim()
                : "";

        if (!titulo || titulo.length > 150) {
            throw new Error(
                `Convite ${posicao}: título ausente ou maior que 150 caracteres.`
            );
        }

        if (!responsavel || responsavel.length > 150) {
            throw new Error(
                `Convite ${posicao}: responsável ausente ou maior que 150 caracteres.`
            );
        }

        if (!Array.isArray(item.membros)) {
            throw new Error(`Convite ${posicao}: "membros" deve ser um array.`);
        }

        const membros = item.membros.map((nome, indiceMembro) => {
            if (typeof nome !== "string" || !nome.trim()) {
                throw new Error(
                    `Convite ${posicao}: membro ${indiceMembro + 1} inválido.`
                );
            }

            const nomeLimpo = nome.trim();

            if (nomeLimpo.length > 150) {
                throw new Error(
                    `Convite ${posicao}: membro ${indiceMembro + 1} maior que 150 caracteres.`
                );
            }

            return nomeLimpo;
        });

        return { titulo, responsavel, membros };
    });

    const totalPessoas = convites.reduce(
        (total, convite) => total + 1 + convite.membros.length,
        0
    );

    if (totalPessoas > LIMITE_MAXIMO_CONVIDADOS) {
        throw new Error(
            `Os convites somam ${totalPessoas} pessoas; o limite máximo é ${LIMITE_MAXIMO_CONVIDADOS}.`
        );
    }

    return { convites, totalPessoas };
}

function campoCsv(valor) {
    const texto = String(valor === undefined || valor === null ? "" : valor);

    if (/[";\r\n]/.test(texto)) {
        return `"${texto.replace(/"/g, '""')}"`;
    }

    return texto;
}

function montarCsv(registros) {
    const linhas = [
        "id;titulo;responsavel;qtd_pessoas;status;link"
    ];

    registros.forEach((registro) => {
        const link = `${BASE_URL}/?token=${encodeURIComponent(registro.token)}`;

        linhas.push(
            [
                registro.id,
                registro.titulo,
                registro.responsavel,
                registro.qtd_pessoas,
                registro.status,
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

    let dados;

    try {
        dados = carregarConvites();
    } catch (erro) {
        console.error(`${erro.message} Seed NÃO executado.`);
        process.exitCode = 1;
        return;
    }

    const { convites, totalPessoas } = dados;

    const pool = new Pool({
        connectionString,
        connectionTimeoutMillis: 10000
    });

    let cliente = null;

    try {
        cliente = await pool.connect();

        const contagemConvites = await cliente.query(
            "SELECT COUNT(*)::int AS total FROM public.convites"
        );
        const totalConvites = contagemConvites.rows[0].total;

        if (totalConvites > 0) {
            console.error(
                `A tabela public.convites já possui ${totalConvites} registro(s). ` +
                    "Nada foi inserido para evitar duplicação."
            );
            process.exitCode = 1;
            return;
        }

        const contagemConvidados = await cliente.query(
            "SELECT COUNT(*)::int AS total FROM public.convidados"
        );
        const totalConvidados = contagemConvidados.rows[0].total;

        if (totalConvidados > 0) {
            console.error(
                `A tabela public.convidados já possui ${totalConvidados} registro(s). ` +
                    "Nada foi inserido para evitar duplicação."
            );
            process.exitCode = 1;
            return;
        }

        const inseridos = [];

        await cliente.query("BEGIN");

        try {
            for (const convite of convites) {
                const token = gerarToken();

                const resultadoConvite = await cliente.query(
                    `INSERT INTO public.convites
                         (titulo, responsavel_nome, token, status)
                     VALUES ($1, $2, $3, 'pendente')
                     RETURNING id, titulo, responsavel_nome, token, status`,
                    [convite.titulo, convite.responsavel, token]
                );

                const registro = resultadoConvite.rows[0];

                await cliente.query(
                    `INSERT INTO public.convidados
                         (convite_id, nome, eh_responsavel, eh_extra, status)
                     VALUES ($1, $2, TRUE, FALSE, 'pendente')`,
                    [registro.id, convite.responsavel]
                );

                for (const nome of convite.membros) {
                    await cliente.query(
                        `INSERT INTO public.convidados
                             (convite_id, nome, eh_responsavel, eh_extra, status)
                         VALUES ($1, $2, FALSE, FALSE, 'pendente')`,
                        [registro.id, nome]
                    );
                }

                inseridos.push({
                    id: registro.id,
                    titulo: registro.titulo,
                    responsavel: registro.responsavel_nome,
                    token: registro.token,
                    status: registro.status,
                    qtd_pessoas: 1 + convite.membros.length
                });
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

        const vagasRestantes = LIMITE_MAXIMO_CONVIDADOS - totalPessoas;

        console.log("");
        console.log("Seed concluído com sucesso.");
        console.log(`- Convites inseridos: ${inseridos.length}`);
        console.log(
            `- Pessoas inseridas: ${totalPessoas} de ${LIMITE_MAXIMO_CONVIDADOS} vagas`
        );
        console.log(`- Vagas restantes: ${vagasRestantes}`);
        console.log(`- CSV gerado: ${ARQUIVO_SAIDA}`);
        console.log("- Primeiros convites (tokens mascarados):");

        inseridos.slice(0, 3).forEach((registro, indice) => {
            console.log(
                `  ${indice + 1}. ${registro.titulo} — token ${mascararToken(registro.token)}`
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
