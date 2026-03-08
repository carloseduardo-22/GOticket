require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Rotas
const authRoutes = require("./src/routes/auth.routes");
const ticketRoutes = require("./src/routes/ticket.routes");
const webhookRoutes = require("./src/routes/webhook.routes");

// API
app.use("/auth", authRoutes);
app.use("/tickets", ticketRoutes);
app.use("/webhook", webhookRoutes);

// Frontend
app.use(express.static(path.join(__dirname, "fullstack")));

// Página principal
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "fullstack", "index.html"));
});

// Porta
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🔥 Servidor rodando em http://localhost:${PORT}`);
});




