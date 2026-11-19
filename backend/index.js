/* =========================================================
   API RSVP — CECÍLIA 15 ANOS
   Ponto de entrada do servidor
========================================================= */

const path = require("node:path");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const pool = require("./db");
const criarApp = require("./src/app");

const PORT = Number(process.env.PORT) || 3000;
const FRONTEND_URL = String(process.env.FRONTEND_URL || "").trim();
const NODE_ENV = process.env.NODE_ENV || "development";

if (NODE_ENV === "production" && !FRONTEND_URL) {
    console.error(
        "[startup] FRONTEND_URL é obrigatória em produção. Servidor não iniciado."
    );
    process.exit(1);
}

if (!FRONTEND_URL) {
    console.warn(
        "[startup] FRONTEND_URL não configurada: o CORS não liberará origens externas."
    );
}

const app = criarApp({ pool, frontendUrl: FRONTEND_URL });

pool.on("error", (erro) => {
    console.error("[db] Erro inesperado no pool:", erro.message);
});

const servidor = app.listen(PORT, () => {
    console.log(`[api] Servidor ouvindo na porta ${PORT} (${NODE_ENV}).`);
});

function encerrar(sinal) {
    console.log(`[api] Sinal ${sinal} recebido. Encerrando...`);

    const limite = setTimeout(() => process.exit(1), 10000);
    limite.unref();

    servidor.close(async () => {
        try {
            await pool.end();
            console.log("[api] Servidor e conexões encerrados.");
            process.exit(0);
        } catch (erro) {
            console.error("[api] Falha ao encerrar:", erro.message);
            process.exit(1);
        }
    });
}

process.on("SIGTERM", () => encerrar("SIGTERM"));
process.on("SIGINT", () => encerrar("SIGINT"));

module.exports = servidor;
