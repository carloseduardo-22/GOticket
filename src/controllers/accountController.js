const db = require("../database/db");
const bcrypt = require("bcryptjs");

// Direitos do titular previstos no art. 18 da LGPD:
// acesso, correção, portabilidade e eliminação dos dados pessoais.

// --- VER MEUS DADOS ---
exports.verPerfil = async (req, res) => {
  try {
    const user = await db.getAsync(
      `SELECT id, name, email, created_at, consent_at, consent_version
       FROM users WHERE id = ? AND deleted_at IS NULL`,
      [req.userId]
    );
    if (!user) return res.status(404).json({ error: "Conta não encontrada" });
    res.json(user);
  } catch (err) {
    console.error("Erro ao buscar perfil:", err.message);
    res.status(500).json({ error: "Erro ao buscar seus dados" });
  }
};

// --- CORRIGIR DADOS ---
exports.atualizarPerfil = async (req, res) => {
  try {
    await db.runAsync("UPDATE users SET name = ? WHERE id = ? AND deleted_at IS NULL", [req.body.name, req.userId]);
    res.json({ message: "Dados atualizados", name: req.body.name });
  } catch (err) {
    console.error("Erro ao atualizar perfil:", err.message);
    res.status(500).json({ error: "Erro ao atualizar seus dados" });
  }
};

// --- EXPORTAR DADOS (portabilidade) ---
exports.exportarDados = async (req, res) => {
  try {
    const conta = await db.getAsync(
      `SELECT id, name, email, role, created_at, consent_at, consent_version
       FROM users WHERE id = ? AND deleted_at IS NULL`,
      [req.userId]
    );
    if (!conta) return res.status(404).json({ error: "Conta não encontrada" });

    const ingressos = await db.allAsync(
      `SELECT id, event, evento_id, type, total, status, used, used_at, payment_id
       FROM tickets WHERE user_id = ?`,
      [req.userId]
    );
    const pedidos = await db.allAsync(
      `SELECT id, evento_id, status, payment_id, items, created_at
       FROM pagamentos WHERE user_id = ?`,
      [req.userId]
    );

    const dados = {
      gerado_em: new Date().toISOString(),
      controlador: "GoTicket",
      conta,
      ingressos,
      pedidos: pedidos.map(p => ({ ...p, items: JSON.parse(p.items || "[]") }))
    };

    res.set("Content-Disposition", `attachment; filename="meus-dados-goticket.json"`);
    res.json(dados);
  } catch (err) {
    console.error("Erro ao exportar dados:", err.message);
    res.status(500).json({ error: "Erro ao exportar seus dados" });
  }
};

// --- EXCLUIR CONTA (eliminação) ---
// Os dados pessoais são apagados. Ingressos e pedidos continuam no banco sem
// nome nem e-mail, porque registros de venda precisam ser guardados por
// obrigação legal e fiscal (art. 16, I da LGPD).
exports.excluirConta = async (req, res) => {
  const { password } = req.body;

  try {
    const user = await db.getAsync(
      "SELECT id, password FROM users WHERE id = ? AND deleted_at IS NULL",
      [req.userId]
    );
    if (!user) return res.status(404).json({ error: "Conta não encontrada" });

    if (!password || !(await bcrypt.compare(password, user.password || ""))) {
      // 403 e não 401: a sessão continua válida, só a confirmação falhou
      return res.status(403).json({ error: "Senha incorreta" });
    }

    await db.runAsync(
      `UPDATE users SET
         name = 'Conta excluída',
         email = 'excluido-' || id || '@goticket.invalid',
         password = NULL,
         reset_token = NULL,
         reset_expires = NULL,
         deleted_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [user.id]
    );

    res.json({ message: "Sua conta e seus dados pessoais foram excluídos." });
  } catch (err) {
    console.error("Erro ao excluir conta:", err.message);
    res.status(500).json({ error: "Erro ao excluir a conta" });
  }
};
