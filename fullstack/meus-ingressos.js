
document.addEventListener("DOMContentLoaded", () => {
  carregarMeusIngressos();
});

async function carregarMeusIngressos() {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Você precisa estar logado");
    window.location.href = "index.html";
    return;
  }

  try {
    const response = await fetch("/tickets/meus-ingressos", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error("Erro ao buscar ingressos");
    }

    const ingressos = await response.json();
    exibirIngressosNaTela(ingressos);

  } catch (err) {
    console.error(err);
    alert("Erro ao carregar ingressos");
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




