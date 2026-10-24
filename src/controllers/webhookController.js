const crypto = require("crypto");
const db = require("../database/db");
const { payment } = require("../config/mercadopago");
const { gerarQRCode } = require("../utils/qrcode");

exports.mercadoPagoWebhook = async (req, res) => {
  try {
    // Só nos interessam notificações de pagamento
    const tipo = req.body?.type || req.body?.topic || req.query.type || req.query.topic;
    if (tipo && tipo !== "payment") return res.sendStatus(200);

    const paymentId = req.body?.data?.id || req.query["data.id"] || req.query.id;
    if (!paymentId) return res.sendStatus(200);

    console.log("🔔 Webhook recebido. Payment ID:", paymentId);

    // Os dados do pagamento são sempre consultados no Mercado Pago, nunca lidos da notificação
    const result = await payment.get({ id: paymentId });

    if (result.status !== "approved") {
      return res.sendStatus(200);
    }

    const pedidoId = Number(result.external_reference);
    const pedido = pedidoId
      ? await db.getAsync("SELECT * FROM pagamentos WHERE id = ?", [pedidoId])
      : null;

    if (!pedido) {
      console.error("❌ Pedido não encontrado para o pagamento", paymentId, result.external_reference);
      return res.sendStatus(200);
    }

    // Marca o pedido como aprovado só se ainda não estiver. Se outra notificação
    // já processou este pedido, changes = 0 e nada é criado de novo.
    const { changes } = await db.runAsync(
      "UPDATE pagamentos SET status = 'approved', payment_id = ? WHERE id = ? AND status != 'approved'",
      [String(paymentId), pedido.id]
    );

    if (changes === 0) {
      console.log("ℹ️  Pagamento já processado:", paymentId);
      return res.sendStatus(200);
    }

    const evento = await db.getAsync("SELECT nome FROM eventos WHERE id = ?", [pedido.evento_id]);
    const items = JSON.parse(pedido.items || "[]");

    try {
      for (const item of items) {
        for (let i = 0; i < item.quantity; i++) {
          const token = crypto.randomUUID();
          const qrCode = await gerarQRCode(token);

          await db.runAsync(
            `INSERT INTO tickets
             (user_id, evento_id, event, type, quantity, total, qr_code, qr_token, status, payment_id)
             VALUES (?, ?, ?, ?, 1, ?, ?, ?, 'approved', ?)`,
            [
              pedido.user_id,
              pedido.evento_id,
              evento ? evento.nome : "Evento",
              item.tipo, // Inteira / Meia-entrada / Camarote
              item.unit_price,
              qrCode,
              token,
              String(paymentId)
            ]
          );
        }
      }
    } catch (err) {
      // Desfaz para que a próxima notificação do Mercado Pago tente de novo
      await db.runAsync("DELETE FROM tickets WHERE payment_id = ?", [String(paymentId)]);
      await db.runAsync("UPDATE pagamentos SET status = 'pending' WHERE id = ?", [pedido.id]);
      throw err;
    }

    console.log("🎟️ Ingressos criados com sucesso!");
    res.sendStatus(200);

  } catch (err) {
    console.error("❌ Erro no webhook:", err);
    res.sendStatus(500);
  }
};
