const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./database.db");

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT UNIQUE,
            password TEXT
        )
    `);
    db.run("ALTER TABLE users ADD COLUMN reset_token TEXT", (err) => {
        if (err) console.log("Coluna reset_token já existe ou erro:", err.message);
    });
    
    db.run("ALTER TABLE users ADD COLUMN reset_expires DATETIME", (err) => {
        if (err) console.log("Coluna reset_expires já existe ou erro:", err.message);
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        event TEXT,
        qr_code TEXT,
        used INTEGER DEFAULT 0,
        payment_id TEXT
        )
    `);
    db.run(`
  CREATE TABLE IF NOT EXISTS pagamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id TEXT,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
db.run("ALTER TABLE tickets ADD COLUMN quantity INTEGER DEFAULT 1", (err) => {
        if (err) console.log("Coluna quantity já existe.");
    });
    db.run("ALTER TABLE tickets ADD COLUMN total REAL DEFAULT 0", (err) => {
        if (err) console.log("Coluna total já existe.");
    });
    db.run("ALTER TABLE tickets ADD COLUMN status TEXT DEFAULT 'pending'", (err) => {
        if (err) console.log("Coluna status já existe.");
    });

});

module.exports = db;


