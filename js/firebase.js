import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

import {
    getAuth
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";

// TODO: substitua pelos dados do SEU projeto Firebase
// (Console Firebase > Configurações do projeto > Seus apps > Config)
const firebaseConfig = {
  apiKey: "AIzaSyBICmngpJjK2yo3yd-GDVQI_dq2I-ccTdg",
  authDomain: "minhaestante-5b574.firebaseapp.com",
  projectId: "minhaestante-5b574",
  storageBucket: "minhaestante-5b574.firebasestorage.app",
  messagingSenderId: "374856236186",
  appId: "1:374856236186:web:a21e7de086606a0c2e3323",
  measurementId: "G-JVHK19590M"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

export const auth = getAuth(app);
