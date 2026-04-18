const db = require("../database/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const { MercadoPagoConfig, Preference } = require('mercadopago');
const client = new MercadoPagoConfig({ accessToken: 'TEST-1783477078293568-012018-884ac3828e5779c6e0f69ec06de45b42-2487509162' });

// --- FUNÇÃO DE REGISTRO ---
exports.register = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Todos os campos (name, email, password) são obrigatórios" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = `INSERT INTO users (name, email, password) VALUES (?, ?, ?)`;

    db.run(sql, [name, email, hashedPassword], function (err) {
      if (err) {
        return res.status(400).json({ error: "Email já cadastrado" });
      }
      res.status(201).json({
        message: "Usuário criado com sucesso",
        id: this.lastID
      });
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao processar senha" });
  }
};

// --- FUNÇÃO DE LOGIN ---
exports.login = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ erros: errors.array() });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email e senha obrigatórios" });
  }

  const sql = "SELECT * FROM users WHERE email = ?";

  db.get(sql, [email], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: "Erro no servidor" });
    }

    if (!user) {
      return res.status(401).json({ error: "Usuário não encontrado" });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: "Senha incorreta" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
     "supersecreta123",
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login realizado com sucesso",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  });
};
// 1. Rota para pedir a recuperação
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    // Aqui você verificaria no banco se o e-mail existe
    // Geraria um token único e salvaria no banco com expiração
    res.json({ message: "Se o e-mail existir, um link de recuperação será enviado." });
};

// 2. Rota para salvar a nova senha
exports.resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;
    // Aqui você validaria o token e faria o UPDATE da senha no banco
    res.json({ message: "Senha alterada com sucesso!" });
};
const crypto = require("crypto"); // Já vem no Node.js

// 1. SOLICITAR RECUPERAÇÃO
exports.forgotPassword = (req, res) => {
    const { email } = req.body;

    // Verifica se o usuário existe
    db.get("SELECT id FROM users WHERE email = ?", [email], (err, user) => {
        if (err || !user) {
            // Por segurança, não confirmamos se o e-mail existe ou não
            return res.json({ message: "Se o e-mail estiver cadastrado, um link foi enviado." });
        }

        // Cria um token aleatório e uma expiração (1 hora)
        const token = crypto.randomBytes(20).toString("hex");
        const expires = new Date(Date.now() + 3600000); // 1 hora a partir de agora

        // Salva o token no banco para este usuário
        db.run(
            "UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?",
            [token, expires, user.id],
            (updateErr) => {
                if (updateErr) return res.status(500).json({ error: "Erro no servidor" });

                // SIMULAÇÃO DE ENVIO DE E-MAIL
                console.log("\n--- RECUPERAÇÃO DE SENHA ---");
                console.log(`Para o e-mail: ${email}`);
                console.log(`Link: http://localhost:3000/reset-password.html?token=${token}`);
                console.log("----------------------------\n");

                res.json({ message: "Link de recuperação enviado (verifique o console do VS Code)." });
            }
        );
    });
};

// 2. SALVAR NOVA SENHA
exports.resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;

    db.get(
        "SELECT id FROM users WHERE reset_token = ? AND reset_expires > ?",
        [token, new Date()],
        async (err, user) => {
            if (err || !user) {
                return res.status(400).json({ error: "Token inválido ou expirado." });
            }

            try {
                // IMPORTANTE: Criptografa a nova senha antes de salvar
                // Se o seu login usa hash, o reset TAMBÉM precisa usar
                const saltRounds = 10;
                const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

                db.run(
                    "UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?",
                    [hashedPassword, user.id],
                    (updateErr) => {
                        if (updateErr) return res.status(500).json({ error: "Erro ao atualizar senha." });
                        res.json({ message: "Senha alterada com sucesso! Agora pode fazer login." });
                    }
                );
            } catch (hashErr) {
                res.status(500).json({ error: "Erro ao processar senha." });
            }
        }
    );
};

exports.criarPagamento = async (req, res) => {
  try {
    const { evento, items } = req.body;
    const userId =
      req.userId ||
      (req.user ? req.user.id : null) ||
      (req.usuario ? req.usuario.id : null);

    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    if (!evento || !Array.isArray(items)) {
      return res.status(400).json({
        error: "Evento e items são obrigatórios"
      });
    }

    const itensValidados = items
      .filter(item => Number(item.quantity) > 0)
      .map(item => ({
        title: item.title,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        currency_id: "BRL"
      }));

    if (itensValidados.length === 0) {
      return res.status(400).json({ error: "Nenhum ingresso selecionado" });
    }

    const preference = new Preference(client);

    const body = {
      items: itensValidados,
      metadata: {
        user_id: userId,
        evento,
        items: itensValidados
      },
      back_urls: {
        success: "https://goticket-l2y9.onrender.com/pagamento/retorno.html",
        failure: "https://goticket-l2y9.onrender.com/pagamento/retorno.html",
        pending: "https://goticket-l2y9.onrender.com/pagamento/retorno.html"
      },
      auto_return: "approved",
      notification_url:
        "https://goticket-l2y9.onrender.com/webhook/mercadopago"
    };

    
    const result = await preference.create({ body });

    const paymentId = result.id;

    db.run(
      `INSERT INTO pagamentos (payment_id, status)
       VALUES (?, 'pending')`,
      [paymentId]
    );

    res.json({ init_point: result.init_point });

  } catch (error) {
    console.error("ERRO COMPLETO:", error);
    res.status(500).json({ error: "Erro ao gerar pagamento" });
  }
};

