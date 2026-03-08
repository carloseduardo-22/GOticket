const db = require("../database/db");

// 🎟️ Comprar ingresso
exports.buyTicket = (req, res) => {
  const { event, quantity, total } = req.body;
  const userId = req.userId;

  if (!event || !quantity || !total) {
    return res.status(400).json({
      error: "event, quantity e total são obrigatórios"
    });
  }

  const sql = `
    INSERT INTO tickets (user_id, event, quantity, total)
    VALUES (?, ?, ?, ?)
  `;

  db.run(sql, [userId, event, quantity, total], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).json({
        error: "Erro ao comprar ingresso"
      });
    }

    res.status(201).json({
      message: "Ingresso comprado com sucesso",
      ticketId: this.lastID
    });
  });
};

// 🎫 Meus ingressos
exports.myTickets = (req, res) => {
  const userId = req.userId;
   const query = `
    SELECT id, event, tipo, horario, local, qr_code 
    FROM tickets 
    WHERE user_id = ? 
    AND status = 'approved'
`;

    db.all(query, [userId], (err, rows) => {
        if (err) {
            console.error("Erro no SQL:", err.message);
            return res.status(500).json({ error: err.message });
        }
        
        console.log("Ingressos encontrados:", rows);
        res.json(rows);
    });

}


