// ================== CONFIGURAÇÃO DE REDE ==================
// https://overmoist-indistinguishably-camille.ngrok-free.dev/index.html 
// Se for apenas local, deixe "/"
const API_BASE_URL = window.location.origin; 

// ================== INICIALIZAÇÃO ==================
document.addEventListener("DOMContentLoaded", () => {
    atualizarHeader();

    // Gerenciamento de Modal e Menus
    const modal = document.getElementById("registerModal");
    const userGreeting = document.getElementById("userGreeting");
    const accountMenu = document.getElementById("accountMenu");
    const userIcon = document.getElementById("userIcon");
    if (userIcon) {
        userIcon.onclick = (e) => {
            e.preventDefault();
            abrirModal();
        };
    }
    // Delegar cliques para fechar modais e menus
    document.addEventListener("click", (e) => {
        if (e.target.classList.contains("close") || e.target === modal) {
            fecharModal();
        }
        
        // Fechar menu de conta ao clicar fora
        if (accountMenu && userGreeting && !userGreeting.contains(e.target) && !accountMenu.contains(e.target)) {
            accountMenu.classList.remove("show");
        }
    });

    // Busca
    const searchInput = document.getElementById("campoBusca");
    if (searchInput) {
        searchInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") buscarPorClique();
        });
    }
});

// ================== FUNÇÕES DE MODAL ==================
function abrirModal() {
    const modal = document.getElementById("registerModal");
    if (modal) modal.classList.add("show");
}

function fecharModal() {
    const modal = document.getElementById("registerModal");
    if (modal) modal.classList.remove("show");
}

// ================== AUTENTICAÇÃO (LOGIN/CADASTRO) ==================
async function cadastrar() {
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (!name || !email || !password || !confirmPassword) return alert("Preencha todos os campos");
    if (password !== confirmPassword) return alert("As senhas não conferem");

    try {
        const res = await fetch(`${API_BASE_URL}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.message);
        alert("Cadastro realizado! Faça login.");
        mostrarLogin();
    } catch (err) { alert(err.message); }
}

async function login() {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || "Erro ao logar");

        localStorage.setItem("token", data.token);
        localStorage.setItem("usuario", JSON.stringify(data.user));

        fecharModal();
        atualizarHeader();
        window.location.reload(); // Recarregar para garantir que o estado do app atualize
    } catch (err) { alert(err.message); }
}

// ================== COMPRA E PAGAMENTO ==================
async function comprarIngresso() {
    const token = localStorage.getItem("token");
    if (!token) return abrirModal();

    const itemsParaCompra = [];
    Object.values(ingressos).forEach(i => {
        if (i.qtd > 0) {
            itemsParaCompra.push({
                title: i.nome,
                quantity: i.qtd,
                unit_price: i.preco
            });
        }
    });

    if (itemsParaCompra.length === 0) return alert("Selecione ao menos um ingresso");

    try {
        const res = await fetch(`${API_BASE_URL}/auth/pagar`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                evento: "Goiás x Vila Rosa",
                items: itemsParaCompra
            })
        });

        const data = await res.json();
        if (data.init_point) {
            window.location.href = data.init_point;
        } else {
            alert("Erro ao gerar link de pagamento.");
        }
    } catch (err) {
        console.error(err);
        alert("Erro na conexão mobile. Verifique se o ngrok está ativo.");
    }
}

// ================== UTILITÁRIOS DE UI ==================
function atualizarHeader() {
    const token = localStorage.getItem("token");
    const userJson = localStorage.getItem("usuario");
    
    const icon = document.getElementById("userIcon");
    const greeting = document.getElementById("userGreeting");
    const menu = document.getElementById("accountMenu");

    if (token && userJson) {
        const user = JSON.parse(userJson);
        if (icon) icon.style.display = "none";
        if (greeting) {
            greeting.style.display = "inline-block";
            greeting.innerText = `Olá, ${user.name ? user.name.split(' ' )[0] : 'Usuário'}`;
            
            // Força o clique diretamente no elemento
            greeting.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (menu) {
                    menu.classList.toggle("show");
                    console.log("Menu alternado!"); // Verifique se isso aparece no console
                }
            };
        }
    } else {
        if (icon) icon.style.display = "inline-block";
        if (greeting) greeting.style.display = "none";
    }
}

// Chame a função assim que o script carregar e também no DOMContentLoaded
atualizarHeader();
document.addEventListener("DOMContentLoaded", atualizarHeader);

function logout() {
    localStorage.clear();
    window.location.href = "index.html";
}

// ================== CONTROLE DE INGRESSOS ==================
const ingressos = {
    inteira: { nome: "Inteira", preco: 50, qtd: 0 },
    meia: { nome: "Meia-entrada", preco: 25, qtd: 0 },
    camarote: { nome: "Camarote", preco: 100, qtd: 0 }
};

function alterarQuantidade(tipo, valor) {
    if (!ingressos[tipo]) return;
    ingressos[tipo].qtd = Math.max(0, Math.min(10, ingressos[tipo].qtd + valor));
    
    const span = document.getElementById(`qtd-${tipo}`);
    if (span) span.innerText = ingressos[tipo].qtd;
    
    atualizarTotal();
}

function atualizarTotal() {
    let total = 0;
    Object.values(ingressos).forEach(i => total += i.qtd * i.preco);
    const totalEl = document.getElementById("total");
    if (totalEl) totalEl.innerText = total.toFixed(2);
}

// ================== BUSCA ==================
const eventos = [{ nome: "seu evento", pagina: "evento.html" }];

function buscarPorClique() {
    const input = document.getElementById("campoBusca");
    if (!input) return;
    const termo = normalizarTexto(input.value.trim());
    if (!termo) return;

    const encontrado = eventos.find(ev => normalizarTexto(ev.nome).includes(termo));
    if (encontrado) window.location.href = encontrado.pagina;
    else alert("Evento não encontrado");
}

function normalizarTexto(texto) {
    return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
// ================== FUNÇÕES DE INTERFACE (CORREÇÃO DE ERROS) ==================

function abrirBusca() {
    const box = document.getElementById("searchBox");
    const input = document.getElementById("searchInput");

    if (!box || !input) return;

    box.style.display = (box.style.display === "block") ? "none" : "block";
    if (box.style.display === "block") {
        setTimeout(() => input.focus(), 150);
    }
}

function toggleMenu() {
    const menu = document.getElementById("mobileMenu");
    if (menu) {
        menu.classList.toggle("show");
    }
}

// Garante que o menu mobile feche ao clicar fora
document.addEventListener("click", (e) => {
    const menu = document.getElementById("mobileMenu");
    const toggle = document.querySelector(".menu-toggle");

    if (menu && menu.classList.contains("show")) {
        if (!menu.contains(e.target) && !toggle?.contains(e.target)) {
            menu.classList.remove("show");
        }
    }
});
function irParaMeusIngressos() {
    const token = localStorage.getItem("token");
    if (!token) {
        alert("Faça login para ver seus ingressos");
        abrirModal();
        return;
    }
    window.location.href = "meus-ingressos.html";
}









