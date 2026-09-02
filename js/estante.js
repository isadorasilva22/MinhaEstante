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
const modalGenero = document.getElementById("modalGenero");
const modalStatus = document.getElementById("modalStatus");
const modalFavorito = document.getElementById("modalFavorito");
const modalEstrelas = document.getElementById("modalEstrelas");

const CHAVE_ESTANTE = "estanteSelecionada";

let todosLivros = [];
let generoAtivo = "Todos";
let statusAtivo = "Todos";
let apenasFavoritos = false;
let termoPesquisa = "";
let donoSelecionado = localStorage.getItem(CHAVE_ESTANTE) || null;

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
            <img src="${l.capa}" alt="${l.titulo}">
            <h3>${l.titulo}</h3>
            <span class="autor">${l.autor}</span>
            <div class="badges">
                <span class="badge badge-genero">${l.genero}</span>
                <span class="badge ${STATUS_CLASSE[l.status] || "badge-status-quero"}">${STATUS_LABEL[l.status] || l.status}</span>
            </div>
            <div class="estrelas">${estrelasHtml(l.nota || 0)}</div>
        </div>
    `).join("");

}

function aplicarFiltros() {

    let filtrados = todosLivros.filter((l) => l.dono === donoSelecionado);

    if (generoAtivo !== "Todos") {
        filtrados = filtrados.filter((l) => l.genero === generoAtivo);
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

//------------------------------------------------------------------------------------------
//	SELEÇÃO DA ESTANTE (DONO)
//------------------------------------------------------------------------------------------

function renderSeletorDonos(donos) {

    if (donos.length === 0) {
        listaSeletorDonos.innerHTML = '<p class="vazio">Nenhuma estante cadastrada ainda.</p>';
        return;
    }

    listaSeletorDonos.innerHTML = donos.map((nome) => `
        <button type="button" class="cardSeletorDono" data-dono="${nome}">
            <i class="fa-solid fa-book-open"></i>
            ${nome}
        </button>
    `).join("");

}

function selecionarDono(nome) {
    donoSelecionado = nome;
    localStorage.setItem(CHAVE_ESTANTE, nome);
    tituloEstante.textContent = `Estante de ${nome}`;
    seletorEstante.classList.add("oculto");
    layoutPrincipal.classList.remove("oculto");
    btnTrocarEstante.classList.remove("oculto");
    aplicarFiltros();
}

function voltarSeletor() {
    donoSelecionado = null;
    localStorage.removeItem(CHAVE_ESTANTE);
    seletorEstante.classList.remove("oculto");
    layoutPrincipal.classList.add("oculto");
    btnTrocarEstante.classList.add("oculto");
}

listaSeletorDonos.addEventListener("click", (evento) => {
    const botao = evento.target.closest(".cardSeletorDono");
    if (!botao) return;
    selecionarDono(botao.dataset.dono);
});

btnTrocarEstante.addEventListener("click", voltarSeletor);

if (donoSelecionado) {
    selecionarDono(donoSelecionado);
}

function abrirModal(livro) {
    modalImagem.src = livro.capa;
    modalImagem.alt = livro.titulo;
    modalNome.textContent = livro.titulo;
    modalAutor.textContent = livro.autor;
    modalGenero.textContent = livro.genero;
    modalStatus.textContent = STATUS_LABEL[livro.status] || livro.status;
    modalStatus.className = `badge ${STATUS_CLASSE[livro.status] || "badge-status-quero"}`;
    modalFavorito.style.display = livro.favorito ? "inline-flex" : "none";
    modalEstrelas.innerHTML = estrelasHtml(livro.nota || 0);
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
    if (evento.key === "Escape") fecharModal();
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
    aplicarFiltros();
});

cards.innerHTML = Array.from({ length: 8 }, () => '<div class="skeleton-card"></div>').join("");

onSnapshot(
    query(collection(db, "generos"), orderBy("nome")),
    (snapshot) => {
        const generos = snapshot.docs.map((documento) => documento.data().nome);
        renderBotoesGenero(generos);
    },
    (erro) => console.error(erro)
);

onSnapshot(
    query(collection(db, "donos"), orderBy("nome")),
    (snapshot) => {
        const donos = snapshot.docs.map((documento) => documento.data().nome);
        renderSeletorDonos(donos);
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
        aplicarFiltros();
    },
    (erro) => {
        console.error(erro);
        cards.innerHTML = '<p class="vazio">Erro ao carregar a estante.</p>';
    }
);
