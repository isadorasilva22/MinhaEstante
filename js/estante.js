import { db } from "./firebase.js";

import {
    collection,
    onSnapshot,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const STATUS_LABEL = {
    "quero-ler": "Quero Ler",
    "lendo": "Lendo",
    "lido": "Lido"
};

const STATUS_CLASSE = {
    "quero-ler": "badge-status-quero",
    "lendo": "badge-status-lendo",
    "lido": "badge-status-lido"
};

const cards = document.getElementById("cards");
const contador = document.getElementById("contador");
const inputPesquisa = document.getElementById("pesquisa");
const sidebar = document.querySelector(".sidebar");
const listaGenerosFiltro = document.getElementById("listaGenerosFiltro");
const btnFiltroFavoritos = document.getElementById("btnFiltroFavoritos");
const tituloEstante = document.getElementById("tituloEstante");

const seletorEstante = document.getElementById("seletorEstante");
const listaSeletorDonos = document.getElementById("listaSeletorDonos");
const layoutPrincipal = document.getElementById("layoutPrincipal");
const btnTrocarEstante = document.getElementById("btnTrocarEstante");

const modal = document.getElementById("modal");
const fechar = document.getElementById("fechar");
const modalImagem = document.getElementById("modalImagem");
const modalNome = document.getElementById("modalNome");
const modalAutor = document.getElementById("modalAutor");
const modalBadges = document.getElementById("modalBadges");
const modalEstrelas = document.getElementById("modalEstrelas");
const modalComentarios = document.getElementById("modalComentarios");
const carrosselAnterior = document.getElementById("carrosselAnterior");
const carrosselProximo = document.getElementById("carrosselProximo");
const carrosselIndicadores = document.getElementById("carrosselIndicadores");

const CHAVE_ESTANTE = "estanteSelecionada";

let todosLivros = [];
let generoAtivo = "Todos";
let statusAtivo = "Todos";
let apenasFavoritos = false;
let termoPesquisa = "";
let donoSelecionado = localStorage.getItem(CHAVE_ESTANTE) || null;
let donosCompletos = [];
let fotosModalAtual = [];
let indiceFotoAtual = 0;

const PLACEHOLDER_BUSCA_DONO = "Pesquisar dono...";
const PLACEHOLDER_BUSCA_LIVRO = "Pesquisar por título ou autor...";

const removerAcentos = new RegExp("[" + String.fromCharCode(0x300) + "-" + String.fromCharCode(0x36f) + "]", "g");

function normalizar(texto) {
    return texto.toLowerCase().normalize("NFD").replace(removerAcentos, "");
}

function estrelasHtml(nota) {

    return Array.from({ length: 5 }, (_, indice) =>
        `<i class="fa-solid fa-star${indice < nota ? "" : " vazia"}"></i>`
    ).join("");

}

function renderCards(lista) {

    contador.textContent = `${lista.length} livro${lista.length === 1 ? "" : "s"}`;

    if (lista.length === 0) {
        cards.innerHTML = '<p class="vazio">Nenhum livro encontrado.</p>';
        return;
    }

    cards.innerHTML = lista.map((l) => `
        <div class="card" data-id="${l.id}">
            ${l.favorito ? '<span class="favoritoTag" title="Favorito"><i class="fa-solid fa-heart"></i></span>' : ""}
            ${l.fotos?.length > 1 ? `<span class="fotosBadge"><i class="fa-solid fa-images"></i> ${l.fotos.length}</span>` : ""}
            <img src="${l.fotos?.[0]?.url}" alt="${l.titulo}" onerror="this.onerror=null;this.src='${l.fotos?.[0]?.original}';">
            <h3>${l.titulo}</h3>
            <span class="autor">${l.autor}</span>
            <div class="badges">
                ${(l.generos || []).map((g) => `<span class="badge badge-genero">${g}</span>`).join("")}
                <span class="badge ${STATUS_CLASSE[l.status] || "badge-status-quero"}">${STATUS_LABEL[l.status] || l.status}</span>
            </div>
            <div class="estrelas">${estrelasHtml(l.nota || 0)}</div>
        </div>
    `).join("");

}

function aplicarFiltros() {

    let filtrados = todosLivros.filter((l) => l.dono === donoSelecionado);

    if (generoAtivo !== "Todos") {
        filtrados = filtrados.filter((l) => l.generos?.includes(generoAtivo));
    }

    if (statusAtivo !== "Todos") {
        filtrados = filtrados.filter((l) => l.status === statusAtivo);
    }

    if (apenasFavoritos) {
        filtrados = filtrados.filter((l) => l.favorito);
    }

    if (termoPesquisa) {
        filtrados = filtrados.filter((l) =>
            normalizar(l.titulo).includes(termoPesquisa) ||
            normalizar(l.autor).includes(termoPesquisa)
        );
    }

    renderCards(filtrados);

}

function renderBotoesGenero(generos) {

    listaGenerosFiltro.innerHTML = generos.map((nome) => `
        <button data-genero="${nome}" class="${nome === generoAtivo ? "ativo" : ""}">
            ${nome}
        </button>
    `).join("");

}

function atualizarGenerosDisponiveis() {

    const nomes = new Set();

    todosLivros
        .filter((l) => l.dono === donoSelecionado)
        .forEach((l) => (l.generos || []).forEach((g) => nomes.add(g)));

    renderBotoesGenero(Array.from(nomes).sort((a, b) => a.localeCompare(b, "pt-BR")));

}

function resetFiltroGenero() {
    generoAtivo = "Todos";
    sidebar.querySelectorAll("button[data-genero]").forEach((b) => b.classList.toggle("ativo", b.dataset.genero === "Todos"));
}

//------------------------------------------------------------------------------------------
//	SELEÇÃO DA ESTANTE (DONO)
//------------------------------------------------------------------------------------------

function renderSeletorDonos(donos) {

    if (donos.length === 0) {
        listaSeletorDonos.innerHTML = '<p class="vazio">Nenhuma estante encontrada.</p>';
        return;
    }

    listaSeletorDonos.innerHTML = donos.map((nome) => `
        <button type="button" class="cardSeletorDono" data-dono="${nome}">
            <i class="fa-solid fa-book-open"></i>
            ${nome}
        </button>
    `).join("");

}

function renderSeletorDonosFiltrado() {

    const filtrados = termoPesquisa
        ? donosCompletos.filter((nome) => normalizar(nome).includes(termoPesquisa))
        : donosCompletos;

    renderSeletorDonos(filtrados);

}

function selecionarDono(nome) {
    donoSelecionado = nome;
    localStorage.setItem(CHAVE_ESTANTE, nome);
    tituloEstante.textContent = `Estante de ${nome}`;
    seletorEstante.classList.add("oculto");
    layoutPrincipal.classList.remove("oculto");
    btnTrocarEstante.classList.remove("oculto");
    termoPesquisa = "";
    inputPesquisa.value = "";
    inputPesquisa.placeholder = PLACEHOLDER_BUSCA_LIVRO;
    resetFiltroGenero();
    atualizarGenerosDisponiveis();
    aplicarFiltros();
}

function voltarSeletor() {
    donoSelecionado = null;
    localStorage.removeItem(CHAVE_ESTANTE);
    seletorEstante.classList.remove("oculto");
    layoutPrincipal.classList.add("oculto");
    btnTrocarEstante.classList.add("oculto");
    termoPesquisa = "";
    inputPesquisa.value = "";
    inputPesquisa.placeholder = PLACEHOLDER_BUSCA_DONO;
    renderSeletorDonosFiltrado();
}

listaSeletorDonos.addEventListener("click", (evento) => {
    const botao = evento.target.closest(".cardSeletorDono");
    if (!botao) return;
    selecionarDono(botao.dataset.dono);
});

btnTrocarEstante.addEventListener("click", voltarSeletor);

if (donoSelecionado) {
    selecionarDono(donoSelecionado);
} else {
    inputPesquisa.placeholder = PLACEHOLDER_BUSCA_DONO;
}

function renderFotoModal() {

    const foto = fotosModalAtual[indiceFotoAtual];
    modalImagem.src = foto.url;
    modalImagem.onerror = () => {
        modalImagem.onerror = null;
        modalImagem.src = foto.original;
    };

    const temVarias = fotosModalAtual.length > 1;
    carrosselAnterior.classList.toggle("oculto", !temVarias);
    carrosselProximo.classList.toggle("oculto", !temVarias);

    carrosselIndicadores.innerHTML = temVarias
        ? fotosModalAtual.map((_, indice) => `
            <button type="button" data-indice="${indice}" class="${indice === indiceFotoAtual ? "ativo" : ""}"></button>
        `).join("")
        : "";

}

function irParaFoto(indice) {
    indiceFotoAtual = (indice + fotosModalAtual.length) % fotosModalAtual.length;
    renderFotoModal();
}

carrosselAnterior.addEventListener("click", () => irParaFoto(indiceFotoAtual - 1));
carrosselProximo.addEventListener("click", () => irParaFoto(indiceFotoAtual + 1));

carrosselIndicadores.addEventListener("click", (evento) => {
    const botao = evento.target.closest("button[data-indice]");
    if (!botao) return;
    irParaFoto(Number(botao.dataset.indice));
});

function abrirModal(livro) {
    fotosModalAtual = livro.fotos?.length ? livro.fotos : [{ url: "", original: "" }];
    indiceFotoAtual = 0;
    renderFotoModal();
    modalNome.textContent = livro.titulo;
    modalAutor.textContent = livro.autor;

    modalBadges.innerHTML = [
        ...(livro.generos || []).map((g) => `<span class="badge badge-genero">${g}</span>`),
        `<span class="badge ${STATUS_CLASSE[livro.status] || "badge-status-quero"}">${STATUS_LABEL[livro.status] || livro.status}</span>`,
        livro.favorito ? '<span class="badge badge-favorito"><i class="fa-solid fa-heart"></i> Favorito</span>' : ""
    ].join("");

    modalEstrelas.innerHTML = estrelasHtml(livro.nota || 0);

    modalComentarios.textContent = livro.comentarios || "";
    modalComentarios.style.display = livro.comentarios ? "block" : "none";

    modal.style.display = "flex";
}

function fecharModal() {
    modal.style.display = "none";
}

cards.addEventListener("click", (evento) => {
    const card = evento.target.closest(".card");
    if (!card) return;

    const livro = todosLivros.find((l) => l.id === card.dataset.id);
    if (livro) abrirModal(livro);
});

fechar.addEventListener("click", fecharModal);

modal.addEventListener("click", (evento) => {
    if (evento.target === modal) fecharModal();
});

document.addEventListener("keydown", (evento) => {

    if (modal.style.display !== "flex") return;

    if (evento.key === "Escape") fecharModal();
    if (evento.key === "ArrowLeft") irParaFoto(indiceFotoAtual - 1);
    if (evento.key === "ArrowRight") irParaFoto(indiceFotoAtual + 1);

});

sidebar.addEventListener("click", (evento) => {

    const botaoGenero = evento.target.closest("button[data-genero]");
    if (botaoGenero) {
        sidebar.querySelectorAll("button[data-genero]").forEach((b) => b.classList.remove("ativo"));
        botaoGenero.classList.add("ativo");
        generoAtivo = botaoGenero.dataset.genero;
        aplicarFiltros();
        return;
    }

    const botaoStatus = evento.target.closest("button[data-status]");
    if (botaoStatus) {
        sidebar.querySelectorAll("button[data-status]").forEach((b) => b.classList.remove("ativo"));
        botaoStatus.classList.add("ativo");
        statusAtivo = botaoStatus.dataset.status;
        aplicarFiltros();
    }

});

btnFiltroFavoritos.addEventListener("click", () => {
    apenasFavoritos = !apenasFavoritos;
    btnFiltroFavoritos.classList.toggle("ativo", apenasFavoritos);
    aplicarFiltros();
});

inputPesquisa.addEventListener("input", () => {
    termoPesquisa = normalizar(inputPesquisa.value.trim());
    if (donoSelecionado) {
        aplicarFiltros();
    } else {
        renderSeletorDonosFiltrado();
    }
});

cards.innerHTML = Array.from({ length: 8 }, () => '<div class="skeleton-card"></div>').join("");

onSnapshot(
    query(collection(db, "donos"), orderBy("nome")),
    (snapshot) => {
        donosCompletos = snapshot.docs.map((documento) => documento.data().nome);
        renderSeletorDonosFiltrado();
    },
    (erro) => {
        console.error(erro);
        listaSeletorDonos.innerHTML = '<p class="vazio">Erro ao carregar as estantes.</p>';
    }
);

onSnapshot(
    query(collection(db, "livros"), orderBy("criadoEm", "desc")),
    (snapshot) => {
        todosLivros = snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
        atualizarGenerosDisponiveis();
        aplicarFiltros();
    },
    (erro) => {
        console.error(erro);
        cards.innerHTML = '<p class="vazio">Erro ao carregar a estante.</p>';
    }
);
