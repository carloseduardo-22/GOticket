const QRCode = require("qrcode");

// Gera a imagem (data URL) do QR Code com o token único do ingresso
const gerarQRCode = async (token) => {
  return QRCode.toDataURL(token);
};

module.exports = { gerarQRCode };
