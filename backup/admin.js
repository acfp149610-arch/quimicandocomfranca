// ===================================
// CONFIGURAÇÃO
// ===================================

const SUPABASE_URL = "https://kghzycpuvlidoenqnhhb.supabase.co";

const SUPABASE_KEY = "sb_publishable_IntMzNdV-nhtxW8czMBijA_4yVRgbIp";

const client = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    }
);

const $ = id => document.getElementById(id);


// ===================================
// MENSAGENS
// ===================================

function mensagem(texto) {
    $("mensagem").textContent = texto;
}


// ===================================
// ENVIAR LINK DE ACESSO
// ===================================

async function entrar() {

    const email = $("email").value.trim();

    if (!email) {
        mensagem("Digite seu e-mail.");
        return;
    }

    $("btnEntrar").disabled = true;
    mensagem("Enviando link...");

    try {

        const { error } = await client.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo:
                    "https://acfp149610-arch.github.io/admin.html"
            }
        });

        if (error) throw error;

        mensagem("Link enviado! Confira sua caixa de entrada.");

    } catch (error) {

        mensagem("Erro: " + error.message);

    } finally {

        $("btnEntrar").disabled = false;

    }
}


// ===================================
// VERIFICAR ADMINISTRADOR
// ===================================

async function verificarAdministrador() {

    const { data, error } = await client.auth.getSession();

    if (error || !data.session) return;

    const usuario = data.session.user;

    const { data: admin, error: erroAdmin } = await client
        .from("admins")
        .select("user_id")
        .eq("user_id", usuario.id)
        .maybeSingle();

    if (erroAdmin) {
        alert("Erro ao verificar acesso: " + erroAdmin.message);
        return;
    }

    if (!admin) {
        await client.auth.signOut();
        alert("Seu e-mail não está autorizado como administrador.");
        return;
    }

    $("login").hidden = true;
    $("painel").hidden = false;

    carregarContratacoes();
}


// ===================================
// SAIR
// ===================================

async function sair() {

    await client.auth.signOut();

    $("painel").hidden = true;
    $("login").hidden = false;

    mensagem("Você saiu do painel.");
}


// ===================================
// CARREGAR CONTRATAÇÕES
// ===================================

async function carregarContratacoes() {

    const lista = $("listaContratacoes");

    lista.textContent = "Carregando contratações...";

    const { data, error } = await client
        .from("contratacoes")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        lista.textContent = "Erro: " + error.message;
        return;
    }

    $("total").textContent = data.length;

    $("pendentes").textContent =
        data.filter(x => x.status === "Pendente").length;

    $("confirmados").textContent =
        data.filter(x => x.status === "Confirmado").length;

    lista.innerHTML = "";

    if (!data.length) {
        lista.textContent = "Nenhuma contratação encontrada.";
        return;
    }

    data.forEach(item => {

        const card = document.createElement("article");
        card.className = "contratacao";

        const titulo = document.createElement("h3");
        titulo.textContent = item.nome || "Sem nome";

        card.appendChild(titulo);

        const campos = [
            ["E-mail", item.email],
            ["Telefone", item.telefone],
            ["CPF", item.cpf],
            ["Curso", item.curso],
            ["Valor", item.valor],
            ["Status", item.status],
            ["Data", item.created_at]
        ];

        campos.forEach(([nome, valor]) => {

            const p = document.createElement("p");
            p.textContent = nome + ": " + (valor ?? "-");

            card.appendChild(p);

        });

        const acoes = document.createElement("div");
        acoes.className = "acoes";

        const ver = document.createElement("button");
        ver.textContent = "Ver comprovante";
        ver.onclick = () => verComprovante(item.comprovante);

        const confirmar = document.createElement("button");
        confirmar.className = "confirmar";
        confirmar.textContent = "Confirmar";
        confirmar.onclick = () => confirmarContratacao(item.id);

        const recusar = document.createElement("button");
        recusar.className = "recusar";
        recusar.textContent = "Recusar";
        recusar.onclick = () => recusarContratacao(item.id);

        acoes.append(ver, confirmar, recusar);
        card.appendChild(acoes);

        lista.appendChild(card);

    });
}


// ===================================
// VER COMPROVANTE
// ===================================

async function verComprovante(caminho) {

    if (!caminho) {
        alert("Comprovante não encontrado.");
        return;
    }

    const { data, error } = await client.storage
        .from("comprovantes")
        .createSignedUrl(caminho, 300);

    if (error) {
        alert("Erro: " + error.message);
        return;
    }

    window.open(data.signedUrl, "_blank");
}


// ===================================
// CONFIRMAR CONTRATAÇÃO
// ===================================

async function confirmarContratacao(id) {

    if (!confirm("Deseja confirmar esta contratação?")) return;

    const { data } = await client.auth.getSession();

    if (!data.session) {
        alert("Sessão expirada. Entre novamente.");
        return;
    }

    try {

        const resposta = await fetch(
            SUPABASE_URL + "/functions/v1/confirmar-contratacao",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization":
                        "Bearer " + data.session.access_token,
                    "apikey": SUPABASE_KEY
                },
                body: JSON.stringify({ id })
            }
        );

        const resultado = await resposta.json();

        if (!resposta.ok) {
            throw new Error(resultado.error || "Falha ao confirmar.");
        }

        alert("Contratação confirmada!");

        carregarContratacoes();

    } catch (error) {

        alert(error.message);

    }
}


// ===================================
// RECUSAR CONTRATAÇÃO
// ===================================

async function recusarContratacao(id) {

    if (!confirm("Deseja recusar esta contratação?")) return;

    const { error } = await client
        .from("contratacoes")
        .update({ status: "Recusado" })
        .eq("id", id);

    if (error) {
        alert("Erro: " + error.message);
        return;
    }

    alert("Contratação recusada.");

    carregarContratacoes();
}


// ===================================
// INICIAR
// ===================================

document.addEventListener("DOMContentLoaded", () => {

    $("btnEntrar").addEventListener("click", entrar);

    $("btnSair").addEventListener("click", sair);

    $("btnAtualizar").addEventListener(
        "click",
        carregarContratacoes
    );

    verificarAdministrador();

});
