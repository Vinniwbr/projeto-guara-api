// ============================================================
// server.js — API REST do Projeto Guará
// ============================================================

const express = require("express");
const cors    = require("cors");
require("dotenv").config();

const pool = require("./db");
const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middlewares ─────────────────────────────────────────────

app.use(cors());           // Permite requisições do frontend
app.use(express.json());   // Parseia body JSON

// ─── Utilitário: resposta de erro padronizada ────────────────

function erroServidor(res, err, msg = "Erro interno do servidor") {
  console.error(msg, err.message);
  return res.status(500).json({ erro: msg });
}

// ============================================================
// ROTAS — USUÁRIOS
// ============================================================

// POST /usuarios — Cria um novo usuário
app.post("/usuarios", async (req, res) => {
  const { nome, username, email, foto_url } = req.body;

  if (!nome || !username || !email) {
    return res.status(400).json({ erro: "nome, username e email são obrigatórios." });
  }

  try {
    const resultado = await pool.query(
      `INSERT INTO usuarios (nome, username, email, foto_url)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [nome, username, email, foto_url || null]
    );
    res.status(201).json(resultado.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ erro: "Username ou e-mail já cadastrado." });
    }
    erroServidor(res, err, "Erro ao criar usuário");
  }
});

// GET /usuarios/:id — Busca um usuário por ID
app.get("/usuarios/:id", async (req, res) => {
  try {
    const resultado = await pool.query(
      "SELECT id, nome, username, email, foto_url, criado_em FROM usuarios WHERE id = $1",
      [req.params.id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }
    res.json(resultado.rows[0]);
  } catch (err) {
    erroServidor(res, err, "Erro ao buscar usuário");
  }
});

// ============================================================
// ROTAS — CHATS
// ============================================================

// GET /chats — Lista todos os chats com contagem de membros
app.get("/chats", async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        c.id,
        c.nome,
        c.tipo,
        c.criado_em,
        COUNT(cm.usuario_id) AS total_membros
      FROM chats c
      LEFT JOIN chat_membros cm ON cm.chat_id = c.id
      GROUP BY c.id
      ORDER BY c.criado_em ASC
    `);
    res.json(resultado.rows);
  } catch (err) {
    erroServidor(res, err, "Erro ao listar chats");
  }
});

// GET /chats/:id — Detalhes de um chat
app.get("/chats/:id", async (req, res) => {
  try {
    const resultado = await pool.query(
      "SELECT * FROM chats WHERE id = $1",
      [req.params.id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: "Chat não encontrado." });
    }
    res.json(resultado.rows[0]);
  } catch (err) {
    erroServidor(res, err, "Erro ao buscar chat");
  }
});

// ============================================================
// ROTAS — MENSAGENS
// ============================================================

// GET /chats/:id/mensagens — Lista as últimas N mensagens de um chat
// Query param opcional: ?limite=50
app.get("/chats/:id/mensagens", async (req, res) => {
  const limite = parseInt(req.query.limite) || 50;

  try {
    const resultado = await pool.query(`
      SELECT
        m.id,
        m.texto,
        m.criado_em,
        u.id         AS usuario_id,
        u.nome       AS autor,
        u.username,
        u.foto_url
      FROM mensagens m
      JOIN usuarios u ON u.id = m.usuario_id
      WHERE m.chat_id = $1
      ORDER BY m.criado_em ASC
      LIMIT $2
    `, [req.params.id, limite]);

    res.json(resultado.rows);
  } catch (err) {
    erroServidor(res, err, "Erro ao buscar mensagens");
  }
});

// POST /chats/:id/mensagens — Envia uma nova mensagem
app.post("/chats/:id/mensagens", async (req, res) => {
  const { usuario_id, texto } = req.body;

  if (!usuario_id || !texto) {
    return res.status(400).json({ erro: "usuario_id e texto são obrigatórios." });
  }
  if (texto.trim().length === 0) {
    return res.status(400).json({ erro: "Mensagem não pode ser vazia." });
  }

  try {
    // Verifica se o chat existe
    const chat = await pool.query("SELECT id FROM chats WHERE id = $1", [req.params.id]);
    if (chat.rows.length === 0) {
      return res.status(404).json({ erro: "Chat não encontrado." });
    }

    // Insere a mensagem
    const nova = await pool.query(`
      INSERT INTO mensagens (chat_id, usuario_id, texto)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [req.params.id, usuario_id, texto.trim()]);

    // Retorna a mensagem com dados do autor
    const completa = await pool.query(`
      SELECT
        m.id,
        m.texto,
        m.criado_em,
        u.id       AS usuario_id,
        u.nome     AS autor,
        u.username,
        u.foto_url
      FROM mensagens m
      JOIN usuarios u ON u.id = m.usuario_id
      WHERE m.id = $1
    `, [nova.rows[0].id]);

    res.status(201).json(completa.rows[0]);
  } catch (err) {
    erroServidor(res, err, "Erro ao enviar mensagem");
  }
});

// DELETE /mensagens/:id — Apaga uma mensagem (pelo autor)
app.delete("/mensagens/:id", async (req, res) => {
  const { usuario_id } = req.body;

  try {
    const resultado = await pool.query(
      "DELETE FROM mensagens WHERE id = $1 AND usuario_id = $2 RETURNING id",
      [req.params.id, usuario_id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: "Mensagem não encontrada ou sem permissão." });
    }
    res.json({ mensagem: "Mensagem apagada com sucesso." });
  } catch (err) {
    erroServidor(res, err, "Erro ao apagar mensagem");
  }
});

// ============================================================
// ROTAS — MEMBROS
// ============================================================

// POST /chats/:id/membros — Adiciona usuário ao chat
app.post("/chats/:id/membros", async (req, res) => {
  const { usuario_id } = req.body;
  if (!usuario_id) {
    return res.status(400).json({ erro: "usuario_id é obrigatório." });
  }
  try {
    await pool.query(
      "INSERT INTO chat_membros (chat_id, usuario_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [req.params.id, usuario_id]
    );
    res.status(201).json({ mensagem: "Membro adicionado." });
  } catch (err) {
    erroServidor(res, err, "Erro ao adicionar membro");
  }
});

// DELETE /chats/:id/membros/:usuario_id — Remove usuário do chat
app.delete("/chats/:id/membros/:usuario_id", async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM chat_membros WHERE chat_id = $1 AND usuario_id = $2",
      [req.params.id, req.params.usuario_id]
    );
    res.json({ mensagem: "Membro removido." });
  } catch (err) {
    erroServidor(res, err, "Erro ao remover membro");
  }
});

// ─── Rota raiz — painel de status ────────────────────────────
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
      <meta charset="UTF-8">
      <title>Guará API</title>
      <style>
        body { font-family: sans-serif; max-width: 600px; margin: 60px auto; color: #333; }
        h1   { color: #BB6D7B; }
        code { background: #f5f0f0; padding: 2px 7px; border-radius: 4px; font-size: 14px; }
        li   { margin: 8px 0; }
        .ok  { color: #3B6D11; font-weight: bold; }
      </style>
    </head>
    <body>
      <h1>🦅 Projeto Guará — API</h1>
      <p class="ok">✅ Servidor rodando na porta ${process.env.PORT || 3000}</p>
      <h2>Rotas disponíveis</h2>
      <ul>
        <li><code>GET  /chats</code> — lista todos os chats</li>
        <li><code>GET  /chats/:id/mensagens</code> — mensagens de um chat</li>
        <li><code>POST /chats/:id/mensagens</code> — enviar mensagem</li>
        <li><code>POST /usuarios</code> — criar usuário</li>
        <li><code>GET  /usuarios/:id</code> — buscar usuário</li>
        <li><code>GET  /health</code> — health check JSON</li>
      </ul>
      <p>Teste rápido: <a href="/health">/health</a> | <a href="/chats">/chats</a></p>
    </body>
    </html>
  `);
});

// ─── Health check ────────────────────────────────────────────
app.get("/health", (req, res) => res.json({ status: "ok" }));

// ─── Start ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Servidor Guará rodando em http://localhost:${PORT}`);
});