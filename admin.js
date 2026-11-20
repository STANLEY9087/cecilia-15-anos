/* =========================================================
   CECÍLIA — 15 ANOS
   PAINEL ADMINISTRATIVO
========================================================= */

const API_BASE_URL =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
        ? "http://localhost:3000"
        : "https://cecilia-15-api.onrender.com";

const CHAVE_SESSAO = "ceciliaAdminSenha";

const STATUS_TEXTO = {
    confirmado: "Confirmado",
    pendente: "Pendente",
    recusado: "Recusado"
};


/* =========================================================
   ELEMENTOS
========================================================= */

const loginView = document.getElementById("loginView");
const adminView = document.getElementById("adminView");
const loginForm = document.getElementById("loginForm");
const adminPassword = document.getElementById("adminPassword");
const loginButton = document.getElementById("loginButton");
const loginError = document.getElementById("loginError");

const adminSubtitle = document.getElementById("adminSubtitle");
const adminAlert = document.getElementById("adminAlert");
const logoutButton = document.getElementById("logoutButton");
const downloadCsv = document.getElementById("downloadCsv");

const resumoConfirmadas = document.getElementById("resumoConfirmadas");
const resumoPendentes = document.getElementById("resumoPendentes");
const resumoRecusadas = document.getElementById("resumoRecusadas");
const resumoVagas = document.getElementById("resumoVagas");

const buscaConvites = document.getElementById("buscaConvites");
const filtros = document.getElementById("filtros");
const convitesList = document.getElementById("convitesList");
const resultCount = document.getElementById("resultCount");
const emptyState = document.getElementById("emptyState");

const newInviteForm = document.getElementById("newInviteForm");
const newInviteButton = document.getElementById("newInviteButton");
const novoTitulo = document.getElementById("novoTitulo");
const novoResponsavel = document.getElementById("novoResponsavel");
const novosMembros = document.getElementById("novosMembros");


/* =========================================================
   ESTADO
========================================================= */

let senhaAdmin = "";
let dadosPainel = { resumo: {}, convites: [] };
let filtroStatus = "";
let termoBusca = "";
let enviandoFormulario = false;


/* =========================================================
   UTILITÁRIOS
========================================================= */

function normalizarTexto(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function mensagemDoErro(corpo, fallback) {
    if (corpo && corpo.erro && corpo.erro.mensagem) {
        return corpo.erro.mensagem;
    }

    return fallback;
}

function mostrarAlerta(texto, tipo = "") {
    if (!adminAlert) return;

    adminAlert.textContent = texto;
    adminAlert.className = `admin-alert ${tipo}`.trim();
    adminAlert.hidden = false;
}

function limparAlerta() {
    if (!adminAlert) return;

    adminAlert.textContent = "";
    adminAlert.className = "admin-alert";
    adminAlert.hidden = true;
}

function mostrarErroLogin(texto) {
    if (!loginError) return;

    loginError.textContent = texto;
    loginError.hidden = false;
}

function limparErroLogin() {
    if (!loginError) return;

    loginError.textContent = "";
    loginError.hidden = true;
}

function classeStatus(status) {
    return STATUS_TEXTO[status] ? status : "pendente";
}


/* =========================================================
   API
========================================================= */

async function requisicaoAdmin(caminho, opcoes = {}, senha = senhaAdmin) {
    const cabecalhos = {
        Accept: "application/json",
        Authorization: `Bearer ${senha}`,
        ...(opcoes.headers || {})
    };

    if (opcoes.body) {
        cabecalhos["Content-Type"] = "application/json";
    }

    const resposta = await fetch(`${API_BASE_URL}${caminho}`, {
        ...opcoes,
        headers: cabecalhos
    });

    const corpo = await resposta.json().catch(() => null);

    if (!resposta.ok) {
        const erro = new Error(
            mensagemDoErro(
                corpo,
                resposta.status === 401
                    ? "Senha administrativa inválida."
                    : "Não foi possível concluir a operação."
            )
        );

        erro.status = resposta.status;
        erro.codigo =
            (corpo && corpo.erro && corpo.erro.codigo) ||
            (resposta.status === 401 ? "NAO_AUTORIZADO" : "ERRO");

        throw erro;
    }

    return corpo && corpo.data ? corpo.data : corpo;
}

async function buscarDadosAdmin(senha = senhaAdmin) {
    return requisicaoAdmin("/api/admin/convites", {}, senha);
}


/* =========================================================
   SESSÃO
========================================================= */

function guardarSenha(senha) {
    senhaAdmin = senha;

    try {
        sessionStorage.setItem(CHAVE_SESSAO, senha);
    } catch (erro) {
        console.warn("[admin] Não foi possível usar sessionStorage:", erro);
    }
}

function apagarSenha() {
    senhaAdmin = "";

    try {
        sessionStorage.removeItem(CHAVE_SESSAO);
    } catch (erro) {
        console.warn("[admin] Não foi possível limpar sessionStorage:", erro);
    }
}

function mostrarLogin() {
    if (adminView) adminView.hidden = true;
    if (loginView) loginView.hidden = false;

    limparAlerta();

    if (adminPassword) {
        adminPassword.value = "";
        adminPassword.focus();
    }
}

function mostrarPainel() {
    if (loginView) loginView.hidden = true;
    if (adminView) adminView.hidden = false;
}

function deslogar(mensagem) {
    apagarSenha();
    dadosPainel = { resumo: {}, convites: [] };
    mostrarLogin();

    if (mensagem) {
        mostrarErroLogin(mensagem);
    }
}


/* =========================================================
   RESUMO
========================================================= */

function atualizarResumo(resumo = {}) {
    if (resumoConfirmadas) {
        resumoConfirmadas.textContent = Number(
            resumo.pessoas_confirmadas || 0
        );
    }

    if (resumoPendentes) {
        resumoPendentes.textContent = Number(
            resumo.pessoas_pendentes || 0
        );
    }

    if (resumoRecusadas) {
        resumoRecusadas.textContent = Number(
            resumo.pessoas_recusadas || 0
        );
    }

    if (resumoVagas) {
        resumoVagas.textContent = Number(resumo.vagas_disponiveis || 0);
    }

    if (adminSubtitle) {
        const totalConvites = Number(resumo.total_convites || 0);
        const totalPessoas = Number(resumo.total_pessoas || 0);

        adminSubtitle.textContent =
            `${totalConvites} convite(s) · ${totalPessoas} pessoa(s) cadastrada(s)`;
    }
}


/* =========================================================
   LISTA DE CONVITES
========================================================= */

function criarBadge(classe, texto) {
    const badge = document.createElement("span");

    badge.className = classe;
    badge.textContent = texto;

    return badge;
}

function criarLinhaMembro(membro) {
    const item = document.createElement("li");

    item.className = "member-row";
    item.dataset.status = classeStatus(membro.status);

    const nome = document.createElement("span");
    nome.className = "member-name";
    nome.textContent = membro.nome;

    const tags = document.createElement("span");
    tags.className = "member-tags";

    if (membro.eh_responsavel) {
        tags.append(criarBadge("type-badge", "Responsável"));
    } else if (membro.eh_extra) {
        tags.append(criarBadge("extra-badge", "EXTRA"));
    } else {
        tags.append(criarBadge("type-badge", "Familiar"));
    }

    tags.append(
        criarBadge(
            `member-status ${classeStatus(membro.status)}`,
            STATUS_TEXTO[membro.status] || membro.status
        )
    );

    item.append(nome, tags);

    return item;
}

function criarCardConvite(convite) {
    const membros = Array.isArray(convite.membros) ? convite.membros : [];
    const confirmados = membros.filter(
        (membro) => membro.status === "confirmado"
    ).length;
    const extras = membros.filter((membro) => membro.eh_extra).length;

    const card = document.createElement("article");
    card.className = `invite-card status-${classeStatus(convite.status)}`;

    /* Cabeçalho */

    const topo = document.createElement("div");
    topo.className = "invite-top";

    const blocoTitulo = document.createElement("div");

    const titulo = document.createElement("h3");
    titulo.textContent = convite.titulo;

    const responsavel = document.createElement("p");
    responsavel.className = "invite-responsible";
    responsavel.textContent = `Responsável: ${convite.responsavel_nome}`;

    blocoTitulo.append(titulo, responsavel);

    const badgeStatus = criarBadge(
        `status-badge ${classeStatus(convite.status)}`,
        STATUS_TEXTO[convite.status] || convite.status
    );

    topo.append(blocoTitulo, badgeStatus);

    /* Metadados */

    const meta = document.createElement("div");
    meta.className = "invite-meta";

    const contagem = document.createElement("span");
    contagem.className = "confirm-count";
    contagem.textContent = `${confirmados}/${membros.length} confirmados`;

    meta.append(contagem);

    if (extras > 0) {
        const separador = document.createElement("span");
        separador.className = "meta-separator";

        const notaExtras = document.createElement("span");
        notaExtras.className = "meta-note";
        notaExtras.textContent =
            extras === 1 ? "1 convidado extra" : `${extras} convidados extras`;

        meta.append(separador, notaExtras);
    }

    const botaoCopiar = document.createElement("button");
    botaoCopiar.type = "button";
    botaoCopiar.className = "copy-link-btn";
    botaoCopiar.textContent = "Copiar Link";
    botaoCopiar.title = "Copiar link para enviar no WhatsApp";
    botaoCopiar.setAttribute(
        "aria-label",
        `Copiar link do convite ${convite.titulo}`
    );

    botaoCopiar.addEventListener("click", () => {
        copiarLink(convite.link, botaoCopiar);
    });

    meta.append(botaoCopiar);

    /* Membros */

    const lista = document.createElement("ul");
    lista.className = "member-list";

    membros.forEach((membro) => {
        lista.append(criarLinhaMembro(membro));
    });

    card.append(topo, meta, lista);

    return card;
}

function renderizarConvites() {
    if (!convitesList) return;

    const termo = normalizarTexto(termoBusca);

    const filtrados = (dadosPainel.convites || []).filter((convite) => {
        const statusOk = !filtroStatus || convite.status === filtroStatus;

        if (!statusOk) {
            return false;
        }

        if (!termo) {
            return true;
        }

        const membros = Array.isArray(convite.membros)
            ? convite.membros
            : [];

        return [
            convite.titulo,
            convite.responsavel_nome,
            ...membros.map((membro) => membro.nome)
        ].some((texto) => normalizarTexto(texto).includes(termo));
    });

    convitesList.textContent = "";

    const fragmento = document.createDocumentFragment();

    filtrados.forEach((convite) => {
        fragmento.append(criarCardConvite(convite));
    });

    convitesList.append(fragmento);

    if (resultCount) {
        resultCount.textContent =
            filtrados.length === 1
                ? "1 convite"
                : `${filtrados.length} convites`;
    }

    if (emptyState) {
        emptyState.hidden = filtrados.length > 0;
    }
}

function aplicarDados(dados) {
    dadosPainel = {
        resumo: (dados && dados.resumo) || {},
        convites: Array.isArray(dados && dados.convites)
            ? dados.convites
            : []
    };

    atualizarResumo(dadosPainel.resumo);
    renderizarConvites();
}


/* =========================================================
   COPIAR LINK
========================================================= */

async function copiarTexto(texto) {
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(texto);
        return;
    }

    const area = document.createElement("textarea");

    area.value = texto;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";

    document.body.append(area);
    area.select();

    const copiado = document.execCommand("copy");

    area.remove();

    if (!copiado) {
        throw new Error("O navegador não permitiu copiar o link.");
    }
}

async function copiarLink(link, botao) {
    const textoOriginal = botao.textContent;

    try {
        await copiarTexto(link);

        botao.textContent = "Copiado!";
        botao.classList.add("is-copied");

        setTimeout(() => {
            botao.textContent = textoOriginal;
            botao.classList.remove("is-copied");
        }, 1800);

        mostrarAlerta(
            "Link copiado! Agora é só colar no WhatsApp.",
            "success"
        );
    } catch (erro) {
        console.error("[admin] Falha ao copiar link:", erro);

        mostrarAlerta(
            `Não foi possível copiar automaticamente. Link: ${link}`,
            "error"
        );
    }
}


/* =========================================================
   EXPORTAR CSV
========================================================= */

function campoCsv(valor) {
    const texto = String(valor === undefined || valor === null ? "" : valor);

    if (/[";\r\n]/.test(texto)) {
        return `"${texto.replace(/"/g, '""')}"`;
    }

    return texto;
}

function baixarPlanilha() {
    const convites = dadosPainel.convites || [];

    if (convites.length === 0) {
        mostrarAlerta(
            "Não há convidados para exportar no momento.",
            "error"
        );

        return;
    }

    const linhas = ["familia;nome;tipo;status;link"];

    convites.forEach((convite) => {
        (convite.membros || []).forEach((membro) => {
            const tipo = membro.eh_responsavel
                ? "responsável"
                : membro.eh_extra
                    ? "extra"
                    : "familiar";

            linhas.push(
                [
                    convite.titulo,
                    membro.nome,
                    tipo,
                    STATUS_TEXTO[membro.status] || membro.status,
                    convite.link
                ]
                    .map(campoCsv)
                    .join(";")
            );
        });
    });

    const conteudo = "\uFEFF" + linhas.join("\r\n") + "\r\n";

    const blob = new Blob([conteudo], {
        type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "convidados-cecilia-15-anos.csv";

    document.body.append(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    mostrarAlerta(
        `Planilha gerada com ${linhas.length - 1} pessoa(s).`,
        "success"
    );
}


/* =========================================================
   FLUXO DO PAINEL
========================================================= */

async function carregarPainel() {
    if (adminSubtitle) {
        adminSubtitle.textContent = "Carregando convites...";
    }

    limparAlerta();

    try {
        const dados = await buscarDadosAdmin();
        aplicarDados(dados);
    } catch (erro) {
        console.error("[admin] Falha ao carregar painel:", erro);

        if (erro.codigo === "NAO_AUTORIZADO") {
            deslogar("Sua sessão expirou. Informe a senha novamente.");
            return;
        }

        mostrarAlerta(
            erro.message ||
                "Não foi possível carregar os dados do painel.",
            "error"
        );
    }
}

async function entrar(evento) {
    evento.preventDefault();

    const senha = adminPassword ? adminPassword.value : "";

    if (!senha) {
        mostrarErroLogin("Informe a senha administrativa.");
        return;
    }

    limparErroLogin();

    if (loginButton) {
        loginButton.disabled = true;
        loginButton.textContent = "Entrando...";
    }

    try {
        const dados = await buscarDadosAdmin(senha);

        guardarSenha(senha);
        aplicarDados(dados);
        mostrarPainel();
        limparAlerta();

        if (adminPassword) {
            adminPassword.value = "";
        }
    } catch (erro) {
        console.error("[admin] Falha no login:", erro);

        if (erro.status === 503) {
            mostrarErroLogin(
                "O painel ainda não foi configurado no servidor (ADMIN_PASSWORD)."
            );
        } else if (erro.status === 401) {
            mostrarErroLogin("Senha incorreta. Tente novamente.");
        } else {
            mostrarErroLogin(
                erro.message || "Não foi possível entrar no painel."
            );
        }
    } finally {
        if (loginButton) {
            loginButton.disabled = false;
            loginButton.textContent = "Entrar";
        }
    }
}

async function criarConvite(evento) {
    evento.preventDefault();

    if (enviandoFormulario) return;

    const titulo = novoTitulo ? novoTitulo.value.trim() : "";
    const responsavel = novoResponsavel
        ? novoResponsavel.value.trim()
        : "";

    const membros = novosMembros
        ? novosMembros.value
              .split(/\r?\n/)
              .map((nome) => nome.trim())
              .filter(Boolean)
        : [];

    if (!titulo || !responsavel) {
        mostrarAlerta(
            "Preencha o título do convite e o nome do responsável.",
            "error"
        );
        return;
    }

    enviandoFormulario = true;

    if (newInviteButton) {
        newInviteButton.disabled = true;
        newInviteButton.textContent = "Criando...";
    }

    limparAlerta();

    try {
        const convite = await requisicaoAdmin("/api/admin/convites", {
            method: "POST",
            body: JSON.stringify({
                titulo,
                responsavel_nome: responsavel,
                membros
            })
        });

        if (newInviteForm) {
            newInviteForm.reset();
        }

        const dados = await buscarDadosAdmin();
        aplicarDados(dados);

        mostrarAlerta(
            `Convite "${convite.titulo}" criado com sucesso. Link: ${convite.link}`,
            "success"
        );
    } catch (erro) {
        console.error("[admin] Falha ao criar convite:", erro);

        if (erro.codigo === "NAO_AUTORIZADO") {
            deslogar("Sua sessão expirou. Informe a senha novamente.");
            return;
        }

        mostrarAlerta(
            erro.message || "Não foi possível criar o convite.",
            "error"
        );
    } finally {
        enviandoFormulario = false;

        if (newInviteButton) {
            newInviteButton.disabled = false;
            newInviteButton.textContent = "Criar convite";
        }
    }
}


/* =========================================================
   EVENTOS
========================================================= */

if (loginForm) {
    loginForm.addEventListener("submit", entrar);
}

if (logoutButton) {
    logoutButton.addEventListener("click", () => {
        deslogar();
        limparErroLogin();
    });
}

if (downloadCsv) {
    downloadCsv.addEventListener("click", baixarPlanilha);
}

if (buscaConvites) {
    buscaConvites.addEventListener("input", () => {
        termoBusca = buscaConvites.value;
        renderizarConvites();
    });
}

if (filtros) {
    filtros.querySelectorAll(".filter-btn").forEach((botao) => {
        botao.addEventListener("click", () => {
            filtroStatus = botao.dataset.status || "";

            filtros.querySelectorAll(".filter-btn").forEach((item) => {
                const ativo = item === botao;

                item.classList.toggle("is-active", ativo);
                item.setAttribute("aria-pressed", String(ativo));
            });

            renderizarConvites();
        });
    });
}

if (newInviteForm) {
    newInviteForm.addEventListener("submit", criarConvite);
}


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

(function iniciar() {
    let senhaSalva = "";

    try {
        senhaSalva = sessionStorage.getItem(CHAVE_SESSAO) || "";
    } catch (erro) {
        console.warn("[admin] sessionStorage indisponível:", erro);
    }

    if (senhaSalva) {
        senhaAdmin = senhaSalva;
        mostrarPainel();
        carregarPainel();
    } else {
        mostrarLogin();
    }
})();
