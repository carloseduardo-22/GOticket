const express = require("express");
const router = express.Router();

// Importação dos arquivos (Certifique-se que os nomes dos arquivos na pasta estão corretos)
const ticketController = require("../controllers/ticketController");
const autenticarToken = require("../middlewares/authMiddleware");
const db = require("../database/db");

// Rota para comprar ingresso
// Usei "buyTicket" pois parece ser o nome mais comum em controllers
router.post("/buy", autenticarToken, ticketController.buyTicket);
router.get("/my", autenticarToken, ticketController.myTickets);
router.get("/meus-ingressos", autenticarToken, ticketController.myTickets);

router.post("/validate", (req, res) => {
  const { ticketId } = req.body;

  db.get(
    "SELECT * FROM tickets WHERE id = ?",
    [ticketId],
    (err, ticket) => {
      if (!ticket) {
        return res.status(404).json({ error: "Ingresso inválido" });
      }

      if (ticket.used) {
        return res.status(400).json({ error: "Ingresso já utilizado" });
      }

      db.run(
        "UPDATE tickets SET used = 1 WHERE id = ?",
        [ticketId]
      );

      res.json({ success: true });
    }
  );
});


module.exports = router;
