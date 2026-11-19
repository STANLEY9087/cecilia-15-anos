/* =========================================================
   CECÍLIA — 15 ANOS
   JAVASCRIPT DO CONVITE
========================================================= */

/* =========================================================
   API DO RSVP
   Troque a URL de produção abaixo no deploy.
========================================================= */

const API_BASE_URL =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
        ? "http://localhost:3000"
        : "https://SEU-BACKEND.onrender.com";


/* =========================================================
   CONTADOR REGRESSIVO
========================================================= */

const dataEvento = new Date("2027-03-20T22:00:00-03:00").getTime();

function atualizarContador() {
    const agora = new Date().getTime();
    const diferenca = dataEvento - agora;

    const dias = Math.floor(diferenca / (1000 * 60 * 60 * 24));
    const horas = Math.floor((diferenca % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutos = Math.floor((diferenca % (1000 * 60 * 60)) / (1000 * 60));
    const segundos = Math.floor((diferenca % (1000 * 60)) / 1000);

    const elDias = document.getElementById("days");
    const elHoras = document.getElementById("hours");
    const elMinutos = document.getElementById("minutes");
    const elSegundos = document.getElementById("seconds");

    if (elDias) elDias.textContent = String(Math.max(dias, 0)).padStart(2, "0");
    if (elHoras) elHoras.textContent = String(Math.max(horas, 0)).padStart(2, "0");
    if (elMinutos) elMinutos.textContent = String(Math.max(minutos, 0)).padStart(2, "0");
    if (elSegundos) elSegundos.textContent = String(Math.max(segundos, 0)).padStart(2, "0");
}

atualizarContador();
setInterval(atualizarContador, 1000);


/* =========================================================
   RSVP — ELEMENTOS
========================================================= */

const rsvpGuestName = document.getElementById("rsvpGuestName");
const rsvpGuestStatus = document.getElementById("rsvpGuestStatus");
const rsvpMessage = document.getElementById("rsvpMessage");
const botaoConfirmar = document.getElementById("confirmarPresenca");
const botaoRecusar = document.getElementById("recusarPresenca");

const tokenConvite = new URLSearchParams(window.location.search).get("token");

const TEXTOS_STATUS = {
    pendente: "Aguardando sua confirmação",
    confirmado: "Presença confirmada",
    recusado: "Não poderá comparecer"
};

let statusAtual = null;
let enviando = false;
let conviteCarregado = false;


/* =========================================================
   MENSAGENS
========================================================= */

function mostrarMensagem(texto, tipo) {
    if (!rsvpMessage) return;

    rsvpMessage.hidden = false;
    rsvpMessage.textContent = texto;
    rsvpMessage.className = `rsvp-message ${tipo}`;
}

function limparMensagem() {
    if (!rsvpMessage) return;

    rsvpMessage.hidden = true;
    rsvpMessage.textContent = "";
    rsvpMessage.className = "rsvp-message";
}


/* =========================================================
   ESTADO VISUAL
========================================================= */

function habilitarBotoes(habilitado) {
    [botaoConfirmar, botaoRecusar].forEach((botao) => {
        if (botao) {
            botao.disabled = !habilitado;
        }
    });
}

function destacarBotao(status) {
    if (botaoConfirmar) {
        botaoConfirmar.classList.toggle("is-selected", status === "confirmado");
    }

    if (botaoRecusar) {
        botaoRecusar.classList.toggle("is-selected", status === "recusado");
    }
}

function atualizarStatusTela(status) {
    statusAtual = status || null;

    if (rsvpGuestStatus) {
        rsvpGuestStatus.textContent = TEXTOS_STATUS[statusAtual] || "";
    }

    destacarBotao(statusAtual);
}


/* =========================================================
   CARREGAMENTO DO CONVITE
========================================================= */

async function carregarConvite() {
    habilitarBotoes(false);

    if (!tokenConvite) {
        if (rsvpGuestName) rsvpGuestName.textContent = "";
        if (rsvpGuestStatus) rsvpGuestStatus.textContent = "";

        mostrarMensagem(
            "Acesse este convite através do link individual enviado para você.",
            "error"
        );

        return;
    }

    if (rsvpGuestName) rsvpGuestName.textContent = "";
    if (rsvpGuestStatus) rsvpGuestStatus.textContent = "Carregando convite...";

    limparMensagem();

    try {
        const resposta = await fetch(
            `${API_BASE_URL}/api/convite/${encodeURIComponent(tokenConvite)}`,
            { headers: { Accept: "application/json" } }
        );

        if (resposta.status === 404) {
            if (rsvpGuestStatus) rsvpGuestStatus.textContent = "";

            mostrarMensagem(
                "Convite não encontrado. Verifique o link recebido.",
                "error"
            );

            return;
        }

        if (!resposta.ok) {
            throw new Error("Resposta inesperada do servidor.");
        }

        const corpo = await resposta.json();

        if (!corpo || corpo.ok !== true || !corpo.data) {
            throw new Error("Resposta inválida do servidor.");
        }

        if (rsvpGuestName) {
            rsvpGuestName.textContent = `Olá, ${corpo.data.nome}`;
        }

        atualizarStatusTela(corpo.data.status);

        conviteCarregado = true;
        habilitarBotoes(true);
    } catch (erro) {
        console.error("[RSVP] Falha ao carregar o convite:", erro);

        if (rsvpGuestName) rsvpGuestName.textContent = "";
        if (rsvpGuestStatus) rsvpGuestStatus.textContent = "";

        mostrarMensagem(
            "Não foi possível carregar seu convite. Verifique sua conexão e tente novamente.",
            "error"
        );
    }
}


/* =========================================================
   ENVIO DA RESPOSTA
========================================================= */

async function enviarResposta(status) {
    if (enviando || !conviteCarregado || !tokenConvite) {
        return;
    }

    enviando = true;

    habilitarBotoes(false);

    if (rsvpGuestStatus) {
        rsvpGuestStatus.textContent = "Enviando sua resposta...";
    }

    limparMensagem();

    try {
        const resposta = await fetch(
            `${API_BASE_URL}/api/convite/${encodeURIComponent(tokenConvite)}/rsvp`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json"
                },
                body: JSON.stringify({ status })
            }
        );

        const corpo = await resposta.json().catch(() => null);

        if (!resposta.ok) {
            const mensagemApi =
                corpo && corpo.erro && corpo.erro.mensagem
                    ? corpo.erro.mensagem
                    : "Não foi possível registrar sua resposta. Tente novamente.";

            throw new Error(mensagemApi);
        }

        const dados = (corpo && corpo.data) || {};
        const novoStatus = dados.status || status;

        if (dados.nome && rsvpGuestName) {
            rsvpGuestName.textContent = `Olá, ${dados.nome}`;
        }

        atualizarStatusTela(novoStatus);

        mostrarMensagem(
            novoStatus === "confirmado"
                ? "Presença confirmada com sucesso! Caso precise alterar sua resposta depois, basta usar este mesmo link."
                : "Resposta registrada. Sentiremos sua falta! Caso mude de ideia, você pode confirmar por este mesmo link.",
            "success"
        );
    } catch (erro) {
        console.error("[RSVP] Falha ao enviar a resposta:", erro);

        atualizarStatusTela(statusAtual);

        mostrarMensagem(
            erro.message ||
                "Não foi possível registrar sua resposta. Tente novamente.",
            "error"
        );
    } finally {
        enviando = false;

        if (conviteCarregado) {
            habilitarBotoes(true);
        }
    }
}


/* =========================================================
   EVENTOS
========================================================= */

if (botaoConfirmar) {
    botaoConfirmar.addEventListener("click", () => enviarResposta("confirmado"));
}

if (botaoRecusar) {
    botaoRecusar.addEventListener("click", () => enviarResposta("recusado"));
}

carregarConvite();
