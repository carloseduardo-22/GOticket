const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const authController = require("../controllers/authController");
const accountController = require("../controllers/accountController");
const autenticarToken = require("../middlewares/authMiddleware");
const { autenticarAdmin } = require("../middlewares/authMiddleware");
const { limitarTentativas } = require("../middlewares/rateLimit");

// Devolve o primeiro erro de validação como { error } (mesmo formato do resto da API)
const validar = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }
  next();
};

// E-mail sempre minúsculo e sem espaços, para "Fulano@Gmail.com" e "fulano@gmail.com" serem a mesma conta
const campoEmail = () =>
  body("email").trim().toLowerCase().isEmail().withMessage("Informe um e-mail válido").isLength({ max: 254 });

const campoNome = () =>
  body("name").trim().isLength({ min: 2, max: 100 }).withMessage("Informe seu nome (2 a 100 caracteres)");

const campoSenhaNova = (campo) =>
  body(campo)
    .isLength({ min: 8, max: 128 }).withMessage("A senha deve ter no mínimo 8 caracteres")
    .matches(/[A-Za-z]/).withMessage("A senha deve ter ao menos uma letra")
    .matches(/\d/).withMessage("A senha deve ter ao menos um número");

const limiteLogin = limitarTentativas({
  janelaMs: 15 * 60 * 1000, max: 10,
  mensagem: "Muitas tentativas. Aguarde 15 minutos e tente novamente."
});
const limiteCadastro = limitarTentativas({
  janelaMs: 60 * 60 * 1000, max: 10,
  mensagem: "Muitos cadastros a partir desta rede. Tente novamente mais tarde."
});
const limiteRecuperacao = limitarTentativas({
  janelaMs: 60 * 60 * 1000, max: 5,
  mensagem: "Muitas solicitações. Aguarde e tente novamente mais tarde."
});

// ================= AUTENTICAÇÃO =================
router.post(
  "/register",
  limiteCadastro,
  [
    campoNome(),
    campoEmail(),
    campoSenhaNova("password"),
    body("aceite_termos").equals("true").withMessage("É preciso aceitar os Termos de Uso e a Política de Privacidade")
  ],
  validar,
  authController.register
);

router.post(
  "/login",
  limiteLogin,
  [campoEmail(), body("password").isString().notEmpty().withMessage("Informe a senha")],
  validar,
  authController.login
);

router.post("/forgot-password", limiteRecuperacao, [campoEmail()], validar, authController.forgotPassword);

router.post(
  "/reset-password",
  limiteRecuperacao,
  [body("token").isString().notEmpty().withMessage("Link inválido"), campoSenhaNova("newPassword")],
  validar,
  authController.resetPassword
);

// ================= MINHA CONTA (LGPD) =================
router.get("/me", autenticarToken, accountController.verPerfil);
router.put("/me", autenticarToken, [campoNome()], validar, accountController.atualizarPerfil);
router.get("/me/dados", autenticarToken, accountController.exportarDados);
router.delete("/me", autenticarToken, limiteLogin, accountController.excluirConta);

// ================= EVENTOS E PAGAMENTO =================
router.post('/pagar', autenticarToken, authController.criarPagamento);
router.get('/eventos', authController.listarEventosPublico);
router.get('/eventos/:id', authController.buscarEventoPorId);

// ================= ADMIN - EVENTOS =================
router.get('/admin/eventos',            autenticarToken, autenticarAdmin, authController.listarEventos);
router.post('/admin/eventos',           autenticarToken, autenticarAdmin, authController.criarEvento);
router.put('/admin/eventos/:id',        autenticarToken, autenticarAdmin, authController.editarEvento);
router.delete('/admin/eventos/:id',     autenticarToken, autenticarAdmin, authController.deletarEvento);

module.exports = router;
