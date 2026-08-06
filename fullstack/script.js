// ================== CONFIGURAÇÃO DE REDE ==================
const API_BASE_URL = window.location.origin;
let eventosCache = [];

// ================== INICIALIZAÇÃO ==================
document.addEventListener("DOMContentLoaded", () => {
    atualizarHeader();

    // Carrega conteúdo conforme a página
    if (document.getElementById('listaEventosPublico')) {
        carregarEventosPublico();
    }

    if (new URLSearchParams(window.location.search).get('id')) {
        carregarEvento();
    }

    const footerYear = document.getElementById("footerYear");
    if (footerYear) footerYear.textContent = new Date().getFullYear();

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

    document.addEventListener("click", (e) => {
        if (e.target.classList.contains("close") || e.target === modal) {
            fecharModal();
        }
        if (accountMenu && userGreeting && !userGreeting.contains(e.target) && !accountMenu.contains(e.target)) {
            accountMenu.classList.remove("show");
        }
    });

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

function mostrarCadastro() {
    document.getElementById("loginForm").style.display = "none";
    document.getElementById("registerForm").style.display = "block";
    document.getElementById("registerSuccess").style.display = "none";
}

function mostrarLogin() {
    document.getElementById("loginForm").style.display = "block";
    document.getElementById("registerForm").style.display = "none";
    document.getElementById("registerSuccess").style.display = "none";
}

// ================== AUTENTICAÇÃO ==================
async function cadastrar() {
    const name            = document.getElementById("name").value.trim();
    const email           = document.getElementById("registerEmail").value.trim();
    const password        = document.getElementById("password").value;
    const confirmPassword = document.getElementById("registerPassword").value;

    if (!name || !email || !password || !confirmPassword) return alert("Preencha todos os campos");
    if (password !== confirmPassword) return alert("As senhas não conferem");

    try {
        const res  = await fetch(`${API_BASE_URL}/auth/register`, {
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
    const email    = document.getElementById("loginEmail").value.trim();
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
        window.location.reload();
    } catch (err) { alert(err.message); }
}

// ================== SLIDER DE BANNER ==================
function inicializarSlider() {
    const bannerSlider = document.getElementById('bannerSlider');
    const bannerTrack  = document.getElementById('bannerTrack');
    const bannerDots   = document.getElementById('bannerDots');

    if (!bannerSlider || !bannerTrack || !bannerDots) return;

    const totalBanners = bannerTrack.children.length;
    let bannerAtual    = 0;
    let bannerOffset   = 0;
    let autoplayTimer  = null;

    for (let i = 0; i < totalBanners; i++) {
        const dot = document.createElement('button');
        dot.className = 'dot' + (i === 0 ? ' active' : '');
        dot.setAttribute('aria-label', 'Ir para slide ' + (i + 1));
        dot.onclick = () => irParaBanner(i);
        bannerDots.appendChild(dot);
    }

    function atualizarBanner(animar = true) {
        bannerTrack.style.transition = animar ? 'transform 0.4s ease' : 'none';
        bannerTrack.style.transform  = `translateX(-${bannerAtual * 100 + bannerOffset}%)`;
        [...bannerDots.children].forEach((d, i) => {
            d.classList.toggle('active', i === bannerAtual);
        });
    }

    function mudarBanner(direcao) {
        bannerAtual  = (bannerAtual + direcao + totalBanners) % totalBanners;
        bannerOffset = 0;
        atualizarBanner();
    }

    function irParaBanner(i) {
        bannerAtual  = i;
        bannerOffset = 0;
        atualizarBanner();
    }

    function iniciarAutoplay() {
        autoplayTimer = setInterval(() => mudarBanner(1), 4000);
    }

    function pararAutoplay() {
        clearInterval(autoplayTimer);
    }

    // Expõe mudarBanner pro HTML (botões prev/next usam onclick)
    window.mudarBanner = mudarBanner;

    bannerSlider.addEventListener('mouseenter', pararAutoplay);
    bannerSlider.addEventListener('mouseleave', iniciarAutoplay);

    let bannerStartX  = 0;
    let bannerDragging = false;

    bannerSlider.addEventListener('touchstart', (e) => {
        bannerStartX   = e.touches[0].clientX;
        bannerDragging = true;
        pararAutoplay();
    }, { passive: true });

    bannerSlider.addEventListener('touchmove', (e) => {
        if (!bannerDragging) return;
        const deltaX = e.touches[0].clientX - bannerStartX;
        bannerOffset = -(deltaX / bannerSlider.getBoundingClientRect().width) * 100;
        atualizarBanner(false);
    }, { passive: true });

    bannerSlider.addEventListener('touchend', () => {
        bannerDragging = false;
        const limite   = 15;
        if (bannerOffset > limite) mudarBanner(1);
        else if (bannerOffset < -limite) mudarBanner(-1);
        else atualizarBanner(true);
        iniciarAutoplay();
    });

    iniciarAutoplay();
    atualizarBanner();
}

// ================== CARREGAMENTO DO EVENTO ==================
async function carregarEvento() {
    const params = new URLSearchParams(window.location.search);
    const id     = params.get('id');
    if (!id) return;

    try {
        const res    = await fetch(`${API_BASE_URL}/auth/eventos/${id}`);
        if (!res.ok) throw new Error('Evento não encontrado');
        const evento = await res.json();

        document.getElementById('eventoNome').textContent    = evento.nome;
        document.getElementById('eventoLocal').textContent   = evento.local;
        document.getElementById('eventoImagem').src          = evento.imagem;
        document.getElementById('eventoImagem').alt          = evento.nome;
        document.getElementById('precoInteira').textContent  = `R$ ${Number(evento.preco_inteira).toFixed(2)}`;
        document.getElementById('precoMeia').textContent     = `R$ ${Number(evento.preco_meia).toFixed(2)}`;
        document.getElementById('precoCamarote').textContent = `R$ ${Number(evento.preco_camarote).toFixed(2)}`;

        ingressos.inteira.preco  = evento.preco_inteira;
        ingressos.meia.preco     = evento.preco_meia;
        ingressos.camarote.preco = evento.preco_camarote;

        window.eventoAtual = evento.nome;

    } catch (err) {
        console.error(err);
        const el = document.getElementById('eventoNome');
        if (el) el.textContent = 'Evento não encontrado';
    }
}

// ================== EVENTOS PÚBLICOS ==================
async function carregarEventosPublico() {
    const container = document.getElementById('listaEventosPublico');
    if (!container) return;

    try {
        const res     = await fetch(`${API_BASE_URL}/auth/eventos`);
        const eventos = await res.json();
        eventosCache  = eventos; // guarda para a busca usar depois

        if (!eventos.length) {
            container.innerHTML = '<p style="color:#999;text-align:center;">Nenhum evento disponível no momento.</p>';
            return;
        }

        container.innerHTML = eventos.map(ev => `
            <div class="event-card">
                <div class="event-image" style="position:relative;">
                    <img src="${ev.imagem || './seu-evento.jpeg'}" alt="${ev.nome}">
                    <span class="event-location">${ev.local || ''}</span>
                </div>
                <div class="event-content">
                    <h3>${ev.nome}</h3>
                    <p>${ev.descricao || ''}</p>
                    <a href="evento.html?id=${ev.id}" class="btn">Confira</a>
                </div>
            </div>
        `).join('');

        montarBannerSlider(eventos);

    } catch (err) {
        container.innerHTML = '<p style="color:#999;text-align:center;">Erro ao carregar eventos.</p>';
        console.error(err);
    }
}

function montarBannerSlider(eventos) {
    const bannerTrack = document.getElementById('bannerTrack');
    if (!bannerTrack) return;

    const destaques = eventos.slice(0, 5); // até 5 no banner
    if (!destaques.length) return;

    bannerTrack.innerHTML = destaques.map(ev => `
        <a href="evento.html?id=${ev.id}" class="banner-slide" style="background-image: url('${ev.imagem || './seu-evento.jpeg'}')"></a>
    `).join('');

    inicializarSlider();
}

// ================== COMPRA E PAGAMENTO ==================
async function comprarIngresso() {
    const token = localStorage.getItem("token");
    if (!token) return abrirModal();

    const itemsParaCompra = [];
    Object.values(ingressos).forEach(i => {
        if (i.qtd > 0) {
            itemsParaCompra.push({
                title:      i.nome,
                quantity:   i.qtd,
                unit_price: i.preco
            });
        }
    });

    if (itemsParaCompra.length === 0) return alert("Selecione ao menos um ingresso");

    try {
        const res  = await fetch(`${API_BASE_URL}/auth/pagar`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                evento: window.eventoAtual || "Evento", 
                items:  itemsParaCompra
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
        alert("Erro ao processar pagamento.");
    }
}

// ================== UTILITÁRIOS DE UI ==================
function atualizarHeader() {
    const token    = localStorage.getItem("token");
    const userJson = localStorage.getItem("usuario");

    const icon     = document.getElementById("userIcon");
    const greeting = document.getElementById("userGreeting");
    const menu     = document.getElementById("accountMenu");

    if (token && userJson) {
        const user = JSON.parse(userJson);
        if (icon) icon.style.display = "none";
        if (greeting) {
            greeting.style.display = "inline-block";
            greeting.innerText     = `Olá, ${user.name ? user.name.split(' ')[0] : 'Usuário'}`;
            greeting.onclick       = function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (menu) menu.classList.toggle("show");
            };
        }
    } else {
        if (icon) icon.style.display = "inline-block";
        if (greeting) greeting.style.display = "none";
    }
}

atualizarHeader();

function logout() {
    localStorage.clear();
    window.location.href = "index.html";
}

// ================== CONTROLE DE INGRESSOS ==================
const ingressos = {
    inteira:  { nome: "Inteira",       preco: 0, qtd: 0 },
    meia:     { nome: "Meia-entrada",  preco: 0, qtd: 0 },
    camarote: { nome: "Camarote",      preco: 0, qtd: 0 }
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
// Enter no campo dispara a busca
async function buscarEvento(event) {
    if (event.key !== "Enter") return;
    await executarBusca();
}

// Usada tanto pelo Enter quanto pelo clique no botão de lupa
async function executarBusca() {
    const input = document.getElementById("searchInput");
    if (!input) return;

    const termo = normalizarTexto(input.value.trim());
    if (!termo) {
        input.focus();
        return;
    }

    let eventos = eventosCache;
    if (!eventos || !eventos.length) {
        try {
            const res = await fetch(`${API_BASE_URL}/auth/eventos`);
            eventos = await res.json();
        } catch (err) {
            console.error(err);
            alert("Erro ao buscar eventos.");
            return;
        }
    }

    const encontrado = eventos.find(ev =>
        normalizarTexto(ev.nome).includes(termo) ||
        normalizarTexto(ev.local || "").includes(termo)
    );

    if (encontrado) {
        window.location.href = `evento.html?id=${encontrado.id}`;
    } else {
        alert("Evento não encontrado");
    }
}

function normalizarTexto(texto) {
    return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// ================== FUNÇÕES DE INTERFACE ==================
function abrirBusca() {
    // A barra de busca já fica sempre visível; o ícone só foca o campo.
    const input = document.getElementById("searchInput");
    if (input) input.focus();
}

function toggleMenu() {
    const menu = document.getElementById("mobileMenu");
    if (menu) menu.classList.toggle("show");
}

document.addEventListener("click", (e) => {
    const menu   = document.getElementById("mobileMenu");
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

function pedirRecuperacao() {
    alert("Funcionalidade de recuperação de senha em breve.");
}









