/* =========================================================
   CECÍLIA — 15 ANOS
   JAVASCRIPT DO CONVITE
========================================================= */


/* =========================================================
   CONTADOR REGRESSIVO
========================================================= */

const dataEvento = new Date("2026-12-20T20:00:00").getTime();

function atualizarContador() {

    const agora = new Date().getTime();

    const diferenca = dataEvento - agora;

    const dias = Math.floor(
        diferenca / (1000 * 60 * 60 * 24)
    );

    const horas = Math.floor(
        (diferenca % (1000 * 60 * 60 * 24)) /
        (1000 * 60 * 60)
    );

    const minutos = Math.floor(
        (diferenca % (1000 * 60 * 60)) /
        (1000 * 60)
    );

    const segundos = Math.floor(
        (diferenca % (1000 * 60)) /
        1000
    );


    document.getElementById("days").textContent =
        String(Math.max(dias, 0)).padStart(2, "0");

    document.getElementById("hours").textContent =
        String(Math.max(horas, 0)).padStart(2, "0");

    document.getElementById("minutes").textContent =
        String(Math.max(minutos, 0)).padStart(2, "0");

    document.getElementById("seconds").textContent =
        String(Math.max(segundos, 0)).padStart(2, "0");

}


atualizarContador();

setInterval(atualizarContador, 1000);



/* =========================================================
   RSVP
========================================================= */

const rsvpForm = document.getElementById("rsvpForm");

const rsvpVai = document.getElementById("rsvpVai");

const rsvpAcomp = document.getElementById("rsvpAcomp");

const acompanhantesContainer =
    document.getElementById("acompanhantesContainer");

const rsvpMessage =
    document.getElementById("rsvpMessage");


/* =========================================================
   ACOMPANHANTES
   MÁXIMO: 5
========================================================= */

rsvpAcomp.addEventListener("change", function () {

    acompanhantesContainer.innerHTML = "";

    const quantidade = Math.min(
        Math.max(Number(this.value) || 0, 0),
        5
    );


    for (let i = 1; i <= quantidade; i++) {

        const input = document.createElement("input");

        input.type = "text";

        input.name = `acompanhante_${i}`;

        input.placeholder =
            `Nome completo do acompanhante ${i}`;

        input.className =
            "acompanhante-input";

        input.required = true;

        acompanhantesContainer.appendChild(input);

    }

});



/* =========================================================
   MOSTRAR / OCULTAR ACOMPANHANTES
========================================================= */

rsvpVai.addEventListener("change", function () {

    if (this.value === "nao") {

        rsvpAcomp.value = "0";

        rsvpAcomp.disabled = true;

        acompanhantesContainer.innerHTML = "";

    } else {

        rsvpAcomp.disabled = false;

    }

});



/* =========================================================
   ENVIO DO RSVP
========================================================= */

rsvpForm.addEventListener("submit", function (event) {

    event.preventDefault();


    const nome =
        document.getElementById("rsvpNome").value.trim();

    const vai =
        rsvpVai.value;


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
       NÃO VAI
    ========================== */

    if (vai === "nao") {

        mostrarMensagem(
            `Obrigado, ${nome}. Sua resposta foi registrada.`,
            "success"
        );

        return;

    }


    /* =========================
       VALIDAR ACOMPANHANTES
    ========================== */

    const quantidade =
        Number(rsvpAcomp.value) || 0;


    if (quantidade > 0) {

        const acompanhantes =
            acompanhantesContainer.querySelectorAll(
                ".acompanhante-input"
            );


        for (const acompanhante of acompanhantes) {

            if (!acompanhante.value.trim()) {

                mostrarMensagem(
                    "Informe o nome de todos os acompanhantes.",
                    "error"
                );

                acompanhante.focus();

                return;

            }

        }

    }


    /* =========================
       CONFIRMAÇÃO
    ========================== */

    mostrarMensagem(
        `Obrigado, ${nome}! Sua presença foi confirmada. 💙`,
        "success"
    );


    /* =========================
       LIMPAR FORMULÁRIO
    ========================== */

    rsvpForm.reset();

    acompanhantesContainer.innerHTML = "";

    rsvpAcomp.disabled = false;

});



/* =========================================================
   MENSAGEM
========================================================= */

function mostrarMensagem(texto, tipo) {

    rsvpMessage.hidden = false;

    rsvpMessage.textContent = texto;

    rsvpMessage.className =
        `rsvp-message ${tipo}`;

}