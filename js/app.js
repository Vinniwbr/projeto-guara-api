// ============================================================
// app.js — Projeto Guará (frontend principal)
// Agenda + Chat + Perfil do usuário
// ============================================================

// ─── Configuração ─────────────────────────────────────────────
// Detecta automaticamente se está rodando local ou em produção
const API_URL = window.location.hostname === "localhost"
  ? "http://localhost:3000"
  : "https://projeto-guara-api.onrender.com";

// ─── Estado global ────────────────────────────────────────────
let token        = null;
let usuarioAtual = null;
let chatAtivo    = null;
let chatsCache   = [];
let eventosCache = [];
let googleStatus = null;

// ─── Utilitário: requisições à API ────────────────────────────
async function apiFetch(path, opcoes = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(API_URL + path, { headers, ...opcoes });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const e = await res.json(); msg = e.erro || msg; } catch (_) {}
    throw new Error(msg);
  }
  return res.json();
}

function formatarHora(dataISO) {
  const d = new Date(dataISO);
  return d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0");
}

// ═══════════════════════════════════════════════════════════════
// INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", async () => {
  // 1) Lê token da URL (?token=...) ou do localStorage
  const params = new URLSearchParams(window.location.search);
  token = params.get("token") || localStorage.getItem("guara_token");

  if (token) {
    localStorage.setItem("guara_token", token);
    // Limpa o token da URL sem causar reload
    if (params.has("token")) {
      const url = new URL(window.location);
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url);
    }
  }

  // 2) Carrega dados do usuário logado
  if (token) {
    try {
      await carregarUsuario();
    } catch (err) {
      console.warn("Token inválido ou expirado — limpando sessão.");
      token = null;
      localStorage.removeItem("guara_token");
    }
  }

  // 3) Monta o modal de chat
  criarModal();

  // 4) Carrega tudo em paralelo
  await Promise.all([
    atualizarInterfaceUsuario(),
    carregarStatusGoogle(),
    carregarChats(),
  ]);

  // 5) Carrega eventos da agenda se o Google estiver conectado
  if (googleStatus?.conectado && usuarioAtual) {
    await carregarEventos();
  }
});

// ═══════════════════════════════════════════════════════════════
// USUÁRIO
// ═══════════════════════════════════════════════════════════════

async function carregarUsuario() {
  // Tenta /usuarios/me primeiro (requer JWT válido)
  try {
    usuarioAtual = await apiFetch("/usuarios/me");
    return;
  } catch (_) {}

  // Fallback: tenta pelo ID salvo no localStorage
  const usuarioId = localStorage.getItem("guara_usuario_id");
  if (usuarioId) {
    try { usuarioAtual = await apiFetch(`/usuarios/${usuarioId}`); } catch (_) {}
  }
}

function atualizarInterfaceUsuario() {
  const footerFoto = document.querySelector(".explore__rodape--fotoUser");
  const footerNome = document.querySelector(".explore__rodape--nameUser");
  const configFoto = document.querySelector(".configuracoes__infoUser--fotoUser");
  const configNome = document.querySelector(".configuracoes__infoUser--nomeUser");
  const configId   = document.querySelector(".configuracoes__infoUser--id");

  if (usuarioAtual) {
    const nome     = usuarioAtual.nome     || "Usuário";
    const username = usuarioAtual.username || "user";
    const foto     = usuarioAtual.foto_url || "img/foto-user.png";

    if (footerFoto) footerFoto.src             = foto;
    if (footerNome) footerNome.textContent      = nome;
    if (configFoto) configFoto.src              = foto;
    if (configNome) configNome.textContent      = nome;
    if (configId)   configId.textContent        = `@${username}`;
  } else {
    // Usuário não logado — mostra botão de login
    if (footerNome) {
      footerNome.innerHTML = `<a href="${API_URL}/auth/login/google" style="color:white;text-decoration:underline;font-size:13px;">Entrar com Google</a>`;
    }
    if (configNome) configNome.textContent = "Convidado";
    if (configId)   configId.textContent   = "@guest";
  }
}

// ═══════════════════════════════════════════════════════════════
// AGENDA (Google Calendar)
// ═══════════════════════════════════════════════════════════════

async function carregarStatusGoogle() {
  if (!usuarioAtual?.id) {
    googleStatus = { conectado: false };
    atualizarCardAgenda();
    return;
  }
  try {
    googleStatus = await apiFetch(`/usuarios/${usuarioAtual.id}/google/status`);
  } catch (_) {
    googleStatus = { conectado: false };
  }
  atualizarCardAgenda();
}

async function carregarEventos() {
  if (!usuarioAtual?.id) return;
  try {
    eventosCache = await apiFetch(`/usuarios/${usuarioAtual.id}/eventos`);
  } catch (err) {
    console.warn("Erro ao carregar eventos:", err.message);
    eventosCache = [];
    if (err.message?.includes("USUARIO_SEM_GOOGLE_CONECTADO")) {
      googleStatus = { conectado: false };
    }
  }
  atualizarCardAgenda();
}

function atualizarCardAgenda() {
  const card = document.querySelector(".principal__superior--agenda");
  if (!card) return;

  const concluidas = card.querySelector(".superior__agenda--atividadesConcluidas");
  const espera     = card.querySelector(".superior__agenda--atividadesEmEspera");
  const paragrafo  = card.querySelector(".superior__agenda--paragrafo");

  // Remove lista anterior de eventos, se houver
  card.querySelector(".agenda__eventos-lista")?.remove();

  // Caso 1: usuário não logado
  if (!usuarioAtual) {
    if (concluidas) concluidas.innerHTML = `<i></i>—`;
    if (espera)     espera.innerHTML     = `<i></i><a href="${API_URL}/auth/login/google" style="color:#fff;text-decoration:underline;">Entrar com Google</a>`;
    if (paragrafo)  paragrafo.textContent = "Faça login para ver sua agenda.";
    return;
  }

  // Caso 2: Google Calendar não conectado
  if (!googleStatus?.conectado) {
    if (concluidas) concluidas.innerHTML = `<i></i>❌ Não conectada`;
    if (espera)     espera.innerHTML     = `<i></i>🔗 <a href="#" id="conectar-google" style="color:#fff;text-decoration:underline;">Conectar Google Agenda</a>`;
    if (paragrafo)  paragrafo.textContent = "Conecte sua conta Google para sincronizar eventos.";

    const link = document.getElementById("conectar-google");
    if (link) {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        conectarGoogle();
      });
    }
    return;
  }

  // Caso 3: conectado, mostra eventos
  if (paragrafo) paragrafo.textContent = "Próximos eventos da sua agenda sincronizada.";

  const agora    = new Date();
  const passados = eventosCache.filter((e) => new Date(e.inicio) < agora);
  const futuros  = eventosCache.filter((e) => new Date(e.inicio) >= agora);

  if (concluidas) concluidas.innerHTML = `<i></i>${passados.length} concluídas`;
  if (espera)     espera.innerHTML     = `<i></i>${futuros.length} em espera`;

  if (futuros.length === 0) return;

  // Renderiza lista dos próximos 3 eventos
  const lista = document.createElement("div");
  lista.className = "agenda__eventos-lista";

  futuros.slice(0, 3).forEach((ev) => {
    const data = new Date(ev.inicio);
    const hora = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const dia  = data.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });

    const item = document.createElement("div");
    item.className = "agenda__eventos-item";
    item.innerHTML = `
      <span class="agenda__eventos-horario">${dia} ${hora}</span>
      <span class="agenda__eventos-titulo">${ev.titulo}</span>
      ${ev.linkMeet
        ? `<a href="${ev.linkMeet}" target="_blank" class="agenda__eventos-meet" title="Abrir Google Meet">🎥</a>`
        : ""}
    `;
    lista.appendChild(item);
  });

  if (futuros.length > 3) {
    const mais = document.createElement("div");
    mais.className = "agenda__eventos-mais";
    mais.textContent = `+${futuros.length - 3} evento(s) na agenda`;
    lista.appendChild(mais);
  }

  card.appendChild(lista);
}

// Redireciona para o OAuth do Google Calendar
// Funciona via JWT: o backend lê o usuário do token, não precisa passar usuario_id na URL
function conectarGoogle() {
  if (!usuarioAtual?.id) {
    alert("Faça login primeiro.");
    return;
  }
  if (!token) {
    alert("Sessão expirada. Faça login novamente.");
    window.location.href = `${API_URL}/auth/login/google`;
    return;
  }
  // A rota /auth/google usa o JWT para identificar o usuário
  // Como é um redirect de navegador (não fetch), não dá pra mandar header Authorization
  // Então passamos o token via query string — o backend vai ler e validar
  window.location.href = `${API_URL}/auth/google?token=${token}`;
}

// ═══════════════════════════════════════════════════════════════
// CHATS
// ═══════════════════════════════════════════════════════════════

async function carregarChats() {
  try {
    chatsCache = await apiFetch("/chats");
    atualizarCardsChat(chatsCache);
    vincularCardsChat();
  } catch (err) {
    console.error("Erro ao carregar chats:", err.message);
  }
}

function atualizarCardsChat(chats) {
  const mapa = {
    direcao:  { membros: ".superior__chatDirecao--members",  online: ".superior__chatDirecao--usersOn" },
    turma:    { membros: ".inferior__chatTurma--members" },
    amigavel: { membros: ".inferior__chatAmigavel--members" },
  };

  chats.forEach((chat) => {
    const s = mapa[chat.tipo];
    if (!s) return;
    if (s.membros) {
      const el = document.querySelector(s.membros);
      if (el) el.innerHTML = `<i></i>${Number(chat.total_membros || 0).toLocaleString("pt-BR")} Membros`;
    }
    if (s.online) {
      const el = document.querySelector(s.online);
      if (el) el.innerHTML = `<i></i>${Number(chat.total_membros || 0).toLocaleString("pt-BR")} Online`;
    }
  });
}

function vincularCardsChat() {
  const seletorParaTipo = {
    ".principal__superior--chatDirecao": "direcao",
    ".principal__inferior--chatTurma":   "turma",
    ".principal__inferior--chatAmigavel":"amigavel",
  };

  Object.entries(seletorParaTipo).forEach(([seletor, tipo]) => {
    const card = document.querySelector(seletor);
    if (!card) return;
    const chat = chatsCache.find((c) => c.tipo === tipo);
    if (!chat) return;

    card.style.cursor = "pointer";
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Abrir ${chat.nome}`);

    card.onclick = (e) => { e.preventDefault(); abrirChat(chat); };
    card.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") abrirChat(chat); };
  });
}

// ═══════════════════════════════════════════════════════════════
// MODAL DE CHAT
// ═══════════════════════════════════════════════════════════════

function criarModal() {
  if (document.getElementById("guara-overlay")) return; // evita duplicata

  const overlay = document.createElement("div");
  overlay.id = "guara-overlay";
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.35);
    display:flex;align-items:center;justify-content:center;
    z-index:1000;opacity:0;pointer-events:none;transition:opacity 0.2s;
  `;
  overlay.innerHTML = `
    <div id="guara-modal" role="dialog" aria-modal="true" aria-labelledby="guara-modal-titulo" style="
      background:#fff;border-radius:16px;width:440px;max-width:95vw;
      box-shadow:rgba(100,100,111,.22) 0 8px 32px 0;
      display:flex;flex-direction:column;max-height:90vh;overflow:hidden;
    ">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px 12px;border-bottom:1px solid #f0e8e8;">
        <h2 id="guara-modal-titulo" style="font-size:16px;font-family:'Henny Penny',serif;color:#BB6D7B;margin:0;"></h2>
        <button id="guara-fechar" aria-label="Fechar chat" style="background:none;border:none;cursor:pointer;font-size:20px;color:#888;line-height:1;padding:0 4px;">✕</button>
      </div>
      <div id="guara-mensagens" style="flex:1;padding:16px 20px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;min-height:200px;max-height:340px;">
        <p style="color:#aaa;font-size:13px;text-align:center;">Carregando mensagens...</p>
      </div>
      <div style="padding:12px 20px 16px;border-top:1px solid #f0e8e8;display:flex;gap:8px;">
        <input id="guara-input" placeholder="Digite uma mensagem..." autocomplete="off"
          style="flex:1;border:1px solid #e0d0d0;border-radius:20px;padding:9px 15px;font-family:'Comfortaa',sans-serif;font-size:13px;outline:none;">
        <button id="guara-enviar"
          style="background:#c16a61;color:#fff;border:none;border-radius:20px;padding:9px 18px;font-family:'Comfortaa',sans-serif;font-size:13px;cursor:pointer;">
          Enviar
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (e) => { if (e.target === overlay) fecharChat(); });
  document.getElementById("guara-fechar").addEventListener("click", fecharChat);
  document.getElementById("guara-enviar").addEventListener("click", enviarMensagem);
  document.getElementById("guara-input").addEventListener("keydown", (e) => { if (e.key === "Enter") enviarMensagem(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && chatAtivo) fecharChat(); });
}

async function abrirChat(chat) {
  chatAtivo = chat;
  document.getElementById("guara-modal-titulo").textContent = chat.nome;
  const overlay = document.getElementById("guara-overlay");
  overlay.style.opacity = "1";
  overlay.style.pointerEvents = "all";
  removerNotificacao(chat.tipo);
  await carregarMensagens(chat.id);
  setTimeout(() => document.getElementById("guara-input")?.focus(), 50);
}

function fecharChat() {
  const overlay = document.getElementById("guara-overlay");
  if (!overlay) return;
  overlay.style.opacity = "0";
  overlay.style.pointerEvents = "none";
  chatAtivo = null;
}

async function carregarMensagens(chatId) {
  const container = document.getElementById("guara-mensagens");
  container.innerHTML = `<p style="color:#aaa;font-size:13px;text-align:center;">Carregando...</p>`;
  try {
    const msgs = await apiFetch(`/chats/${chatId}/mensagens?limite=50`);
    renderizarMensagens(msgs);
  } catch (err) {
    container.innerHTML = `<p style="color:#EA444F;font-size:13px;text-align:center;">Erro ao carregar mensagens.</p>`;
  }
}

function renderizarMensagens(mensagens) {
  const container = document.getElementById("guara-mensagens");
  if (mensagens.length === 0) {
    container.innerHTML = `<p style="color:#aaa;font-size:13px;text-align:center;">Nenhuma mensagem ainda. Seja o primeiro!</p>`;
    return;
  }

  const idUsuario = usuarioAtual?.id;
  container.innerHTML = mensagens.map((m) => {
    const souEu = m.usuario_id === idUsuario;
    return `
      <div style="
        align-self:${souEu ? "flex-end" : "flex-start"};
        max-width:80%;
        background:${souEu ? "#F0C6BF66" : "#f5f0f0"};
        border-radius:${souEu ? "14px 14px 4px 14px" : "14px 14px 14px 4px"};
        padding:9px 13px;font-size:13px;line-height:1.5;color:#333;
      ">
        ${souEu ? "" : `<span style="font-size:10px;color:#BB6D7B;font-weight:600;display:block;margin-bottom:2px;">${m.autor}</span>`}
        ${m.texto}
        <span style="font-size:10px;color:#aaa;display:block;text-align:right;margin-top:3px;">${formatarHora(m.criado_em)}</span>
      </div>
    `;
  }).join("");
  container.scrollTop = container.scrollHeight;
}

async function enviarMensagem() {
  const input = document.getElementById("guara-input");
  const texto = input.value.trim();
  if (!texto || !chatAtivo) return;

  if (!usuarioAtual?.id) {
    alert("Você precisa estar logado para enviar mensagens.");
    return;
  }

  // Optimistic UI — mostra a mensagem imediatamente, antes da confirmação do servidor
  const container = document.getElementById("guara-mensagens");
  const temp = document.createElement("div");
  temp.style.cssText = "align-self:flex-end;max-width:80%;background:#F0C6BF66;border-radius:14px 14px 4px 14px;padding:9px 13px;font-size:13px;color:#aaa;";
  temp.textContent = texto + " ✓";
  container.appendChild(temp);
  container.scrollTop = container.scrollHeight;
  input.value = "";

  try {
    await apiFetch(`/chats/${chatAtivo.id}/mensagens`, {
      method: "POST",
      body: JSON.stringify({ usuario_id: usuarioAtual.id, texto }),
    });
    temp.remove();
    await carregarMensagens(chatAtivo.id);
  } catch (err) {
    temp.style.color = "#EA444F";
    temp.textContent = texto + " ✗ (falha ao enviar)";
    console.error("Erro ao enviar mensagem:", err.message);
  }
}

// ─── Notificações nos cards ──────────────────────────────────

function removerNotificacao(tipo) {
  const dot = document.querySelector(`[data-tipo-chat="${tipo}"] .notif-dot`);
  dot?.remove();
}