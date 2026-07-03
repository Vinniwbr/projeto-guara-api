// ============================================================
// js/settings.js — Toggle da aba de configurações (sidebar)
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  const botaoExplore = document.querySelector(".explore__rodape--button");
  const abaConfiguracoes = document.querySelector(".configuracoes");
  const abaPrincipal = document.querySelector(".principal");

  if (!botaoExplore || !abaConfiguracoes || !abaPrincipal) return;

  botaoExplore.addEventListener("click", () => {
    if (abaConfiguracoes.style.display === "none") {
      abaConfiguracoes.style.display = "revert";
      abaPrincipal.style.width = "75%";
    } else {
      abaConfiguracoes.style.display = "none";
      abaPrincipal.style.width = "100%";
      abaPrincipal.style.transition = "0.3s";
    }
  });
});
