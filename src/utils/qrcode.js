const QRCode = require("qrcode");
const crypto = require("crypto");

// Definimos a função como uma constante interna
const gerarQRCode = async (ticketId) => {
  const payload = {
    ticketId,
    hash: crypto.randomUUID()
  };

  return QRCode.toDataURL(JSON.stringify(payload));
};

// Exportamos o objeto contendo a função
module.exports = { gerarQRCode };