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
        : "https://cecilia-15-api.onrender.com";


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

const rsvpFamily = document.getElementById("rsvpFamily");
const rsvpFamilyList = document.getElementById("rsvpFamilyList");
const rsvpFamilyEmpty = document.getElementById("rsvpFamilyEmpty");
const adicionarConvidadoBtn = document.getElementById("adicionarConvidadoBtn");
const rsvpAddForm = document.getElementById("rsvpAddForm");
const novoConvidadoNome = document.getElementById("novoConvidadoNome");
const salvarConvidadoBtn = document.getElementById("salvarConvidadoBtn");
const rsvpVagas = document.getElementById("rsvpVagas");

const parametrosUrl = new URLSearchParams(window.location.search);
const tokenConvite = parametrosUrl.get("token") || parametrosUrl.get("t");

const TEXTOS_STATUS = {
    pendente: "AGUARDANDO CONFIRMAÇÃO",
    confirmado: "PRESENÇA CONFIRMADA",
    recusado: "NÃO PODERÁ COMPARECER"
};

let conviteAtual = null;
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

function mensagemDoErro(corpo, fallback) {
    if (corpo && corpo.erro && corpo.erro.mensagem) {
        return corpo.erro.mensagem;
    }

    return fallback;
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
        const texto = TEXTOS_STATUS[statusAtual] || "";
        rsvpGuestStatus.textContent = texto;
        rsvpGuestStatus.hidden = !texto;
        rsvpGuestStatus.className = "rsvp-status-badge";

        if (statusAtual) {
            rsvpGuestStatus.classList.add(statusAtual);
        }
    }

    destacarBotao(statusAtual);
}


/* =========================================================
   FAMILIARES
========================================================= */

function criarBotaoFamiliar(texto, classe, ativo, aoClicar) {
    const botao = document.createElement("button");

    botao.type = "button";
    botao.className = `rsvp-member-btn ${classe}`;
    botao.textContent = texto;
    botao.classList.toggle("is-active", ativo);
    botao.setAttribute("aria-pressed", String(ativo));
    botao.addEventListener("click", aoClicar);

    return botao;
}

function renderizarFamilia() {
    if (!rsvpFamily || !rsvpFamilyList) return;

    const membros = conviteAtual && Array.isArray(conviteAtual.membros)
        ? conviteAtual.membros
        : [];
    const vagas = conviteAtual ? Number(conviteAtual.vagas_disponiveis) : 0;
    const podeMostrar =
        statusAtual === "confirmado" && (membros.length > 0 || vagas > 0);

    rsvpFamily.hidden = !podeMostrar;

    if (!podeMostrar) {
        if (rsvpAddForm) rsvpAddForm.hidden = true;
        return;
    }

    rsvpFamilyList.textContent = "";

    membros.forEach((membro) => {
        const item = document.createElement("li");
        item.className = "rsvp-family-item";
        item.dataset.status = membro.status;

        const nome = document.createElement("span");
        nome.className = "rsvp-family-name";
        nome.textContent = membro.nome;

        const acoes = document.createElement("div");
        acoes.className = "rsvp-family-actions";

        const confirmar = criarBotaoFamiliar(
            "Confirmar",
            "confirmar",
            membro.status === "confirmado",
            () => alterarMembro(membro.id, "confirmado")
        );

        confirmar.setAttribute(
            "aria-label",
            `Confirmar presença de ${membro.nome}`
        );

        const remover = criarBotaoFamiliar(
            "Remover",
            "remover",
            membro.status === "recusado",
            () => alterarMembro(membro.id, "recusado")
        );

        remover.setAttribute(
            "aria-label",
            `Marcar que ${membro.nome} não comparecerá`
        );

        if (enviando) {
            confirmar.disabled = true;
            remover.disabled = true;
        }

        acoes.append(confirmar, remover);
        item.append(nome, acoes);
        rsvpFamilyList.append(item);
    });

    if (rsvpFamilyEmpty) {
        rsvpFamilyEmpty.hidden = membros.length > 0;
    }

    if (rsvpVagas) {
        if (vagas > 0) {
            rsvpVagas.textContent =
                vagas === 1
                    ? "1 vaga disponível no total da festa."
                    : `${vagas} vagas disponíveis no total da festa.`;
        } else {
            rsvpVagas.textContent = "Limite de 100 convidados atingido.";
        }
    }

    if (adicionarConvidadoBtn) {
        adicionarConvidadoBtn.hidden = vagas <= 0;
    }

    if (vagas <= 0 && rsvpAddForm) {
        rsvpAddForm.hidden = true;
    }
}

function aplicarConvite(dados) {
    conviteAtual = dados;

    if (rsvpGuestName) {
        rsvpGuestName.textContent = `Olá, ${dados.responsavel_nome}`;
    }

    atualizarStatusTela(dados.status);
    renderizarFamilia();
}

async function alterarMembro(membroId, status) {
    if (enviando || !conviteCarregado || !tokenConvite) return;

    enviando = true;
    renderizarFamilia();
    limparMensagem();

    try {
        const resposta = await fetch(
            `${API_BASE_URL}/api/convite/${encodeURIComponent(tokenConvite)}/membros/${membroId}`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json"
                },
                body: JSON.stringify({ status })
            }
        );

        const corpo = await resposta.json().catch(() => null);

        if (!resposta.ok) {
            throw new Error(
                mensagemDoErro(
                    corpo,
                    "Não foi possível atualizar este familiar. Tente novamente."
                )
            );
        }

        aplicarConvite(corpo.data);

        const membro = (corpo.data.membros || []).find(
            (item) => item.id === membroId
        );

        if (membro) {
            mostrarMensagem(
                status === "confirmado"
                    ? `Presença de ${membro.nome} confirmada.`
                    : `${membro.nome} não comparecerá.`,
                status === "confirmado" ? "success" : "info"
            );
        }
    } catch (erro) {
        console.error("[RSVP] Falha ao atualizar familiar:", erro);
        renderizarFamilia();

        mostrarMensagem(
            erro.message ||
                "Não foi possível atualizar este familiar. Tente novamente.",
            "error"
        );
    } finally {
        enviando = false;
        renderizarFamilia();
    }
}


/* =========================================================
   CONVIDADO EXTRA
========================================================= */

async function adicionarConvidado(evento) {
    evento.preventDefault();

    if (enviando || !conviteCarregado || !tokenConvite) return;

    const nome = novoConvidadoNome ? novoConvidadoNome.value.trim() : "";

    if (!nome) {
        mostrarMensagem(
            "Informe o nome do convidado que deseja adicionar.",
            "error"
        );

        if (novoConvidadoNome) novoConvidadoNome.focus();
        return;
    }

    enviando = true;

    if (salvarConvidadoBtn) salvarConvidadoBtn.disabled = true;

    limparMensagem();

    try {
        const resposta = await fetch(
            `${API_BASE_URL}/api/convite/${encodeURIComponent(tokenConvite)}/membros`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json"
                },
                body: JSON.stringify({ nome })
            }
        );

        const corpo = await resposta.json().catch(() => null);

        if (!resposta.ok) {
            throw new Error(
                mensagemDoErro(
                    corpo,
                    "Não foi possível adicionar o convidado. Tente novamente."
                )
            );
        }

        if (conviteAtual) {
            conviteAtual.membros = [...(conviteAtual.membros || []), corpo.data];
            conviteAtual.vagas_disponiveis = Math.max(
                0,
                Number(conviteAtual.vagas_disponiveis || 0) - 1
            );
        }

        renderizarFamilia();

        if (novoConvidadoNome) {
            novoConvidadoNome.value = "";
        }

        if (rsvpAddForm) {
            rsvpAddForm.hidden = true;
        }

        mostrarMensagem(
            `${corpo.data.nome} foi adicionado(a) ao convite.`,
            "success"
        );
    } catch (erro) {
        console.error("[RSVP] Falha ao adicionar convidado:", erro);

        mostrarMensagem(
            erro.message ||
                "Não foi possível adicionar o convidado. Tente novamente.",
            "error"
        );
    } finally {
        enviando = false;

        if (salvarConvidadoBtn) salvarConvidadoBtn.disabled = false;

        renderizarFamilia();
    }
}


/* =========================================================
   CARREGAMENTO DO CONVITE
========================================================= */

async function carregarConvite() {
    habilitarBotoes(false);

    if (!tokenConvite) {
        if (rsvpGuestName) rsvpGuestName.textContent = "";
        if (rsvpGuestStatus) rsvpGuestStatus.hidden = true;

        mostrarMensagem(
            "Acesse este convite através do link individual enviado para você.",
            "error"
        );

        return;
    }

    if (rsvpGuestName) rsvpGuestName.textContent = "";
    if (rsvpGuestStatus) {
        rsvpGuestStatus.textContent = "";
        rsvpGuestStatus.hidden = true;
    }

    limparMensagem();

    try {
        const resposta = await fetch(
            `${API_BASE_URL}/api/convite/${encodeURIComponent(tokenConvite)}`,
            { headers: { Accept: "application/json" } }
        );

        if (resposta.status === 404) {
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

        aplicarConvite(corpo.data);

        conviteCarregado = true;
        habilitarBotoes(true);

        if (corpo.data.status === "recusado") {
            mostrarMensagem(
                "A ausência da sua família foi registrada. Se mudarem de ideia, basta voltar por este mesmo link.",
                "info"
            );
        }
    } catch (erro) {
        console.error("[RSVP] Falha ao carregar o convite:", erro);

        if (rsvpGuestName) rsvpGuestName.textContent = "";
        if (rsvpGuestStatus) rsvpGuestStatus.hidden = true;

        mostrarMensagem(
            "Não foi possível carregar seu convite. Verifique sua conexão e tente novamente.",
            "error"
        );
    }
}


/* =========================================================
   ENVIO DA RESPOSTA DO CONVITE
========================================================= */

async function enviarResposta(status) {
    if (enviando || !conviteCarregado || !tokenConvite) {
        return;
    }

    enviando = true;

    habilitarBotoes(false);

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
            throw new Error(
                mensagemDoErro(
                    corpo,
                    "Não foi possível registrar sua resposta. Tente novamente."
                )
            );
        }

        aplicarConvite(corpo.data);

        if (status === "confirmado") {
            mostrarMensagem(
                "Presença confirmada com sucesso! Escolha abaixo quem da sua família estará presente. Caso precise alterar depois, basta usar este mesmo link.",
                "success"
            );
        } else {
            mostrarMensagem(
                "A ausência da sua família foi registrada. Sentiremos sua falta! Se mudarem de ideia, vocês podem confirmar por este mesmo link.",
                "info"
            );
        }
    } catch (erro) {
        console.error("[RSVP] Falha ao enviar a resposta:", erro);

        atualizarStatusTela(statusAtual);
        renderizarFamilia();

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

        renderizarFamilia();
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

if (adicionarConvidadoBtn) {
    adicionarConvidadoBtn.addEventListener("click", () => {
        if (!rsvpAddForm) return;

        rsvpAddForm.hidden = false;

        if (novoConvidadoNome) {
            novoConvidadoNome.focus();
        }
    });
}

if (rsvpAddForm) {
    rsvpAddForm.addEventListener("submit", adicionarConvidado);
}

carregarConvite();
