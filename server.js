const { PORT } = require("./src/config/env");
const express = require("express");
const path = require("path");
const cors = require("cors");
const db = require("./src/database/db");

const app = express();

// No Render a aplicação fica atrás de um proxy: necessário para req.ip ser o IP real do visitante
app.set("trust proxy", 1);
app.disable("x-powered-by");

// Middlewares
app.use(cors());
app.use(express.json({ limit: "100kb" }));

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

// Só começa a receber requisições depois que o banco estiver pronto
db.pronto.then(() => {
  app.listen(PORT, () => {
    console.log(`🔥 Servidor rodando em http://localhost:${PORT}`);
  });
});
