/* =========================================================
   CECÍLIA — 15 ANOS
   JAVASCRIPT DO CONVITE
========================================================= */

/* =========================================================
   RSVP
   ENDPOINT DO GOOGLE APPS SCRIPT
========================================================= */

const RSVP_ENDPOINT = "https://script.google.com/macros/s/AKfycbzBvDllNUVRSKBHnb6QHtUuyg_vswllZMvEuvBapHscYgXUQKB8Ri-PP5mfTiWEt3RnZA/exec";

function normalizarTelefone(telefone) {
    if (!telefone) return "";
    return String(telefone).replace(/[^0-9]/g, "");
}

async function verificarTelefone(telefone) {
    const telefoneNormalizado = normalizarTelefone(telefone);

    if (!telefoneNormalizado) {
        return { ok: false, cadastrado: false, mensagem: "Telefone inválido." };
    }

    if (!RSVP_ENDPOINT) {
        return { ok: false, cadastrado: false, erro: "Endpoint não configurado." };
    }

    try {
        const url = new URL(RSVP_ENDPOINT);
        url.searchParams.append("acao", "verificar");
        url.searchParams.append("telefone", telefoneNormalizado);

        const resposta = await fetch(url.toString(), {
            method: "GET",
            cache: "no-store"
        });

        if (!resposta.ok) {
            throw new Error("Resposta HTTP inválida");
        }

        const resultado = await resposta.json();
        return resultado;
    } catch (erro) {
        console.error("[RSVP] Falha ao verificar telefone:", erro);
        return { ok: false, cadastrado: false, erro: "Não foi possível verificar o telefone." };
    }
}

async function enviarRSVP(dados) {
    if (!RSVP_ENDPOINT) {
        console.error("[RSVP] Endpoint não configurado.");
        return {
            ok: false,
            erro: "Endpoint não configurado."
        };
    }

    try {
        const resposta = await fetch(RSVP_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify({
                acao: "enviar",
                nome: dados.nome,
                telefone: dados.telefone,
                vai: dados.vai,
                acompanhantes: dados.acompanhantes || [],
                enviadoEm: new Date().toISOString()
            })
        });

        if (!resposta.ok) {
            throw new Error("Resposta HTTP inválida");
        }

        const resultado = await resposta.json();
        return resultado;
    } catch (erro) {
        console.error("[RSVP] Falha ao enviar:", erro);
        return {
            ok: false,
            erro: "Não foi possível comunicar com o servidor."
        };
    }
}

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
   RSVP
========================================================= */

const rsvpForm = document.getElementById("rsvpForm");
const rsvpTelefone = document.getElementById("rsvpTelefone");
const rsvpVai = document.getElementById("rsvpVai");
const rsvpAcomp = document.getElementById("rsvpAcomp");
const acompanhantesContainer = document.getElementById("acompanhantesContainer");
const rsvpMessage = document.getElementById("rsvpMessage");

let telefoneBloqueado = false;
let envioEmAndamento = false;

function bloquearFormularioSemMensagem() {
    telefoneBloqueado = true;

    if (rsvpForm) {
        const inputs = rsvpForm.querySelectorAll("input, select, button");
        inputs.forEach((el) => {
            el.disabled = true;
        });
    }

    if (acompanhantesContainer) {
        acompanhantesContainer.innerHTML = "";
    }
}

function bloquearFormularioPorDuplicidade() {
    telefoneBloqueado = true;

    if (rsvpForm) {
        const inputs = rsvpForm.querySelectorAll("input, select, button");
        inputs.forEach((el) => {
            el.disabled = true;
        });
    }

    if (acompanhantesContainer) {
        acompanhantesContainer.innerHTML = "";
    }

    mostrarMensagem(
        "CONFIRMAÇÃO JÁ REALIZADA\n\nEste número de celular já foi utilizado para confirmar presença. Não é possível realizar uma nova confirmação.",
        "error"
    );
}

async function verificarEBloquearSeNecessario() {
    if (!rsvpTelefone) return;

    const telefone = rsvpTelefone.value.trim();
    const telefoneNormalizado = normalizarTelefone(telefone);

    if (!telefoneNormalizado || telefoneNormalizado.length < 8) {
        return;
    }

        const resultado = await verificarTelefone(telefone);

        if (resultado && (resultado.cadastrado === true || resultado.duplicado === true)) {
            bloquearFormularioPorDuplicidade();
            return;
        }
}

/* =========================================================
   ACOMPANHANTES
   MÁXIMO: 5
========================================================= */

if (rsvpAcomp) {
    rsvpAcomp.addEventListener("change", function () {
        if (!acompanhantesContainer) return;

        acompanhantesContainer.innerHTML = "";

        const quantidade = Math.min(
            Math.max(Number(this.value) || 0, 0),
            5
        );

        for (let i = 1; i <= quantidade; i++) {
            const input = document.createElement("input");

            input.type = "text";
            input.name = `acompanhante_${i}`;
            input.placeholder = `Nome completo do acompanhante ${i}`;
            input.className = "acompanhante-input";
            input.required = true;

            acompanhantesContainer.appendChild(input);
        }
    });
}

/* =========================================================
   MOSTRAR / OCULTAR ACOMPANHANTES
========================================================= */

if (rsvpVai) {
    rsvpVai.addEventListener("change", function () {
        if (this.value === "nao") {
            if (rsvpAcomp) {
                rsvpAcomp.value = "0";
                rsvpAcomp.disabled = true;
            }
            if (acompanhantesContainer) {
                acompanhantesContainer.innerHTML = "";
            }
        } else {
            if (rsvpAcomp) {
                rsvpAcomp.disabled = false;
            }
        }
    });
}

if (rsvpTelefone) {
    rsvpTelefone.addEventListener("blur", verificarEBloquearSeNecessario);
    rsvpTelefone.addEventListener("input", function() {
        telefoneBloqueado = false;
        if (rsvpMessage) {
            rsvpMessage.hidden = true;
        }
    });
}

/* =========================================================
   ENVIO DO RSVP
========================================================= */

if (rsvpForm) {
    rsvpForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (telefoneBloqueado) {
            bloquearFormularioPorDuplicidade();
            return;
        }

        if (envioEmAndamento) {
            return;
        }

        const nomeInput = document.getElementById("rsvpNome");
        const nome = nomeInput ? nomeInput.value.trim() : "";
        const telefone = rsvpTelefone ? rsvpTelefone.value.trim() : "";
        const vai = rsvpVai ? rsvpVai.value : "";

        /* =========================
           VALIDAR NOME
        ========================== */

        if (!nome) {
            mostrarMensagem(
                "Por favor, informe seu nome.",
                "error"
            );
            return;
        }

        /* =========================
           VALIDAR TELEFONE
        ========================== */

        if (!telefone) {
            mostrarMensagem(
                "Por favor, informe seu telefone.",
                "error"
            );
            return;
        }

        const telefoneNormalizado = normalizarTelefone(telefone);
        if (!telefoneNormalizado || telefoneNormalizado.length < 8) {
            mostrarMensagem(
                "Por favor, informe um telefone válido.",
                "error"
            );
            return;
        }

        /* =========================
           VALIDAR PRESENÇA
        ========================== */

        if (!vai) {
            mostrarMensagem(
                "Por favor, informe se você irá comparecer.",
                "error"
            );
            return;
        }

        /* =========================
           VALIDAR ACOMPANHANTES
        ========================== */

        const quantidade = vai === "sim" ? (Number(rsvpAcomp ? rsvpAcomp.value : 0) || 0) : 0;
        const acompanhantes = [];

        if (quantidade > 0 && acompanhantesContainer) {
            const campos = acompanhantesContainer.querySelectorAll(".acompanhante-input");

            for (const campo of campos) {
                if (!campo.value.trim()) {
                    mostrarMensagem(
                        "Informe o nome de todos os acompanhantes.",
                        "error"
                    );
                    campo.focus();
                    return;
                }
                acompanhantes.push(campo.value.trim());
            }
        }

        /* =========================
           VERIFICAÇÃO ANTES DO ENVIO
        ========================== */

        envioEmAndamento = true;

        const verificacao = await verificarTelefone(telefone);
        if (verificacao && (verificacao.cadastrado === true || verificacao.duplicado === true)) {
            envioEmAndamento = false;
            bloquearFormularioPorDuplicidade();
            return;
        }

        if (!verificacao || verificacao.ok === false) {
            envioEmAndamento = false;
            mostrarMensagem(
                "Não foi possível validar o telefone. Tente novamente.",
                "error"
            );
            return;
        }

        /* =========================
           ENVIO
        ========================== */

        const botao = rsvpForm.querySelector('button[type="submit"]');
        if (!botao) {
            envioEmAndamento = false;
            return;
        }

        const textoOriginal = botao.textContent;

        botao.disabled = true;
        botao.textContent = "Enviando...";
        if (rsvpMessage) rsvpMessage.hidden = true;

        const resultado = await enviarRSVP({
            nome,
            telefone,
            vai,
            acompanhantes
        });

        botao.disabled = false;
        botao.textContent = textoOriginal;
        envioEmAndamento = false;
        if (!resultado.ok) {
            if (resultado.codigo === "TELEFONE_DUPLICADO" || resultado.erro === "TELEFONE_DUPLICADO") {
                bloquearFormularioPorDuplicidade();
                return;
            }
            if (resultado.codigo === "LIMITE_100_PESSOAS" || resultado.erro === "LIMITE_100_PESSOAS") {
                mostrarMensagem(
                    "Limite de confirmações atingido.",
                    "error"
                );
                return;
            }
            if (resultado.codigo === "DADOS_INVALIDOS") {
                mostrarMensagem("Dados inválidos. Verifique as informações.", "error");
                return;
            }

            mostrarMensagem(
                "Não foi possível enviar sua confirmação. Tente novamente.",
                "error"
            );

            return;
        }
        /* =========================
           CONFIRMAÇÃO
        ========================== */

        mostrarMensagem(
            vai === "nao"
                ? `Obrigado, ${nome}. Sua resposta foi registrada.`
                : `Obrigado, ${nome}! Sua presença foi confirmada. 💙`,
            "success"
        );


        /* =========================
           BLOQUEAR APÓS CONFIRMAÇÃO
        ========================== */

        bloquearFormularioSemMensagem();
    });
}

/* =========================================================
   MENSAGEM
========================================================= */

function mostrarMensagem(texto, tipo) {
    if (!rsvpMessage) return;

    rsvpMessage.hidden = false;
    rsvpMessage.textContent = texto;
    rsvpMessage.className = `rsvp-message ${tipo}`;
}
