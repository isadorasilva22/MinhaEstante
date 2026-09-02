import { auth } from "./firebase.js";

import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";

const loginSection = document.getElementById("loginSection");
const cadastroSection = document.getElementById("cadastroSection");
const formLogin = document.getElementById("formLogin");
const loginEmail = document.getElementById("loginEmail");
const loginSenha = document.getElementById("loginSenha");
const loginErro = document.getElementById("loginErro");
const btnLogout = document.getElementById("btnLogout");
const usuarioLogado = document.getElementById("usuarioLogado");

onAuthStateChanged(auth, (usuario) => {

    if (usuario) {
        loginSection.classList.add("oculto");
        cadastroSection.classList.remove("oculto");
        usuarioLogado.textContent = usuario.email;
    } else {
        loginSection.classList.remove("oculto");
        cadastroSection.classList.add("oculto");
        usuarioLogado.textContent = "";
    }

});

formLogin.addEventListener("submit", async (evento) => {

    evento.preventDefault();
    loginErro.textContent = "";

    try {
        await signInWithEmailAndPassword(auth, loginEmail.value, loginSenha.value);
        formLogin.reset();
    } catch (erro) {
        loginErro.textContent = "E-mail ou senha inválidos.";
    }

});

btnLogout.addEventListener("click", () => {
    signOut(auth);
});
