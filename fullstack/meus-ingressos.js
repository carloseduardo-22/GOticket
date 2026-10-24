document.addEventListener("DOMContentLoaded", () => {
  carregarMeusIngressos();
});

function mostrarAvisoLogin(container) {
  if (!container) return;
  container.innerHTML = `
    <div style="text-align:center; padding:40px 20px;">
      <p style="color:#999; margin-bottom:16px;">Faça login para ver seus ingressos</p>
      <button onclick="abrirModal()" class="btn">Entrar</button>
    </div>
  `;
}

async function carregarMeusIngressos() {
  const token = localStorage.getItem("token");
  const container = document.getElementById("tickets");

  if (!token) {
    mostrarAvisoLogin(container);
    return;
  }

  try {
    const response = await fetch("/tickets/meus-ingressos", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
      atualizarHeader();
      mostrarAvisoLogin(container);
      return;
    }

    if (!response.ok) {
      throw new Error("Erro ao buscar ingressos");
    }

    const ingressos = await response.json();
    exibirIngressosNaTela(ingressos);

  } catch (err) {
    console.error(err);
    if (container) {
      container.innerHTML = '<p style="color:#999;text-align:center;">Erro ao carregar ingressos.</p>';
    }
  }
}

function exibirIngressosNaTela(ingressos) {
    const container = document.getElementById("tickets");
    if (!container) return;
    container.innerHTML = "";

    if (!ingressos.length) {
        container.innerHTML = '<p style="color:#999;text-align:center;">Você ainda não tem ingressos.</p>';
        return;
    }

    ingressos.forEach(ticket => {
        const card = document.createElement("div");
        card.className = "ticket-card";

        // O QR Code vem pronto do servidor e contém o token único do ingresso
        const qr = ticket.qr_code && ticket.qr_code.startsWith("data:image/")
            ? `<img src="${ticket.qr_code}" alt="QR Code do Ingresso" style="border: 10px solid #fff; border-radius: 5px; width: 200px;">`
            : '<p style="color:#999;">QR Code indisponível</p>';

        const situacao = ticket.used ? "Utilizado" : "Válido";

        card.innerHTML = `
            <div class="ticket-info">
                <h3>${escaparHTML(ticket.event)}</h3>
                <p><strong>Ingresso:</strong> #${ticket.id}</p>
                <p><strong>Tipo:</strong> ${escaparHTML(ticket.type || "-")}</p>
                <div class="qr-container">${qr}</div>
                <p><strong>Situação:</strong> <span class="status-${ticket.used ? "used" : "approved"}">${situacao}</span></p>
            </div>
        `;
        container.appendChild(card);
    });
}
