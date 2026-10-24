// Limitador de tentativas em memória (por IP + rota), sem dependências externas.
// Protege login, cadastro e recuperação de senha contra força bruta.
const limitarTentativas = ({ janelaMs, max, mensagem }) => {
  const tentativas = new Map();

  // Limpa entradas vencidas a cada janela para não crescer indefinidamente
  setInterval(() => {
    const agora = Date.now();
    for (const [chave, registro] of tentativas) {
      if (registro.expiraEm < agora) tentativas.delete(chave);
    }
  }, janelaMs).unref();

  return (req, res, next) => {
    const chave = `${req.ip}:${req.baseUrl}${req.path}`;
    const agora = Date.now();
    let registro = tentativas.get(chave);

    if (!registro || registro.expiraEm < agora) {
      registro = { total: 0, expiraEm: agora + janelaMs };
      tentativas.set(chave, registro);
    }

    registro.total++;

    if (registro.total > max) {
      res.set("Retry-After", String(Math.ceil((registro.expiraEm - agora) / 1000)));
      return res.status(429).json({ error: mensagem });
    }

    next();
  };
};

module.exports = { limitarTentativas };
