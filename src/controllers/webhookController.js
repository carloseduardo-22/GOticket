const { MercadoPagoConfig, Payment } = require('mercadopago');
const db = require("../database/db");
const { gerarQRCode } = require("../utils/qrcode");
// Configure o client aqui também
const client = new MercadoPagoConfig({ 
    accessToken: 'TEST-1783477078293568-012018-884ac3828e5779c6e0f69ec06de45b42-2487509162' 
});

exports.mercadoPagoWebhook = async (req, res) => {
  try {
    const paymentId = req.body?.data?.id || req.body?.id;

    if (!paymentId) return res.sendStatus(200);

    console.log("🔔 Webhook recebido. Payment ID:", paymentId);

    const payment = new Payment(client);
    const result = await payment.get({ id: paymentId });

    if (result.status !== "approved") {
      return res.sendStatus(200);
    }

    const { user_id, evento, items } = result.metadata;

    if (!user_id || !evento || !items) {
      console.error("❌ Metadata incompleto:", result.metadata);
      return res.sendStatus(200);
    }

    console.log("✅ Pagamento aprovado. Criando ingressos...");

    for (const item of items) {
      for (let i = 0; i < item.quantity; i++) {
        const qrCode = await gerarQRCode(paymentId + "-" + Date.now());

        db.run(
          `INSERT INTO tickets
           (user_id, event, type, qr_code, status, payment_id)
           VALUES (?, ?, ?, ?, 'approved', ?)`,
          [
            user_id,
            evento,
            item.title, // Inteira / Meia / Camarote
            qrCode,
            paymentId
          ]
        );
      }
    }

    // opcional: atualizar tabela pagamentos
    db.run(
      `UPDATE pagamentos SET status = 'approved' WHERE payment_id = ?`,
      [paymentId]
    );

    console.log("🎟️ Ingressos criados com sucesso!");
    res.sendStatus(200);

  } catch (err) {
    console.error("❌ Erro no webhook:", err);
    res.sendStatus(500);
  }
};



