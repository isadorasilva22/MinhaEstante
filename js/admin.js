import { db, auth } from "./firebase.js";

import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    serverTimestamp,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

import { uploadImagem } from "./cloudinary.js";
import { removerFundo } from "./remover-fundo.js";

const STATUS_LABEL = {
    "quero-ler": "Quero Ler",
    "lendo": "Lendo",
    "lido": "Lido"
};

const colecao = collection(db, "livros");
const colecaoGeneros = collection(db, "generos");
const colecaoDonos = collection(db, "donos");

const form = document.getElementById("formCadastro");
const inputTitulo = document.getElementById("titulo");
const inputAutor = document.getElementById("autor");
const inputDono = document.getElementById("dono");
const inputGenero = document.getElementById("genero");
const inputStatus = document.getElementById("status");
const inputNota = document.getElementById("nota");
const estrelasInput = document.getElementById("estrelasInput");
const inputFotos = document.getElementById("fotos");
const fotosPreview = document.getElementById("fotosPreview");
const status = document.getElementById("statusForm");
const tituloForm = document.getElementById("tituloForm");
const botaoSalvar = document.getElementById("btnSalvar");
const botaoCancelarEdicao = document.getElementById("btnCancelarEdicao");
const listaLivros = document.getElementById("listaLivros");
const nomeArquivo = document.getElementById("nomeArquivo");
const inputPesquisaAdmin = document.getElementById("pesquisaAdmin");

const formGenero = document.getElementById("formGenero");
const inputNovoGenero = document.getElementById("novoGenero");
const listaGeneros = document.getElementById("listaGeneros");

const formDono = document.getElementById("formDono");
const inputNovoDono = document.getElementById("novoDono");
const listaDonos = document.getElementById("listaDonos");

const modalConfirmacao = document.getElementById("modalConfirmacao");
const modalConfirmacaoTexto = document.getElementById("modalConfirmacaoTexto");
const btnCancelarConfirmacao = document.getElementById("btnCancelarConfirmacao");
const btnConfirmarExclusao = document.getElementById("btnConfirmarExclusao");

const modalGeneros = document.getElementById("modalGeneros");
const listaGenerosModal = document.getElementById("listaGenerosModal");
const btnFecharModalGeneros = document.getElementById("btnFecharModalGeneros");

const modalDonos = document.getElementById("modalDonos");
const listaDonosModal = document.getElementById("listaDonosModal");
const btnFecharModalDonos = document.getElementById("btnFecharModalDonos");

let itemEditando = null;
let itensAtuais = [];
let generosAtuais = [];
let donosAtuais = [];
let fotosPendentes = [];
let termoPesquisaAdmin = "";
let notaAtual = 0;

const removerAcentos = new RegExp("[" + String.fromCharCode(0x300) + "-" + String.fromCharCode(0x36f) + "]", "g");

function normalizar(texto) {
    return texto.toLowerCase().normalize("NFD").replace(removerAcentos, "");
}

function confirmarAcao(mensagem) {

    return new Promise((resolve) => {

        modalConfirmacaoTexto.textContent = mensagem;
        modalConfirmacao.style.display = "flex";

        function limpar(resultado) {
            modalConfirmacao.style.display = "none";
            btnConfirmarExclusao.removeEventListener("click", aoConfirmar);
            btnCancelarConfirmacao.removeEventListener("click", aoCancelar);
            modalConfirmacao.removeEventListener("click", aoClicarFora);
            document.removeEventListener("keydown", aoTeclar);
            resolve(resultado);
        }

        function aoConfirmar() { limpar(true); }
        function aoCancelar() { limpar(false); }
        function aoClicarFora(evento) {
            if (evento.target === modalConfirmacao) limpar(false);
        }
        function aoTeclar(evento) {
            if (evento.key === "Escape") limpar(false);
        }

        btnConfirmarExclusao.addEventListener("click", aoConfirmar);
        btnCancelarConfirmacao.addEventListener("click", aoCancelar);
        modalConfirmacao.addEventListener("click", aoClicarFora);
        document.addEventListener("keydown", aoTeclar);

    });

}

function mensagemErro(erro, acao) {

    if (!navigator.onLine) {
        return "Sem conexão com a internet. Verifique sua rede e tente novamente.";
    }

    if (erro?.message?.includes("Cloudinary")) {
        return "Não foi possível enviar a imagem. Verifique o arquivo e tente novamente.";
    }

    switch (erro?.code) {
        case "permission-denied":
            return "Você não tem permissão para essa ação. Faça login novamente.";
        case "unavailable":
            return "Não foi possível conectar ao banco de dados. Tente novamente em alguns instantes.";
        case "not-found":
            return "Este item não foi encontrado — ele pode já ter sido excluído.";
    }

    return `Erro ao ${acao}. Tente novamente.`;

}

//------------------------------------------------------------------------------------------
//	SELETOR DE ESTRELAS (NOTA)
//------------------------------------------------------------------------------------------

function renderEstrelasInput() {

    estrelasInput.innerHTML = Array.from({ length: 5 }, (_, indice) => {
        const valor = indice + 1;
        return `<i class="fa-solid fa-star${valor <= notaAtual ? " preenchida" : ""}" data-valor="${valor}"></i>`;
    }).join("");

}

function definirNota(valor) {
    notaAtual = notaAtual === valor ? 0 : valor;
    inputNota.value = notaAtual;
    renderEstrelasInput();
}

estrelasInput.addEventListener("click", (evento) => {
    const estrela = evento.target.closest("i[data-valor]");
    if (!estrela) return;
    definirNota(Number(estrela.dataset.valor));
});

renderEstrelasInput();

//------------------------------------------------------------------------------------------
//	UPLOAD DAS FOTOS (COM REMOÇÃO DE FUNDO)
//------------------------------------------------------------------------------------------

function renderFotosPreview() {

    fotosPreview.innerHTML = fotosPendentes.map((foto, indice) => `
        <div class="fotoPendente">
            <img src="${foto.url}" onerror="this.onerror=null;this.src='${foto.original}';">
            <button type="button" class="btnRemoverFoto" data-indice="${indice}" title="Remover foto">&times;</button>
        </div>
    `).join("");

}

fotosPreview.addEventListener("click", (evento) => {

    const botao = evento.target.closest(".btnRemoverFoto");
    if (!botao) return;

    fotosPendentes.splice(Number(botao.dataset.indice), 1);
    renderFotosPreview();

});

inputFotos.addEventListener("change", async () => {

    const arquivos = Array.from(inputFotos.files);
    inputFotos.value = "";

    if (arquivos.length === 0) return;

    status.textContent = `Enviando ${arquivos.length} foto${arquivos.length === 1 ? "" : "s"}...`;
    botaoSalvar.disabled = true;

    try {

        const resultados = await Promise.all(arquivos.map((arquivo) => uploadImagem(arquivo)));

        resultados.forEach((resultadoUpload) => {
            fotosPendentes.push({
                url: removerFundo(resultadoUpload.secure_url),
                original: resultadoUpload.secure_url,
                publicId: resultadoUpload.public_id
            });
        });

        renderFotosPreview();
        nomeArquivo.textContent = `${fotosPendentes.length} foto${fotosPendentes.length === 1 ? "" : "s"} selecionada${fotosPendentes.length === 1 ? "" : "s"}`;
        status.textContent = "Fotos enviadas. Confira o resultado antes de salvar.";

    } catch (erro) {
        console.error(erro);
        status.textContent = mensagemErro(erro, "enviar as fotos");
    } finally {
        botaoSalvar.disabled = false;
    }

});

//------------------------------------------------------------------------------------------
//	FORMULÁRIO DE CADASTRO / EDIÇÃO
//------------------------------------------------------------------------------------------

function resetFormParaNovo() {
    itemEditando = null;
    fotosPendentes = [];
    renderFotosPreview();
    form.reset();
    nomeArquivo.textContent = "Nenhuma foto selecionada";
    tituloForm.textContent = "Novo Livro";
    botaoSalvar.textContent = "Salvar";
    botaoCancelarEdicao.classList.add("oculto");
    definirNota(0);
}

function iniciarEdicao(item) {
    itemEditando = item;
    fotosPendentes = (item.fotos || []).slice();
    renderFotosPreview();
    inputTitulo.value = item.titulo;
    inputAutor.value = item.autor;
    inputDono.value = item.dono;
    inputGenero.value = item.genero;
    inputStatus.value = item.status;
    notaAtual = item.nota || 0;
    renderEstrelasInput();
    inputNota.value = notaAtual;
    nomeArquivo.textContent = "Escolha novas fotos para adicionar";
    tituloForm.textContent = "Editar Livro";
    botaoSalvar.textContent = "Atualizar";
    botaoCancelarEdicao.classList.remove("oculto");
    status.textContent = "";
    form.scrollIntoView({ behavior: "smooth" });
}

botaoCancelarEdicao.addEventListener("click", () => {
    resetFormParaNovo();
    status.textContent = "";
});

async function excluirLivro(id) {

    const confirmado = await confirmarAcao("Excluir este livro? Essa ação não pode ser desfeita.");
    if (!confirmado) return;

    try {

        await deleteDoc(doc(db, "livros", id));

        if (itemEditando?.id === id) {
            resetFormParaNovo();
        }

    } catch (erro) {
        console.error(erro);
        alert(mensagemErro(erro, "excluir o livro"));
    }

}

async function alternarFavorito(id) {

    const item = itensAtuais.find((i) => i.id === id);
    if (!item) return;

    await updateDoc(doc(db, "livros", id), { favorito: !item.favorito });

}

function renderLista(itens) {

    if (itens.length === 0) {
        listaLivros.innerHTML = '<p class="vazioLista">Nenhum livro cadastrado ainda.</p>';
        return;
    }

    listaLivros.innerHTML = itens.map((item) => `
        <div class="itemLista">
            <img src="${item.fotos?.[0]?.url}" onerror="this.onerror=null;this.src='${item.fotos?.[0]?.original}';">
            <div class="infoItem">
                <strong>${item.titulo}</strong>
                <span>${item.autor} · ${item.dono} · ${item.genero} · ${STATUS_LABEL[item.status] || item.status}</span>
            </div>
            <div class="acoesItem">
                <button type="button" class="btnFavorito${item.favorito ? " ativo" : ""}" data-id="${item.id}" title="${item.favorito ? "Remover dos favoritos" : "Marcar como favorito"}">
                    <i class="fa-solid fa-heart"></i>
                </button>
                <button type="button" class="btnEditar" data-id="${item.id}" title="Editar">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button type="button" class="btnExcluir" data-id="${item.id}" title="Excluir">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
    `).join("");

}

function aplicarFiltroLista() {

    let filtrados = itensAtuais;

    if (termoPesquisaAdmin) {
        filtrados = filtrados.filter((item) =>
            normalizar(item.titulo).includes(termoPesquisaAdmin) ||
            normalizar(item.autor).includes(termoPesquisaAdmin)
        );
    }

    renderLista(filtrados);

}

inputPesquisaAdmin.addEventListener("input", () => {
    termoPesquisaAdmin = normalizar(inputPesquisaAdmin.value.trim());
    aplicarFiltroLista();
});

//------------------------------------------------------------------------------------------
//	GÊNEROS
//------------------------------------------------------------------------------------------

function sincronizarGeneroAtual() {

    if (inputGenero.value && !generosAtuais.some((g) => g.nome === inputGenero.value)) {
        inputGenero.value = "";
    }

}

function renderListaGenerosModal() {

    if (generosAtuais.length === 0) {
        listaGenerosModal.innerHTML = '<p class="vazioLista">Nenhum gênero cadastrado ainda.</p>';
        return;
    }

    listaGenerosModal.innerHTML = generosAtuais.map((g) => `
        <button type="button" class="itemGeneroModal${g.nome === inputGenero.value ? " ativo" : ""}" data-nome="${g.nome}">
            ${g.nome}
            ${g.nome === inputGenero.value ? '<i class="fa-solid fa-check"></i>' : ""}
        </button>
    `).join("");

}

function abrirModalGeneros() {
    renderListaGenerosModal();
    modalGeneros.style.display = "flex";
}

function fecharModalGeneros() {
    modalGeneros.style.display = "none";
}

inputGenero.addEventListener("focus", () => inputGenero.blur());

inputGenero.addEventListener("click", abrirModalGeneros);

inputGenero.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter" || evento.key === " ") {
        evento.preventDefault();
        abrirModalGeneros();
    }
});

btnFecharModalGeneros.addEventListener("click", fecharModalGeneros);

modalGeneros.addEventListener("click", (evento) => {
    if (evento.target === modalGeneros) fecharModalGeneros();
});

document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && modalGeneros.style.display === "flex") {
        fecharModalGeneros();
    }
});

listaGenerosModal.addEventListener("click", (evento) => {

    const botao = evento.target.closest(".itemGeneroModal");
    if (!botao) return;

    inputGenero.value = botao.dataset.nome;
    fecharModalGeneros();

});

function renderListaGeneros() {

    if (generosAtuais.length === 0) {
        listaGeneros.innerHTML = '<p class="vazioLista">Nenhum gênero cadastrado ainda.</p>';
        return;
    }

    listaGeneros.innerHTML = generosAtuais.map((g) => `
        <span class="generoPill">
            ${g.nome}
            <button type="button" class="btnExcluirGenero" data-id="${g.id}" title="Excluir gênero">&times;</button>
        </span>
    `).join("");

}

formGenero.addEventListener("submit", async (evento) => {

    evento.preventDefault();

    const nome = inputNovoGenero.value.trim();

    if (!nome || generosAtuais.some((g) => g.nome.toLowerCase() === nome.toLowerCase())) {
        formGenero.reset();
        return;
    }

    await addDoc(colecaoGeneros, { nome, criadoEm: serverTimestamp() });
    formGenero.reset();

});

listaGeneros.addEventListener("click", async (evento) => {

    const botao = evento.target.closest(".btnExcluirGenero");
    if (!botao) return;

    const confirmado = await confirmarAcao("Excluir este gênero? Livros já cadastrados com ele não serão apagados.");
    if (!confirmado) return;

    try {
        await deleteDoc(doc(db, "generos", botao.dataset.id));
    } catch (erro) {
        console.error(erro);
        alert(mensagemErro(erro, "excluir o gênero"));
    }

});

onSnapshot(
    query(colecaoGeneros, orderBy("nome")),
    (snapshot) => {
        generosAtuais = snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
        sincronizarGeneroAtual();
        renderListaGeneros();
        if (modalGeneros.style.display === "flex") {
            renderListaGenerosModal();
        }
    },
    (erro) => {
        console.error(erro);
        listaGeneros.innerHTML = '<p class="erro">Erro ao carregar gêneros.</p>';
    }
);

//------------------------------------------------------------------------------------------
//	DONOS DAS ESTANTES
//------------------------------------------------------------------------------------------

function sincronizarDonoAtual() {

    if (inputDono.value && !donosAtuais.some((d) => d.nome === inputDono.value)) {
        inputDono.value = "";
    }

}

function renderListaDonosModal() {

    if (donosAtuais.length === 0) {
        listaDonosModal.innerHTML = '<p class="vazioLista">Nenhum dono cadastrado ainda.</p>';
        return;
    }

    listaDonosModal.innerHTML = donosAtuais.map((d) => `
        <button type="button" class="itemGeneroModal${d.nome === inputDono.value ? " ativo" : ""}" data-nome="${d.nome}">
            ${d.nome}
            ${d.nome === inputDono.value ? '<i class="fa-solid fa-check"></i>' : ""}
        </button>
    `).join("");

}

function abrirModalDonos() {
    renderListaDonosModal();
    modalDonos.style.display = "flex";
}

function fecharModalDonos() {
    modalDonos.style.display = "none";
}

inputDono.addEventListener("focus", () => inputDono.blur());

inputDono.addEventListener("click", abrirModalDonos);

inputDono.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter" || evento.key === " ") {
        evento.preventDefault();
        abrirModalDonos();
    }
});

btnFecharModalDonos.addEventListener("click", fecharModalDonos);

modalDonos.addEventListener("click", (evento) => {
    if (evento.target === modalDonos) fecharModalDonos();
});

document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && modalDonos.style.display === "flex") {
        fecharModalDonos();
    }
});

listaDonosModal.addEventListener("click", (evento) => {

    const botao = evento.target.closest(".itemGeneroModal");
    if (!botao) return;

    inputDono.value = botao.dataset.nome;
    fecharModalDonos();

});

function renderListaDonos() {

    if (donosAtuais.length === 0) {
        listaDonos.innerHTML = '<p class="vazioLista">Nenhum dono cadastrado ainda.</p>';
        return;
    }

    listaDonos.innerHTML = donosAtuais.map((d) => `
        <span class="generoPill">
            ${d.nome}
            <button type="button" class="btnExcluirDono" data-id="${d.id}" title="Excluir dono">&times;</button>
        </span>
    `).join("");

}

formDono.addEventListener("submit", async (evento) => {

    evento.preventDefault();

    const nome = inputNovoDono.value.trim();

    if (!nome || donosAtuais.some((d) => d.nome.toLowerCase() === nome.toLowerCase())) {
        formDono.reset();
        return;
    }

    await addDoc(colecaoDonos, { nome, criadoEm: serverTimestamp() });
    formDono.reset();

});

listaDonos.addEventListener("click", async (evento) => {

    const botao = evento.target.closest(".btnExcluirDono");
    if (!botao) return;

    const confirmado = await confirmarAcao("Excluir este dono? Livros já cadastrados com ele não serão apagados.");
    if (!confirmado) return;

    try {
        await deleteDoc(doc(db, "donos", botao.dataset.id));
    } catch (erro) {
        console.error(erro);
        alert(mensagemErro(erro, "excluir o dono"));
    }

});

onSnapshot(
    query(colecaoDonos, orderBy("nome")),
    (snapshot) => {
        donosAtuais = snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
        sincronizarDonoAtual();
        renderListaDonos();
        if (modalDonos.style.display === "flex") {
            renderListaDonosModal();
        }
    },
    (erro) => {
        console.error(erro);
        listaDonos.innerHTML = '<p class="erro">Erro ao carregar donos.</p>';
    }
);

onSnapshot(
    query(colecao, orderBy("titulo")),
    (snapshot) => {
        itensAtuais = snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
        aplicarFiltroLista();
    },
    (erro) => {
        console.error(erro);
        listaLivros.innerHTML = '<p class="erro">Erro ao carregar livros.</p>';
    }
);

listaLivros.addEventListener("click", (evento) => {

    const botaoEditar = evento.target.closest(".btnEditar");
    const botaoExcluir = evento.target.closest(".btnExcluir");
    const botaoFavorito = evento.target.closest(".btnFavorito");

    if (botaoEditar) {
        const item = itensAtuais.find((i) => i.id === botaoEditar.dataset.id);
        if (item) iniciarEdicao(item);
    }

    if (botaoExcluir) {
        excluirLivro(botaoExcluir.dataset.id);
    }

    if (botaoFavorito) {
        alternarFavorito(botaoFavorito.dataset.id);
    }

});

form.addEventListener("submit", async (evento) => {

    evento.preventDefault();

    if (!auth.currentUser) {
        return;
    }

    if (fotosPendentes.length === 0) {
        status.textContent = "Adicione ao menos uma foto do livro.";
        return;
    }

    botaoSalvar.disabled = true;
    status.textContent = itemEditando ? "Atualizando..." : "Salvando...";

    try {

        const dados = {
            titulo: inputTitulo.value,
            autor: inputAutor.value,
            dono: inputDono.value,
            genero: inputGenero.value,
            status: inputStatus.value,
            nota: notaAtual,
            favorito: itemEditando?.favorito || false,
            fotos: fotosPendentes
        };

        if (itemEditando) {
            await updateDoc(doc(db, "livros", itemEditando.id), dados);
            resetFormParaNovo();
            status.textContent = "Livro atualizado com sucesso!";
        } else {
            dados.criadoEm = serverTimestamp();
            await addDoc(colecao, dados);
            resetFormParaNovo();
            status.textContent = "Livro salvo com sucesso!";
        }

    } catch (erro) {
        console.error(erro);
        status.textContent = mensagemErro(erro, itemEditando ? "atualizar o livro" : "salvar o livro");
    } finally {
        botaoSalvar.disabled = false;
    }

});
