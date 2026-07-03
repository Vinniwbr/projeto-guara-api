// Aba de configuracoes do user
//const botaoExplore = document.querySelector('.explore__rodape--button');
//const abaConfiguracoes = document.querySelector('.configuracoes');
//const abaPrincipal = document.querySelector('.principal')

//botaoExplore.addEventListener('click', function() {

  //  if (abaConfiguracoes.style.display !== 'revert') {
    //    abaConfiguracoes.style.display = 'revert';
      //  abaPrincipal.style.width = '75%';
        //abaPrincipal.style.transition = '0.3s';
    //} else {
      //  abaConfiguracoes.style.display = 'none';
        //abaPrincipal.style.width = '100%';
        //abaPrincipal.style.transition = '0.3s';
    //}

//});

document.addEventListener("DOMContentLoaded", () => {

    // =========================================================
    // 1. LÓGICA DA ENGRENAGEM (ABRIR/FECHAR CONFIGURAÇÕES)
    // =========================================================
    const botaoExplore = document.querySelector('.explore__rodape--button');
    const abaConfiguracoes = document.querySelector('.configuracoes');

    botaoExplore.addEventListener('click', function() {
        const abas = document.querySelectorAll('.conteudo-painel');
        
        if (abaConfiguracoes.style.display !== 'revert') {
            abaConfiguracoes.style.display = 'revert';
            abas.forEach(aba => {
                aba.style.width = '75%';
                aba.style.transition = '0.3s';
            });
        } else {
            abaConfiguracoes.style.display = 'none';
            abas.forEach(aba => {
                aba.style.width = '100%';
                aba.style.transition = '0.3s';
            });
        }
    });

    // =========================================================
    // 2. LÓGICA DE ALTERNAR AS ABAS DO MENU LATERAL
    // =========================================================
    const linksMenu = document.querySelectorAll(".explore__menuNav--list a");
    const todasAsAbas = document.querySelectorAll(".conteudo-painel");

    linksMenu.forEach(link => {
        link.addEventListener("click", (event) => {
            event.preventDefault(); 

            const idAbaAlvo = link.getAttribute("data-aba");
            todasAsAbas.forEach(aba => {
                aba.classList.add("oculto");
            });

            const abaAlvo = document.getElementById(idAbaAlvo);
            if (abaAlvo) {
                abaAlvo.classList.remove("oculto");
            }
        });
    });

}); 