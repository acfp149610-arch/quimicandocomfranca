// CONTRATAÇÃO DOS CURSOS

document.querySelectorAll("#cursos button").forEach((botao) => {

    botao.addEventListener("click", () => {

        const curso = botao.dataset.curso;

        window.location.href = `dados.html?curso=${curso}`;

    });

});


// ANIMAÇÃO DAS SEÇÕES

const observador = new IntersectionObserver((elementos) => {

    elementos.forEach((elemento) => {

        if (elemento.isIntersecting) {

            elemento.target.style.opacity = "1";
            elemento.target.style.transform = "translateY(0)";

        }

    });

}, {
    threshold: 0.15
});


document.querySelectorAll("section").forEach((secao) => {

    secao.style.opacity = "0";
    secao.style.transform = "translateY(30px)";
    secao.style.transition = "opacity 0.8s ease, transform 0.8s ease";

    observador.observe(secao);

});
