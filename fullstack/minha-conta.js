document.addEventListener("DOMContentLoaded", () => {
  carregarConta();
});

async function carregarConta() {
  const area = document.getElementById("conta");

  if (!localStorage.getItem("token")) {
    area.innerHTML = `
      <div class="painel" style="text-align:center;">
        <p>Entre na sua conta para ver e gerenciar seus dados.</p>
        <div class="acoes" style="justify-content:center;"><button onclick="abrirModal()">Entrar</button></div>
      </div>`;
    return;
  }

  const { ok, status, data } = await chamarApi("/auth/me", { autenticado: true });
  if (status === 401) return carregarConta();
  if (!ok) {
    area.innerHTML = '<p class="lista-vazia">Não foi possível carregar seus dados.</p>';
    return;
  }

  area.innerHTML = `
    <section class="painel">
      <h2>Seus dados</h2>
      <p>Você pode corrigir seu nome a qualquer momento. Para trocar o e-mail, fale com a gente.</p>
      <form id="formPerfil" novalidate>
        <label for="perfilNome">Nome</label>
        <input id="perfilNome" type="text" maxlength="100" autocomplete="name" value="${escaparHTML(data.name)}">
        <label for="perfilEmail">E-mail</label>
        <input id="perfilEmail" type="email" value="${escaparHTML(data.email)}" disabled>
        <ul class="dados-lista">
          <li>Conta criada em: ${escaparHTML(formatarDataHora(data.created_at))}</li>
          <li>Termos e Política de Privacidade aceitos em: ${escaparHTML(formatarDataHora(data.consent_at))}
            ${data.consent_version ? `(versão ${escaparHTML(data.consent_version)})` : ""}</li>
        </ul>
        <div class="acoes"><button type="submit">Salvar alterações</button></div>
      </form>
    </section>

    <section class="painel">
      <h2>Baixar meus dados</h2>
      <p>Receba um arquivo com todos os dados pessoais que guardamos sobre você: conta, ingressos e pedidos.</p>
      <div class="acoes"><button type="button" class="botao-secundario" onclick="baixarDados()">Baixar meus dados (JSON)</button></div>
    </section>

    <section class="painel painel-perigo">
      <h2>Excluir minha conta</h2>
      <p>Seu nome, e-mail e senha serão apagados e você não poderá mais entrar.
         <strong>Ingressos ainda não utilizados deixam de aparecer para você.</strong>
         Registros de venda são mantidos sem identificação pelo prazo exigido pela legislação fiscal.</p>
      <form id="formExcluir" novalidate>
        <label for="senhaExcluir">Confirme sua senha</label>
        <input id="senhaExcluir" type="password" autocomplete="current-password">
        <div class="acoes"><button type="submit" class="botao-perigo">Excluir minha conta</button></div>
      </form>
    </section>`;

  document.getElementById("formPerfil").addEventListener("submit", salvarPerfil);
  document.getElementById("formExcluir").addEventListener("submit", excluirConta);
}

function formatarDataHora(valor) {
  if (!valor) return "não registrado";
  const data = new Date(String(valor).replace(" ", "T") + (String(valor).includes("Z") ? "" : "Z"));
  return isNaN(data) ? valor : data.toLocaleString("pt-BR");
}

async function salvarPerfil(e) {
  e.preventDefault();
  const name = document.getElementById("perfilNome").value.trim();

  const { ok, data } = await chamarApi("/auth/me", { metodo: "PUT", autenticado: true, corpo: { name } });
  if (!ok) return mostrarAviso(data.error || "Erro ao salvar.", "erro");

  const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
  usuario.name = data.name;
  localStorage.setItem("usuario", JSON.stringify(usuario));
  atualizarHeader();
  mostrarAviso("Dados atualizados.", "sucesso");
}

async function baixarDados() {
  const res = await fetch("/auth/me/dados", {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
  });
  if (!res.ok) return mostrarAviso("Não foi possível gerar o arquivo.", "erro");

  const blob = await res.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "meus-dados-goticket.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

async function excluirConta(e) {
  e.preventDefault();
  const password = document.getElementById("senhaExcluir").value;
  if (!password) return mostrarAviso("Digite sua senha para confirmar.", "erro");
  if (!confirm("Tem certeza? Esta ação não pode ser desfeita.")) return;

  const { ok, data } = await chamarApi("/auth/me", { metodo: "DELETE", autenticado: true, corpo: { password } });
  if (!ok) return mostrarAviso(data.error || "Erro ao excluir a conta.", "erro");

  localStorage.removeItem("token");
  localStorage.removeItem("usuario");
  alert(data.message);
  window.location.href = "index.html";
}
