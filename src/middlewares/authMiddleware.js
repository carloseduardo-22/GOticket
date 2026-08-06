const jwt = require("jsonwebtoken");
const db  = require("../database/db");

const autenticarToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Token mal formatado" });
  }

  try {
    const decoded = jwt.verify(token, "supersecreta123");
    req.userId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
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
