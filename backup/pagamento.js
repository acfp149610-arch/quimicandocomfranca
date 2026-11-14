// =====================================
// CONEXÃO COM SUPABASE
// =====================================

const SUPABASE_URL = "https://kghzycpuvlidoenqnhhb.supabase.co";

const SUPABASE_KEY = "sb_publishable_IntMzNdV-nhtxW8czMBijA_4yVRgbIp";

let supabase;

// =====================================
// CONFIGURAÇÕES DO PIX
// =====================================

const CHAVE_PIX = "03016158299";
const NOME_RECEBEDOR = "ANA CLARA FREITAS PAULINO";
const CIDADE = "MONTES CLAROS";

// =====================================
// DADOS DO CLIENTE
// =====================================

const cliente = JSON.parse(
    localStorage.getItem("dadosCliente")
);

if (!cliente) {
    alert("Cadastro não encontrado!");
    window.location.href = "index.html";
}

// =====================================
// VALORES DOS CURSOS
// =====================================

const valores = {
    "Curso 1": 1.00,
    "Curso 2": 1.00
};

const valor = valores[cliente.curso];

if (!valor) {
    alert("Curso inválido!");
    window.location.href = "index.html";
}

// =====================================
// MOSTRAR RESUMO
// =====================================

document.getElementById("nome").textContent =
    "Aluno: " + cliente.nome;

document.getElementById("curso").textContent =
    "Curso: " + cliente.curso;

document.getElementById("valor").textContent =
    "R$ " + valor.toFixed(2).replace(".", ",");

// =====================================
// CAMPOS PIX
// =====================================

function campo(id, valor) {
    return id +
        String(valor.length).padStart(2, "0") +
        valor;
}

// =====================================
// CRC16
// =====================================

function calcularCRC(texto) {
    let crc = 0xFFFF;

    for (let i = 0; i < texto.length; i++) {
        crc ^= texto.charCodeAt(i) << 8;

        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }

            crc &= 0xFFFF;
        }
    }

    return crc.toString(16)
        .toUpperCase()
        .padStart(4, "0");
}

// =====================================
// GERAR PIX
// =====================================

function gerarPix() {
    const chave = campo("01", CHAVE_PIX);

    const merchantAccount =
        campo("00", "br.gov.bcb.pix") + chave;

    const merchant = campo("26", merchantAccount);

    const identificador = "ZV" + Date.now();

    const adicional = campo(
        "62",
        campo("05", identificador)
    );

    let pix =
        campo("00", "01") +
        campo("01", "11") +
        merchant +
        campo("52", "0000") +
        campo("53", "986") +
        campo("54", valor.toFixed(2)) +
        campo("58", "BR") +
        campo("59", NOME_RECEBEDOR) +
        campo("60", CIDADE) +
        adicional +
        "6304";

    pix += calcularCRC(pix);

    return pix;
}

const codigo = gerarPix();

document.getElementById("codigoPix").value = codigo;

// =====================================
// QR CODE
// =====================================

new QRCode(document.getElementById("qrcode"), {
    text: codigo,
    width: 220,
    height: 220
});

// =====================================
// COPIAR PIX
// =====================================

document.getElementById("copiar").addEventListener(
    "click",
    async () => {
        try {
            await navigator.clipboard.writeText(codigo);

            document.getElementById("mensagem").textContent =
                "Código PIX copiado!";
        } catch (erro) {
            document.getElementById("mensagem").textContent =
                "Não foi possível copiar. Selecione o código manualmente.";
        }
    }
);

// =====================================
// CONECTAR AO SUPABASE
// =====================================

async function conectarSupabase() {
    const { createClient } = await import(
        "https://esm.sh/@supabase/supabase-js@2"
    );

    supabase = createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

    return supabase;
}

// =====================================
// ENVIAR CONTRATAÇÃO
// =====================================

async function enviarCadastro() {
    const botao = document.getElementById("finalizar");
    const status = document.getElementById("statusEnvio");
    const campoComprovante = document.getElementById("comprovante");

    const arquivo = campoComprovante.files[0];

    if (!arquivo) {
        status.textContent = "Anexe seu comprovante PIX.";
        return;
    }

    if (arquivo.size > 5 * 1024 * 1024) {
        status.textContent =
            "O comprovante deve ter no máximo 5 MB.";
        return;
    }

    botao.disabled = true;
    botao.textContent = "ENVIANDO...";
    status.textContent = "Conectando ao sistema...";

    try {
        await conectarSupabase();

        // Nome único para o comprovante
        const extensao = arquivo.name.includes(".")
            ? arquivo.name.split(".").pop().toLowerCase()
            : "bin";

        const nomeArquivo =
            crypto.randomUUID() + "." + extensao;

        const caminhoArquivo = nomeArquivo;

        // Enviar comprovante para o Storage
        status.textContent = "Enviando comprovante...";

        const { error: erroUpload } =
            await supabase.storage
                .from("comprovantes")
                .upload(caminhoArquivo, arquivo, {
                    contentType: arquivo.type || "application/octet-stream",
                    upsert: false
                });

        if (erroUpload) {
            throw erroUpload;
        }

        // Salvar dados na tabela
        status.textContent = "Salvando seus dados...";

        const dados = {
            nome: cliente.nome,
            email: cliente.email,
            telefone: cliente.telefone,
            cpf: cliente.cpf,
            curso: cliente.curso,
            valor: valor.toFixed(2),
            comprovante: caminhoArquivo,
            status: "Pendente"
        };

        const { error: erroCadastro } =
            await supabase
                .from("contratacoes")
                .insert([dados]);

        if (erroCadastro) {
            // Tenta excluir o comprovante caso o cadastro falhe
            await supabase.storage
                .from("comprovantes")
                .remove([caminhoArquivo]);

            throw erroCadastro;
        }

        status.textContent =
            "✓ Contratação enviada com sucesso! Seus dados e comprovante foram encaminhados para análise. Aguarde a confirmação.";

        botao.textContent = "CONTRATAÇÃO ENVIADA";

        localStorage.removeItem("dadosCliente");

    } catch (erro) {
        console.error("Erro no Supabase:", erro);

        status.textContent =
            "Não foi possível enviar: " +
            (erro.message || "Erro desconhecido.");

        botao.disabled = false;
        botao.textContent = "FINALIZAR CONTRATAÇÃO";
    }
}

// =====================================
// BOTÃO FINALIZAR
// =====================================

document.getElementById("finalizar").addEventListener(
    "click",
    enviarCadastro
);
