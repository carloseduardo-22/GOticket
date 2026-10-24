const sqlite3 = require("sqlite3").verbose();
const crypto = require("crypto");
const { DB_PATH } = require("../config/env");
const { gerarQRCode } = require("../utils/qrcode");

const db = new sqlite3.Database(DB_PATH);

// Versões com Promise de db.run / db.get / db.all
db.runAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

db.getAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });

db.allAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

// Adiciona as colunas que faltam em bancos criados com versões antigas do schema
async function garantirColunas(tabela, colunas) {
  const existentes = (await db.allAsync(`PRAGMA table_info(${tabela})`)).map(c => c.name);

  for (const [nome, definicao] of Object.entries(colunas)) {
    if (!existentes.includes(nome)) {
      await db.runAsync(`ALTER TABLE ${tabela} ADD COLUMN ${nome} ${definicao}`);
      console.log(`🛠️  Coluna ${tabela}.${nome} adicionada`);
    }
  }
}

async function inicializar() {
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT
    )
  `);
  await garantirColunas("users", {
    reset_token: "TEXT",
    reset_expires: "DATETIME",
    role: "TEXT DEFAULT 'user'",
    created_at: "DATETIME",
    consent_at: "DATETIME",       // quando aceitou os Termos e a Política de Privacidade
    consent_version: "TEXT",      // qual versão dos textos foi aceita
    deleted_at: "DATETIME"        // conta excluída a pedido do titular (dados pessoais apagados)
  });

  // O login passou a tratar o e-mail sempre em minúsculas
  await db.runAsync("UPDATE OR IGNORE users SET email = lower(trim(email)) WHERE email != lower(trim(email))");

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS eventos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      descricao TEXT,
      local TEXT,
      data TEXT,
      imagem TEXT,
      preco_inteira REAL DEFAULT 0,
      preco_meia REAL DEFAULT 0,
      preco_camarote REAL DEFAULT 0
    )
  `);

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      event TEXT
    )
  `);
  await garantirColunas("tickets", {
    evento_id: "INTEGER",
    type: "TEXT",
    quantity: "INTEGER DEFAULT 1",
    total: "REAL DEFAULT 0",
    status: "TEXT DEFAULT 'pending'",
    qr_code: "TEXT",
    qr_token: "TEXT",
    used: "INTEGER DEFAULT 0",
    used_at: "DATETIME",
    payment_id: "TEXT"
  });
  await db.runAsync("CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_qr_token ON tickets(qr_token)");

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS pagamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id TEXT,
      status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await garantirColunas("pagamentos", {
    preference_id: "TEXT",
    user_id: "INTEGER",
    evento_id: "INTEGER",
    items: "TEXT"
  });

  // Ingressos aprovados antigos não têm token: gera um para que possam ser validados
  const semToken = await db.allAsync(
    "SELECT id FROM tickets WHERE status = 'approved' AND qr_token IS NULL"
  );
  for (const ticket of semToken) {
    const token = crypto.randomUUID();
    const qrCode = await gerarQRCode(token);
    await db.runAsync("UPDATE tickets SET qr_token = ?, qr_code = ? WHERE id = ?", [token, qrCode, ticket.id]);
  }
  if (semToken.length) console.log(`🛠️  ${semToken.length} ingresso(s) antigo(s) receberam QR Code novo`);
}

db.pronto = inicializar().catch(err => {
  console.error("❌ Erro ao inicializar o banco:", err);
  process.exit(1);
});

module.exports = db;
