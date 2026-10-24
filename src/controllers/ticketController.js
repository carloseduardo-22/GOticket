const db = require("../database/db");

// 🎫 Meus ingressos
exports.myTickets = (req, res) => {
  const userId = req.userId;
  const query = `
    SELECT id, event, evento_id, type, quantity, total, status, qr_code, used, used_at
    FROM tickets
    WHERE user_id = ?
    AND status = 'approved'
    ORDER BY id DESC
  `;

  db.all(query, [userId], (err, rows) => {
    if (err) {
      console.error("Erro no SQL:", err.message);
      return res.status(500).json({ error: "Erro ao buscar ingressos" });
    }
    res.json(rows);
  });
};

// ✅ Validar ingresso na entrada (somente admin). Recebe o token lido do QR Code.
exports.validateTicket = async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Token do ingresso é obrigatório" });
  }

  try {
    const ticket = await db.getAsync(
      "SELECT id, event, type, status, used, used_at FROM tickets WHERE qr_token = ?",
      [token]
    );

    if (!ticket || ticket.status !== "approved") {
      return res.status(404).json({ error: "Ingresso inválido" });
    }

    // A condição used = 0 no UPDATE impede que duas leituras simultâneas aprovem o mesmo ingresso
    const { changes } = await db.runAsync(
      "UPDATE tickets SET used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ? AND used = 0",
      [ticket.id]
    );

    if (changes === 0) {
      return res.status(400).json({ error: "Ingresso já utilizado", used_at: ticket.used_at });
    }

    res.json({ success: true, ticket: { id: ticket.id, event: ticket.event, type: ticket.type } });
  } catch (err) {
    console.error("Erro ao validar ingresso:", err);
    res.status(500).json({ error: "Erro ao validar ingresso" });
  }
};
