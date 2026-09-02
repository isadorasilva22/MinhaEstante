// Usa o add-on de remoção de fundo por IA do Cloudinary.
// Precisa estar ativado em Add-ons > Cloudinary AI Background Removal na sua conta.
export function removerFundo(urlImagem) {
    return urlImagem.replace("/upload/", "/upload/e_background_removal/");
}
