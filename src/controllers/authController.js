const db = require("../database/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { preference } = require("../config/mercadopago");
const { JWT_SECRET, BASE_URL } = require("../config/env");
const { VERSAO_TERMOS } = require("../config/legal");

// Tipos de ingresso aceitos e a coluna de preço de cada um na tabela eventos
const TIPOS_INGRESSO = {
  inteira:  { titulo: "Inteira",      coluna: "preco_inteira" },
  meia:     { titulo: "Meia-entrada", coluna: "preco_meia" },
  camarote: { titulo: "Camarote",     coluna: "preco_camarote" }
};
const MAX_POR_TIPO = 10;

const ERRO_CREDENCIAIS = "E-mail ou senha incorretos.";
// Hash usado quando o e-mail não existe, para o tempo de resposta ser o mesmo
// e não dar pistas de quais e-mails têm conta
const HASH_FALSO = bcrypt.hashSync("senha-inexistente", 10);

const gerarSessao = (user) => ({
  token: jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "1d" }),
  user: { id: user.id, name: user.name, email: user.email }
});

// O token de recuperação é guardado só como hash: quem ler o banco não consegue usá-lo
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// --- CADASTRO ---
exports.register = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const { lastID } = await db.runAsync(
      `INSERT INTO users (name, email, password, created_at, consent_at, consent_version)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)`,
      [name, email, hashedPassword, VERSAO_TERMOS]
    );

    res.status(201).json({
      message: "Conta criada com sucesso",
      ...gerarSessao({ id: lastID, name, email })
    });
  } catch (err) {
    if (err.code === "SQLITE_CONSTRAINT") {
      return res.status(409).json({ error: "Já existe uma conta com este e-mail." });
    }
    console.error("Erro no cadastro:", err.message);
    res.status(500).json({ error: "Não foi possível criar a conta. Tente novamente." });
  }
};

// --- LOGIN ---
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await db.getAsync(
      "SELECT id, name, email, password FROM users WHERE email = ? AND deleted_at IS NULL",
      [email]
    );

    const senhaValida = await bcrypt.compare(password, user?.password || HASH_FALSO);

    if (!user || !user.password || !senhaValida) {
      return res.status(401).json({ error: ERRO_CREDENCIAIS });
    }

    res.json({ message: "Login realizado com sucesso", ...gerarSessao(user) });
  } catch (err) {
    console.error("Erro no login:", err.message);
    res.status(500).json({ error: "Erro no servidor. Tente novamente." });
  }
};

// --- SOLICITAR RECUPERAÇÃO DE SENHA ---
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  // Mesma resposta exista ou não o e-mail, para não revelar quem tem conta
  const resposta = { message: "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha." };

  try {
    const user = await db.getAsync("SELECT id FROM users WHERE email = ? AND deleted_at IS NULL", [email]);
    if (!user) return res.json(resposta);

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 3600000); // 1 hora a partir de agora

    await db.runAsync(
      "UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?",
      [hashToken(token), expires, user.id]
    );

    // SIMULAÇÃO DE ENVIO DE E-MAIL: ainda não há serviço de e-mail configurado.
    // O link só é mostrado fora de produção, e sem o e-mail do usuário no log.
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n🔑 Link de recuperação (usuário #${user.id}): ${BASE_URL}/reset-password.html?token=${token}\n`);
    }

    res.json(resposta);
  } catch (err) {
    console.error("Erro na recuperação de senha:", err.message);
    res.status(500).json({ error: "Erro no servidor. Tente novamente." });
  }
};

// --- SALVAR NOVA SENHA ---
exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const user = await db.getAsync(
      "SELECT id FROM users WHERE reset_token = ? AND reset_expires > ? AND deleted_at IS NULL",
      [hashToken(String(token)), new Date()]
    );

    if (!user) {
      return res.status(400).json({ error: "Link inválido ou expirado. Solicite a recuperação novamente." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.runAsync(
      "UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?",
      [hashedPassword, user.id]
    );

    res.json({ message: "Senha alterada com sucesso! Você já pode entrar." });
  } catch (err) {
    console.error("Erro ao redefinir senha:", err.message);
    res.status(500).json({ error: "Erro ao atualizar senha." });
  }
};

// --- CRIAR PAGAMENTO ---
// O cliente envia só o evento e as quantidades; o preço sempre vem do banco.
exports.criarPagamento = async (req, res) => {
  try {
    const { evento_id, items } = req.body;
    const userId = req.userId;

    if (!evento_id || !Array.isArray(items)) {
      return res.status(400).json({ error: "evento_id e items são obrigatórios" });
    }

    const evento = await db.getAsync("SELECT * FROM eventos WHERE id = ?", [evento_id]);
    if (!evento) {
      return res.status(404).json({ error: "Evento não encontrado" });
    }

    const itensValidados = [];
    for (const item of items) {
      const tipo = TIPOS_INGRESSO[item.tipo];
      const quantidade = Number(item.quantity);

      if (!tipo) {
        return res.status(400).json({ error: `Tipo de ingresso inválido: ${item.tipo}` });
      }
      if (!Number.isInteger(quantidade) || quantidade < 0 || quantidade > MAX_POR_TIPO) {
        return res.status(400).json({ error: `Quantidade inválida (máximo ${MAX_POR_TIPO} por tipo)` });
      }
      if (quantidade === 0) continue;

      const preco = Number(evento[tipo.coluna]);
      if (!(preco > 0)) {
        return res.status(400).json({ error: `Ingresso ${tipo.titulo} indisponível para este evento` });
      }

      itensValidados.push({
        id: item.tipo,
        title: `${tipo.titulo} - ${evento.nome}`,
        tipo: tipo.titulo,
        quantity: quantidade,
        unit_price: preco,
        currency_id: "BRL"
      });
    }

    if (itensValidados.length === 0) {
      return res.status(400).json({ error: "Nenhum ingresso selecionado" });
    }

    // Registra o pedido antes de ir ao Mercado Pago; o id volta no webhook como external_reference
    const { lastID: pedidoId } = await db.runAsync(
      `INSERT INTO pagamentos (status, user_id, evento_id, items) VALUES ('pending', ?, ?, ?)`,
      [userId, evento.id, JSON.stringify(itensValidados)]
    );

    const body = {
      items: itensValidados.map(({ id, title, quantity, unit_price, currency_id }) =>
        ({ id, title, quantity, unit_price, currency_id })),
      external_reference: String(pedidoId),
      back_urls: {
        success: `${BASE_URL}/pagamento/retorno.html`,
        failure: `${BASE_URL}/pagamento/retorno.html`,
        pending: `${BASE_URL}/pagamento/retorno.html`
      }
    };

    // O Mercado Pago só aceita retorno automático e webhook em URLs públicas (https)
    if (BASE_URL.startsWith("https://")) {
      body.auto_return = "approved";
      body.notification_url = `${BASE_URL}/webhook/mercadopago`;
    }

    const result = await preference.create({ body });

    await db.runAsync("UPDATE pagamentos SET preference_id = ? WHERE id = ?", [result.id, pedidoId]);

    res.json({ init_point: result.init_point });

  } catch (error) {
    console.error("ERRO COMPLETO:", error);
    res.status(500).json({ error: "Erro ao gerar pagamento" });
  }
};
// --- LISTAR TODOS OS EVENTOS (admin) ---
exports.listarEventos = (req, res) => {
  db.all("SELECT * FROM eventos ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: "Erro ao listar eventos" });
    res.json(rows);
  });
};

// --- CRIAR EVENTO ---
exports.criarEvento = (req, res) => {
  const { nome, descricao, local, data, imagem, preco_inteira, preco_meia, preco_camarote } = req.body;

  if (!nome || !local || !data) {
    return res.status(400).json({ error: "Nome, local e data são obrigatórios" });
  }

  db.run(
    `INSERT INTO eventos (nome, descricao, local, data, imagem, preco_inteira, preco_meia, preco_camarote)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [nome, descricao, local, data, imagem, preco_inteira || 0, preco_meia || 0, preco_camarote || 0],
    function(err) {
      if (err) return res.status(500).json({ error: "Erro ao criar evento" });
      res.status(201).json({ message: "Evento criado", id: this.lastID });
    }
  );
};

// --- EDITAR EVENTO ---
exports.editarEvento = (req, res) => {
  const { id } = req.params;
  const { nome, descricao, local, data, imagem, preco_inteira, preco_meia, preco_camarote } = req.body;

  db.run(
    `UPDATE eventos SET nome=?, descricao=?, local=?, data=?, imagem=?, 
     preco_inteira=?, preco_meia=?, preco_camarote=? WHERE id=?`,
    [nome, descricao, local, data, imagem, preco_inteira, preco_meia, preco_camarote, id],
    function(err) {
      if (err) return res.status(500).json({ error: "Erro ao editar evento" });
      if (this.changes === 0) return res.status(404).json({ error: "Evento não encontrado" });
      res.json({ message: "Evento atualizado" });
    }
  );
};

// --- DELETAR EVENTO ---
exports.deletarEvento = (req, res) => {
  const { id } = req.params;

  db.run("DELETE FROM eventos WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).json({ error: "Erro ao deletar evento" });
    if (this.changes === 0) return res.status(404).json({ error: "Evento não encontrado" });
    res.json({ message: "Evento deletado" });
  });
};
// --- LISTAR EVENTOS (público) ---
exports.listarEventosPublico = (req, res) => {
  db.all("SELECT * FROM eventos ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: "Erro ao listar eventos" });
    res.json(rows);
  });
};
// --- BUSCAR UM EVENTO POR ID (público) ---
exports.buscarEventoPorId = (req, res) => {
  const { id } = req.params;

  db.get("SELECT * FROM eventos WHERE id = ?", [id], (err, evento) => {
    if (err) return res.status(500).json({ error: "Erro ao buscar evento" });
    if (!evento) return res.status(404).json({ error: "Evento não encontrado" });
    res.json(evento);
  });
};
