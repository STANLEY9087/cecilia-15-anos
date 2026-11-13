/* =========================================================
   Fábrica da aplicação Express
========================================================= */

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const { rateLimit } = require("express-rate-limit");

const criarRotasHealth = require("./rotas/health");
const criarRotasConvite = require("./rotas/convite");
const naoEncontrado = require("./middleware/naoEncontrado");
const tratarErros = require("./middleware/tratarErros");

function normalizarOrigens(frontendUrl) {
    return String(frontendUrl || "")
        .split(",")
        .map((origem) => origem.trim().replace(/\/+$/, ""))
        .filter(Boolean);
}

/**
 * Cria o app Express com as dependências injetadas.
 * A injeção do pool permite testar as rotas sem acessar o banco real.
 */
function criarApp({ pool, frontendUrl = "", rateLimitEnabled = true } = {}) {
    if (!pool || typeof pool.query !== "function") {
        throw new Error("criarApp exige um pool PostgreSQL válido.");
    }

    const app = express();
    const origensPermitidas = normalizarOrigens(frontendUrl);

    app.disable("x-powered-by");
    app.set("trust proxy", 1);

    app.use(helmet());

    app.use(
        cors({
            origin: origensPermitidas.length ? origensPermitidas : false,
            methods: ["GET", "POST", "OPTIONS"],
            allowedHeaders: ["Content-Type"],
            optionsSuccessStatus: 204
        })
    );

    app.use(express.json({ limit: "10kb" }));

    if (rateLimitEnabled) {
        app.use(
            "/api",
            rateLimit({
                windowMs: 15 * 60 * 1000,
                limit: 300,
                standardHeaders: "draft-7",
                legacyHeaders: false,
                message: {
                    ok: false,
                    erro: {
                        codigo: "MUITAS_REQUISICOES",
                        mensagem: "Muitas requisições. Tente novamente mais tarde."
                    }
                }
            })
        );
    }

    app.use("/api/health", criarRotasHealth(pool));
    app.use("/api/convite", criarRotasConvite(pool));

    app.use(naoEncontrado);
    app.use(tratarErros);

    return app;
}

module.exports = criarApp;
module.exports.normalizarOrigens = normalizarOrigens;
