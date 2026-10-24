require("dotenv").config();

const PORT = process.env.PORT || 3000;

const obrigatorias = ["JWT_SECRET", "MERCADO_PAGO_ACCESS_TOKEN"];
const faltando = obrigatorias.filter(nome => !process.env[nome]);

if (faltando.length) {
  console.error(`❌ Variáveis de ambiente ausentes: ${faltando.join(", ")}. Veja o arquivo .env.example`);
  process.exit(1);
}

module.exports = {
  PORT,
  JWT_SECRET: process.env.JWT_SECRET,
  MERCADO_PAGO_ACCESS_TOKEN: process.env.MERCADO_PAGO_ACCESS_TOKEN,
  // URL pública do site (no Render: https://goticket-l2y9.onrender.com)
  BASE_URL: (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, ""),
  // No Render, aponte para um disco persistente (ex: /var/data/database.db)
  DB_PATH: process.env.DB_PATH || "./database.db"
};
