/* =========================================================
   CECÍLIA — 15 ANOS
   SPLASH SCREEN
   JAVASCRIPT
========================================================= */


/* =========================================================
   ELEMENTOS
========================================================= */

const splash = document.getElementById("splash");
const enterButton = document.getElementById("enterButton");


/* =========================================================
   ENTRAR NO CONVITE
========================================================= */

function enterInvitation() {

    if (!splash || !enterButton) {
        return;
    }


    /* Evita múltiplos cliques */

    enterButton.disabled = true;


    /* Inicia a saída do Splash */

    splash.classList.add("leaving");


    /*
        Aguarda a animação antes de trocar de página.

        O CSS utiliza aproximadamente 1.7s
        para a saída principal.
    */

    setTimeout(() => {

        window.location.href = "convite.html" + window.location.search;

    }, 1700);

}


/* =========================================================
   EVENTO DO BOTÃO
========================================================= */

if (enterButton) {

    enterButton.addEventListener(
        "click",
        enterInvitation
    );

}