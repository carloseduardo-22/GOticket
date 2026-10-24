const jwt = require("jsonwebtoken");
const db  = require("../database/db");
const { JWT_SECRET } = require("../config/env");

const autenticarToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Token mal formatado" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }

  // Garante que a conta ainda existe (uma conta excluída não pode usar o token antigo)
  db.get("SELECT id FROM users WHERE id = ? AND deleted_at IS NULL", [decoded.id], (err, user) => {
    if (err) return res.status(500).json({ error: "Erro no servidor" });
    if (!user) return res.status(401).json({ error: "Sessão inválida. Faça login novamente." });
    req.userId = user.id;
    next();
  });
};

const autenticarAdmin = (req, res, next) => {
  db.get("SELECT role FROM users WHERE id = ?", [req.userId], (err, user) => {
    if (err || !user || user.role !== "admin") {
      return res.status(403).json({ error: "Acesso restrito a administradores" });
    }
    next();
  });
};

module.exports = autenticarToken;
module.exports.autenticarAdmin = autenticarAdmin;
