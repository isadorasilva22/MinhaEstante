// TODO: substitua pelos dados da SUA conta Cloudinary
// (Dashboard > Cloud name) e por um Upload Preset "unsigned" criado em
// Settings > Upload > Upload presets
const CLOUD_NAME = "SEU_CLOUD_NAME";
const UPLOAD_PRESET = "SEU_UPLOAD_PRESET";

export async function uploadImagem(arquivo) {

    const formData = new FormData();
    formData.append("file", arquivo);
    formData.append("upload_preset", UPLOAD_PRESET);

    const resposta = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        {
            method: "POST",
            body: formData
        }
    );

    if (!resposta.ok) {
        throw new Error("Falha ao enviar imagem para o Cloudinary.");
    }

    return resposta.json();
}
