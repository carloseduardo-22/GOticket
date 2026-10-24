const express = require("express");
const router = express.Router();

const ticketController = require("../controllers/ticketController");
const autenticarToken = require("../middlewares/authMiddleware");
const { autenticarAdmin } = require("../middlewares/authMiddleware");

// Ingressos só são criados pelo webhook do Mercado Pago após o pagamento aprovado
router.get("/my", autenticarToken, ticketController.myTickets);
router.get("/meus-ingressos", autenticarToken, ticketController.myTickets);

router.post("/validate", autenticarToken, autenticarAdmin, ticketController.validateTicket);

module.exports = router;
