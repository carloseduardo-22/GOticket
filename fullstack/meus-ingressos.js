
document.addEventListener("DOMContentLoaded", () => {
  carregarMeusIngressos();
});

async function carregarMeusIngressos() {
  const token = localStorage.getItem("token");
  const container = document.getElementById("tickets");

  if (!token) {
    if (container) {
      container.innerHTML = `
        <div style="text-align:center; padding:40px 20px;">
          <p style="color:#999; margin-bottom:16px;">Faça login para ver seus ingressos</p>
          <button onclick="abrirModal()" class="btn">Entrar</button>
        </div>
      `;
    }
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
      if (container) {
        container.innerHTML = `
          <div style="text-align:center; padding:40px 20px;">
            <p style="color:#999; margin-bottom:16px;">Faça login para ver seus ingressos</p>
            <button onclick="abrirModal()" class="btn">Entrar</button>
          </div>
        `;
      }
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

    ingressos.forEach(ticket => {
        const card = document.createElement("div");
        card.className = "ticket-card";
        
        const conteudoQR = `VALIDO-ID${ticket.id}-${ticket.event.replace(/\s+/g, '')}`;
        
        const urlQRCode = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(conteudoQR)}`;


        card.innerHTML = `
            <div class="ticket-info">
                <h3>${ticket.event}</h3>
                <p><strong>Pedido:</strong> #${ticket.id}</p>
                <div class="qr-container">
                    <img src="${urlQRCode}" alt="QR Code do Ingresso" style="border: 10px solid #fff; border-radius: 5px;">
                </div>
                <p><strong>Status:</strong> <span class="status-${ticket.status}">${ticket.status}</span></p>
                <p><strong>Qtd:</strong> ${ticket.quantity || 1}</p>
            </div>
        `;
        container.appendChild(card);
    });
}




