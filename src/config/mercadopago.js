const { MercadoPagoConfig, Payment, Preference } = require("mercadopago");
const { MERCADO_PAGO_ACCESS_TOKEN } = require("./env");

const client = new MercadoPagoConfig({
  accessToken: MERCADO_PAGO_ACCESS_TOKEN
});

module.exports = {
  payment: new Payment(client),
  preference: new Preference(client)
};
