const parametros = new URLSearchParams(window.location.search);

const numeroCurso = parametros.get("curso");

const campoCurso = document.getElementById("curso");

if (numeroCurso === "1") {
    campoCurso.value = "Curso 1";
} else if (numeroCurso === "2") {
    campoCurso.value = "Curso 2";
} else {
    alert("Curso não identificado!");
}

document.getElementById("formCadastro").addEventListener("submit", function(event) {
    event.preventDefault();

    const dados = {
        nome: this.nome.value,
        email: this.email.value,
        telefone: this.telefone.value,
        cpf: this.cpf.value,
        curso: campoCurso.value,
        valor: 1.00
    };

    localStorage.setItem("dadosCliente", JSON.stringify(dados));

    window.location.href = "pagamento.html";
});
