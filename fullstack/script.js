// ================== CONFIGURAÇÃO DE REDE ==================
const API_BASE_URL = window.location.origin;
let eventosCache = [];
let eventosPromise = null;

// ================== INICIALIZAÇÃO ==================
document.addEventListener("DOMContentLoaded", () => {
    montarModalAuth();
    atualizarHeader();
    iniciarBusca();

    // Carrega conteúdo conforme a página
    if (document.getElementById('listaEventosPublico')) {
        carregarEventosPublico();
    }

    if (document.getElementById('eventoNome') && new URLSearchParams(window.location.search).get('id')) {
        carregarEvento();
    }

    const footerYear = document.getElementById("footerYear");
    if (footerYear) footerYear.textContent = new Date().getFullYear();

    const userIcon = document.getElementById("userIcon");
    if (userIcon) {
        userIcon.onclick = (e) => {
            e.preventDefault();
            abrirModal();
        };
    }

    document.addEventListener("click", (e) => {
        const accountMenu  = document.getElementById("accountMenu");
        const userGreeting = document.getElementById("userGreeting");
        if (accountMenu && userGreeting && !userGreeting.contains(e.target) && !accountMenu.contains(e.target)) {
            accountMenu.classList.remove("show");
        }
    });
});

// ================== UTILITÁRIOS ==================
function escaparHTML(texto) {
    const div = document.createElement("div");
    div.textContent = texto == null ? "" : String(texto);
    return div.innerHTML;
}

function normalizarTexto(texto) {
    return String(texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function formatarData(data) {
    const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(data || "");
    return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : (data || "");
}

// Aviso discreto no canto da tela (substitui os alert())
function mostrarAviso(mensagem, tipo = "info") {
    let area = document.getElementById("avisos");
    if (!area) {
        area = document.createElement("div");
        area.id = "avisos";
        area.className = "avisos";
        area.setAttribute("role", "status");
        area.setAttribute("aria-live", "polite");
        document.body.appendChild(area);
    }

    const aviso = document.createElement("div");
    aviso.className = `aviso aviso-${tipo}`;
    aviso.textContent = mensagem;
    area.appendChild(aviso);

    setTimeout(() => aviso.classList.add("saindo"), 3800);
    setTimeout(() => aviso.remove(), 4200);
}

// Chamada à API em JSON; devolve { ok, status, data }
async function chamarApi(caminho, { metodo = "GET", corpo, autenticado = false } = {}) {
    const headers = {};
    if (corpo) headers["Content-Type"] = "application/json";
    if (autenticado) headers["Authorization"] = `Bearer ${localStorage.getItem("token")}`;

    const res  = await fetch(`${API_BASE_URL}${caminho}`, {
        method: metodo,
        headers,
        body: corpo ? JSON.stringify(corpo) : undefined
    });
    const data = await res.json().catch(() => ({}));

    // Sessão expirada ou conta excluída: limpa o login local
    if (autenticado && res.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");
        atualizarHeader();
    }

    return { ok: res.ok, status: res.status, data };
}

// ================== MODAL DE LOGIN / CADASTRO ==================
const ICONE_OLHO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';

function campoSenha(id, autocomplete, placeholder) {
    return `
        <div class="campo-senha">
            <input type="password" id="${id}" name="${id}" autocomplete="${autocomplete}" placeholder="${placeholder}" required>
            <button type="button" class="ver-senha" data-alvo="${id}" aria-label="Mostrar senha" aria-pressed="false">${ICONE_OLHO}</button>
        </div>`;
}

function montarModalAuth() {
    if (document.getElementById("registerModal")) return;

    const modal = document.createElement("div");
    modal.id = "registerModal";
    modal.className = "modal";
    modal.innerHTML = `
    <div class="auth-card" role="dialog" aria-modal="true" aria-labelledby="authTitulo">
        <button type="button" class="auth-fechar" aria-label="Fechar">&times;</button>
        <div class="auth-marca">GoTicket</div>

        <div class="auth-abas" role="tablist">
            <button type="button" role="tab" data-aba="login">Entrar</button>
            <button type="button" role="tab" data-aba="cadastro">Criar conta</button>
        </div>

        <!-- LOGIN -->
        <form id="loginForm" class="auth-form" data-painel="login" novalidate>
            <h2 id="authTitulo" class="auth-titulo">Bem-vindo de volta</h2>
            <p class="auth-sub">Entre para comprar e acessar seus ingressos.</p>
            <div class="auth-erro" role="alert" hidden></div>

            <label for="loginEmail">E-mail</label>
            <input type="email" id="loginEmail" name="email" autocomplete="email" placeholder="voce@exemplo.com" required>

            <label for="loginPassword">Senha</label>
            ${campoSenha("loginPassword", "current-password", "Sua senha")}

            <button type="button" class="auth-link auth-esqueci" data-aba="recuperar">Esqueci minha senha</button>
            <button type="submit" class="auth-btn">Entrar</button>

            <p class="auth-rodape">Ainda não tem conta? <button type="button" class="auth-link" data-aba="cadastro">Cadastre-se</button></p>
        </form>

        <!-- CADASTRO -->
        <form id="registerForm" class="auth-form" data-painel="cadastro" novalidate hidden>
            <h2 class="auth-titulo">Crie sua conta</h2>
            <p class="auth-sub">Leva menos de um minuto.</p>
            <div class="auth-erro" role="alert" hidden></div>

            <label for="name">Nome completo</label>
            <input type="text" id="name" name="name" autocomplete="name" placeholder="Seu nome" maxlength="100" required>

            <label for="registerEmail">E-mail</label>
            <input type="email" id="registerEmail" name="email" autocomplete="email" placeholder="voce@exemplo.com" required>

            <label for="password">Senha</label>
            ${campoSenha("password", "new-password", "Crie uma senha")}
            <ul class="requisitos-senha" id="requisitosSenha">
                <li data-regra="tamanho">Mínimo de 8 caracteres</li>
                <li data-regra="letra">Ao menos uma letra</li>
                <li data-regra="numero">Ao menos um número</li>
            </ul>

            <label for="registerPassword">Confirmar senha</label>
            ${campoSenha("registerPassword", "new-password", "Repita a senha")}

            <label class="auth-consentimento">
                <input type="checkbox" id="aceiteTermos" required>
                <span>Li e aceito os <a href="termos-de-uso.html" target="_blank" rel="noopener">Termos de Uso</a>
                e a <a href="politica-de-privacidade.html" target="_blank" rel="noopener">Política de Privacidade</a>.</span>
            </label>

            <button type="submit" class="auth-btn">Criar conta</button>

            <p class="auth-rodape">Já tem conta? <button type="button" class="auth-link" data-aba="login">Entrar</button></p>
        </form>

        <!-- RECUPERAR SENHA -->
        <form id="recoverForm" class="auth-form" data-painel="recuperar" novalidate hidden>
            <h2 class="auth-titulo">Recuperar senha</h2>
            <p class="auth-sub">Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.</p>
            <div class="auth-erro" role="alert" hidden></div>
            <div class="auth-sucesso" role="status" hidden></div>

            <label for="recoverEmail">E-mail</label>
            <input type="email" id="recoverEmail" name="email" autocomplete="email" placeholder="voce@exemplo.com" required>

            <button type="submit" class="auth-btn">Enviar link</button>

            <p class="auth-rodape"><button type="button" class="auth-link" data-aba="login">&larr; Voltar para o login</button></p>
        </form>
    </div>`;

    document.body.appendChild(modal);

    // Fechar: botão, clique fora do cartão ou tecla Esc
    modal.querySelector(".auth-fechar").addEventListener("click", fecharModal);
    modal.addEventListener("mousedown", (e) => { if (e.target === modal) fecharModal(); });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal.classList.contains("show")) fecharModal();
    });

    // Troca de aba
    modal.querySelectorAll("[data-aba]").forEach(btn => {
        btn.addEventListener("click", () => mostrarPainel(btn.dataset.aba));
    });

    // Mostrar / ocultar senha
    modal.querySelectorAll(".ver-senha").forEach(btn => {
        btn.addEventListener("click", () => {
            const input  = document.getElementById(btn.dataset.alvo);
            const mostrar = input.type === "password";
            input.type = mostrar ? "text" : "password";
            btn.setAttribute("aria-pressed", String(mostrar));
            btn.setAttribute("aria-label", mostrar ? "Ocultar senha" : "Mostrar senha");
        });
    });

    // Requisitos de senha em tempo real
    document.getElementById("password").addEventListener("input", (e) => atualizarRequisitosSenha(e.target.value));

    document.getElementById("loginForm").addEventListener("submit", (e) => { e.preventDefault(); login(); });
    document.getElementById("registerForm").addEventListener("submit", (e) => { e.preventDefault(); cadastrar(); });
    document.getElementById("recoverForm").addEventListener("submit", (e) => { e.preventDefault(); enviarRecuperacao(); });
}

function regrasSenha(senha) {
    return {
        tamanho: senha.length >= 8,
        letra:   /[A-Za-z]/.test(senha),
        numero:  /\d/.test(senha)
    };
}

function atualizarRequisitosSenha(senha) {
    const regras = regrasSenha(senha);
    document.querySelectorAll("#requisitosSenha li").forEach(li => {
        li.classList.toggle("ok", regras[li.dataset.regra]);
    });
}

function mostrarPainel(painel) {
    const modal = document.getElementById("registerModal");
    if (!modal) return;

    modal.querySelectorAll(".auth-form").forEach(form => {
        form.hidden = form.dataset.painel !== painel;
        mostrarErro(form, "");
    });
    modal.querySelectorAll(".auth-abas [data-aba]").forEach(aba => {
        const ativa = aba.dataset.aba === painel;
        aba.classList.toggle("ativa", ativa);
        aba.setAttribute("aria-selected", String(ativa));
    });
    modal.querySelector(".auth-abas").hidden = painel === "recuperar";

    // Leva o e-mail digitado no login para a recuperação
    if (painel === "recuperar") {
        const sucesso = modal.querySelector("#recoverForm .auth-sucesso");
        sucesso.hidden = true;
        document.getElementById("recoverEmail").value = document.getElementById("loginEmail").value;
    }

    const primeiroCampo = modal.querySelector(`.auth-form[data-painel="${painel}"] input`);
    if (primeiroCampo) setTimeout(() => primeiroCampo.focus(), 50);
}

function mostrarErro(form, mensagem) {
    const caixa = form.querySelector(".auth-erro");
    if (!caixa) return;
    caixa.textContent = mensagem;
    caixa.hidden = !mensagem;
}

function definirCarregando(form, carregando, textoCarregando) {
    const botao = form.querySelector(".auth-btn");
    if (carregando) {
        botao.dataset.textoOriginal = botao.textContent;
        botao.textContent = textoCarregando;
    } else if (botao.dataset.textoOriginal) {
        botao.textContent = botao.dataset.textoOriginal;
    }
    botao.disabled = carregando;
    botao.classList.toggle("carregando", carregando);
}

function abrirModal(painel = "login") {
    const modal = document.getElementById("registerModal");
    if (!modal) return;
    modal.classList.add("show");
    document.body.classList.add("modal-aberto");
    mostrarPainel(painel);
}

function fecharModal() {
    const modal = document.getElementById("registerModal");
    if (!modal) return;
    modal.classList.remove("show");
    document.body.classList.remove("modal-aberto");
}

function mostrarCadastro() { abrirModal("cadastro"); }
function mostrarLogin()    { abrirModal("login"); }
function pedirRecuperacao() { abrirModal("recuperar"); }

// ================== AUTENTICAÇÃO ==================
function salvarSessao(data) {
    localStorage.setItem("token", data.token);
    localStorage.setItem("usuario", JSON.stringify(data.user));
}

async function login() {
    const form     = document.getElementById("loginForm");
    const email    = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!email || !password) return mostrarErro(form, "Preencha e-mail e senha.");

    mostrarErro(form, "");
    definirCarregando(form, true, "Entrando...");

    try {
        const { ok, data } = await chamarApi("/auth/login", { metodo: "POST", corpo: { email, password } });
        if (!ok) throw new Error(data.error || "Não foi possível entrar.");

        salvarSessao(data);
        window.location.reload();
    } catch (err) {
        mostrarErro(form, err.message === "Failed to fetch" ? "Sem conexão com o servidor." : err.message);
        definirCarregando(form, false);
    }
}

async function cadastrar() {
    const form            = document.getElementById("registerForm");
    const name            = document.getElementById("name").value.trim();
    const email           = document.getElementById("registerEmail").value.trim();
    const password        = document.getElementById("password").value;
    const confirmPassword = document.getElementById("registerPassword").value;
    const aceite          = document.getElementById("aceiteTermos").checked;

    if (!name || !email || !password || !confirmPassword) return mostrarErro(form, "Preencha todos os campos.");
    if (!Object.values(regrasSenha(password)).every(Boolean)) return mostrarErro(form, "A senha não atende aos requisitos.");
    if (password !== confirmPassword) return mostrarErro(form, "As senhas não conferem.");
    if (!aceite) return mostrarErro(form, "Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.");

    mostrarErro(form, "");
    definirCarregando(form, true, "Criando conta...");

    try {
        const { ok, data } = await chamarApi("/auth/register", {
            metodo: "POST",
            corpo: { name, email, password, aceite_termos: true }
        });
        if (!ok) throw new Error(data.error || "Não foi possível criar a conta.");

        // A conta já volta com a sessão: entra direto
        salvarSessao(data);
        window.location.reload();
    } catch (err) {
        mostrarErro(form, err.message === "Failed to fetch" ? "Sem conexão com o servidor." : err.message);
        definirCarregando(form, false);
    }
}

async function enviarRecuperacao() {
    const form    = document.getElementById("recoverForm");
    const email   = document.getElementById("recoverEmail").value.trim();
    const sucesso = form.querySelector(".auth-sucesso");

    if (!email) return mostrarErro(form, "Informe seu e-mail.");

    mostrarErro(form, "");
    sucesso.hidden = true;
    definirCarregando(form, true, "Enviando...");

    try {
        const { ok, data } = await chamarApi("/auth/forgot-password", { metodo: "POST", corpo: { email } });
        if (!ok) throw new Error(data.error || "Não foi possível enviar o link.");

        sucesso.textContent = data.message;
        sucesso.hidden = false;
    } catch (err) {
        mostrarErro(form, err.message === "Failed to fetch" ? "Sem conexão com o servidor." : err.message);
    } finally {
        definirCarregando(form, false);
    }
}

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    window.location.href = "index.html";
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

    bannerDots.innerHTML = "";
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
        clearInterval(autoplayTimer);
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
        const res    = await fetch(`${API_BASE_URL}/auth/eventos/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error('Evento não encontrado');
        const evento = await res.json();

        document.title = `${evento.nome} | GoTicket`;
        document.getElementById('eventoNome').textContent    = evento.nome;
        document.getElementById('eventoLocal').textContent   = [evento.local, formatarData(evento.data)].filter(Boolean).join(' • ');
        document.getElementById('eventoImagem').src          = evento.imagem || './seu-evento.jpeg';
        document.getElementById('eventoImagem').alt          = evento.nome;
        document.getElementById('precoInteira').textContent  = `R$ ${Number(evento.preco_inteira).toFixed(2)}`;
        document.getElementById('precoMeia').textContent     = `R$ ${Number(evento.preco_meia).toFixed(2)}`;
        document.getElementById('precoCamarote').textContent = `R$ ${Number(evento.preco_camarote).toFixed(2)}`;

        ingressos.inteira.preco  = evento.preco_inteira;
        ingressos.meia.preco     = evento.preco_meia;
        ingressos.camarote.preco = evento.preco_camarote;

        window.eventoAtual = evento.id;

    } catch (err) {
        console.error(err);
        const el = document.getElementById('eventoNome');
        if (el) el.textContent = 'Evento não encontrado';
    }
}

// ================== EVENTOS PÚBLICOS ==================
// Lista de eventos compartilhada pela home e pela busca (uma única requisição)
function obterEventos() {
    if (!eventosPromise) {
        eventosPromise = fetch(`${API_BASE_URL}/auth/eventos`)
            .then(res => {
                if (!res.ok) throw new Error("Erro ao carregar eventos");
                return res.json();
            })
            .then(eventos => (eventosCache = eventos))
            .catch(err => {
                eventosPromise = null; // permite tentar de novo
                throw err;
            });
    }
    return eventosPromise;
}

function cardEvento(ev) {
    const detalhes = [ev.local, formatarData(ev.data)].filter(Boolean).join(' • ');
    return `
        <div class="event-card">
            <div class="event-image" style="position:relative;">
                <img src="${escaparHTML(ev.imagem || './seu-evento.jpeg')}" alt="${escaparHTML(ev.nome)}">
                <span class="event-location">${escaparHTML(detalhes)}</span>
            </div>
            <div class="event-content">
                <h3>${escaparHTML(ev.nome)}</h3>
                <p>${escaparHTML(ev.descricao || '')}</p>
                <a href="evento.html?id=${encodeURIComponent(ev.id)}" class="btn">Confira</a>
            </div>
        </div>
    `;
}

async function carregarEventosPublico() {
    const container = document.getElementById('listaEventosPublico');
    if (!container) return;

    try {
        const eventos = await obterEventos();
        montarBannerSlider(eventos);

        const termo = new URLSearchParams(window.location.search).get('busca');
        if (termo) {
            const input = document.getElementById("searchInput");
            if (input) input.value = termo;
            exibirResultadosBusca(termo);
        } else {
            exibirEventos(eventos);
        }

    } catch (err) {
        container.innerHTML = '<p class="lista-vazia">Erro ao carregar eventos.</p>';
        console.error(err);
    }
}

function exibirEventos(eventos) {
    const container = document.getElementById('listaEventosPublico');
    const titulo    = document.querySelector('#eventos .section-title');
    if (titulo) titulo.textContent = "Eventos disponíveis";

    container.innerHTML = eventos.length
        ? eventos.map(cardEvento).join('')
        : '<p class="lista-vazia">Nenhum evento disponível no momento.</p>';
}

function montarBannerSlider(eventos) {
    const bannerTrack = document.getElementById('bannerTrack');
    if (!bannerTrack) return;

    const destaques = eventos.slice(0, 5); // até 5 no banner
    if (!destaques.length) return;

    bannerTrack.innerHTML = destaques.map(ev => `
        <a href="evento.html?id=${encodeURIComponent(ev.id)}" class="banner-slide" aria-label="${escaparHTML(ev.nome)}"
           style="background-image: url('${encodeURI(ev.imagem || './seu-evento.jpeg')}')"></a>
    `).join('');

    inicializarSlider();
}

// ================== COMPRA E PAGAMENTO ==================
async function comprarIngresso() {
    const token = localStorage.getItem("token");
    if (!token) {
        mostrarAviso("Entre na sua conta para comprar.", "info");
        return abrirModal();
    }

    const itemsParaCompra = [];
    Object.entries(ingressos).forEach(([tipo, i]) => {
        if (i.qtd > 0) {
            itemsParaCompra.push({ tipo, quantity: i.qtd });
        }
    });

    if (itemsParaCompra.length === 0) return mostrarAviso("Selecione ao menos um ingresso.", "erro");
    if (!window.eventoAtual) return mostrarAviso("Evento não carregado. Recarregue a página.", "erro");

    try {
        const { ok, status, data } = await chamarApi("/auth/pagar", {
            metodo: "POST",
            autenticado: true,
            corpo: { evento_id: window.eventoAtual, items: itemsParaCompra }
        });

        if (status === 401) {
            mostrarAviso("Sua sessão expirou. Entre novamente.", "erro");
            return abrirModal();
        }

        if (ok && data.init_point) {
            window.location.href = data.init_point;
        } else {
            mostrarAviso(data.error || "Erro ao gerar link de pagamento.", "erro");
        }
    } catch (err) {
        console.error(err);
        mostrarAviso("Erro ao processar pagamento.", "erro");
    }
}

// ================== UTILITÁRIOS DE UI ==================
function atualizarHeader() {
    const token    = localStorage.getItem("token");
    const userJson = localStorage.getItem("usuario");

    const icon     = document.getElementById("userIcon");
    const greeting = document.getElementById("userGreeting");
    const menu     = document.getElementById("accountMenu");

    let user = null;
    try { user = JSON.parse(userJson); } catch (e) { user = null; }

    if (token && user) {
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
let resultadosSugestao = [];
let sugestaoAtiva      = -1;

function filtrarEventos(eventos, termo) {
    const palavras = normalizarTexto(termo).split(/\s+/).filter(Boolean);
    if (!palavras.length) return [];

    return eventos.filter(ev => {
        const texto = normalizarTexto([ev.nome, ev.local, ev.descricao, formatarData(ev.data)].join(" "));
        return palavras.every(p => texto.includes(p));
    });
}

function iniciarBusca() {
    const input = document.getElementById("searchInput");
    if (!input) return;

    input.setAttribute("autocomplete", "off");
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", "searchResults");
    input.setAttribute("aria-label", "Buscar evento por nome, local ou data");
    input.placeholder = "Buscar por evento, cidade ou data...";

    const lista = document.createElement("ul");
    lista.id = "searchResults";
    lista.className = "search-results";
    lista.setAttribute("role", "listbox");
    lista.hidden = true;
    input.closest(".search-box").appendChild(lista);

    let espera;
    input.addEventListener("input", () => {
        clearTimeout(espera);
        espera = setTimeout(atualizarSugestoes, 120);
    });
    input.addEventListener("focus", () => { if (input.value.trim()) atualizarSugestoes(); });

    document.addEventListener("click", (e) => {
        if (!input.closest(".search-box").contains(e.target)) fecharSugestoes();
    });
}

async function atualizarSugestoes() {
    const input = document.getElementById("searchInput");
    const lista = document.getElementById("searchResults");
    const termo = input.value.trim();

    if (!termo) return fecharSugestoes();

    let eventos;
    try {
        eventos = await obterEventos();
    } catch (err) {
        lista.innerHTML = '<li class="search-vazio">Não foi possível carregar os eventos.</li>';
        lista.hidden = false;
        return;
    }

    // O usuário pode ter continuado digitando enquanto carregava
    if (input.value.trim() !== termo) return;

    resultadosSugestao = filtrarEventos(eventos, termo).slice(0, 6);
    sugestaoAtiva = -1;

    if (!resultadosSugestao.length) {
        lista.innerHTML = `<li class="search-vazio">Nenhum evento encontrado para “${escaparHTML(termo)}”</li>`;
    } else {
        lista.innerHTML = resultadosSugestao.map((ev, i) => `
            <li role="option" id="sugestao-${i}" data-indice="${i}" aria-selected="false">
                <img src="${escaparHTML(ev.imagem || './seu-evento.jpeg')}" alt="">
                <div>
                    <strong>${escaparHTML(ev.nome)}</strong>
                    <span>${escaparHTML([ev.local, formatarData(ev.data)].filter(Boolean).join(' • '))}</span>
                </div>
            </li>
        `).join('') + `<li class="search-todos" data-indice="todos">Ver todos os resultados para “${escaparHTML(termo)}”</li>`;

        lista.querySelectorAll("li[data-indice]").forEach(li => {
            li.addEventListener("mousedown", (e) => {
                e.preventDefault();
                if (li.dataset.indice === "todos") return executarBusca();
                irParaEvento(resultadosSugestao[Number(li.dataset.indice)]);
            });
        });
    }

    lista.hidden = false;
    input.setAttribute("aria-expanded", "true");
}

function fecharSugestoes() {
    const input = document.getElementById("searchInput");
    const lista = document.getElementById("searchResults");
    if (lista) lista.hidden = true;
    if (input) {
        input.setAttribute("aria-expanded", "false");
        input.removeAttribute("aria-activedescendant");
    }
    sugestaoAtiva = -1;
}

function destacarSugestao(indice) {
    const input  = document.getElementById("searchInput");
    const opcoes = document.querySelectorAll("#searchResults li[role='option']");
    if (!opcoes.length) return;

    sugestaoAtiva = (indice + opcoes.length) % opcoes.length;
    opcoes.forEach((li, i) => {
        const ativa = i === sugestaoAtiva;
        li.classList.toggle("ativa", ativa);
        li.setAttribute("aria-selected", String(ativa));
    });
    input.setAttribute("aria-activedescendant", `sugestao-${sugestaoAtiva}`);
}

function irParaEvento(evento) {
    if (evento) window.location.href = `evento.html?id=${encodeURIComponent(evento.id)}`;
}

// Teclado no campo de busca (chamada pelo onkeydown do HTML)
function buscarEvento(event) {
    const lista = document.getElementById("searchResults");
    const aberta = lista && !lista.hidden;

    if (event.key === "ArrowDown" && aberta) {
        event.preventDefault();
        destacarSugestao(sugestaoAtiva + 1);
    } else if (event.key === "ArrowUp" && aberta) {
        event.preventDefault();
        destacarSugestao(sugestaoAtiva - 1);
    } else if (event.key === "Escape") {
        fecharSugestoes();
    } else if (event.key === "Enter") {
        event.preventDefault();
        if (aberta && sugestaoAtiva >= 0) return irParaEvento(resultadosSugestao[sugestaoAtiva]);
        executarBusca();
    }
}

// Enter sem sugestão escolhida ou clique na lupa: mostra todos os resultados na home
function executarBusca() {
    const input = document.getElementById("searchInput");
    if (!input) return;

    const termo = input.value.trim();
    if (!termo) {
        input.focus();
        return;
    }

    fecharSugestoes();

    if (document.getElementById("listaEventosPublico")) {
        history.replaceState(null, "", `?busca=${encodeURIComponent(termo)}`);
        exibirResultadosBusca(termo);
    } else {
        window.location.href = `index.html?busca=${encodeURIComponent(termo)}`;
    }
}

async function exibirResultadosBusca(termo) {
    const container = document.getElementById('listaEventosPublico');
    const titulo    = document.querySelector('#eventos .section-title');

    let eventos;
    try {
        eventos = await obterEventos();
    } catch (err) {
        container.innerHTML = '<p class="lista-vazia">Erro ao carregar eventos.</p>';
        return;
    }

    const encontrados = filtrarEventos(eventos, termo);

    if (titulo) {
        titulo.innerHTML = `${encontrados.length} resultado${encontrados.length === 1 ? '' : 's'} para “${escaparHTML(termo)}”
            <button type="button" class="limpar-busca" onclick="limparBusca()">Limpar busca</button>`;
    }

    container.innerHTML = encontrados.length
        ? encontrados.map(cardEvento).join('')
        : `<p class="lista-vazia">Nenhum evento encontrado. Tente buscar pelo nome do artista, cidade ou data (ex: 12/04).</p>`;

    document.getElementById("eventos").scrollIntoView({ behavior: "smooth", block: "start" });
}

function limparBusca() {
    const input = document.getElementById("searchInput");
    if (input) input.value = "";
    history.replaceState(null, "", window.location.pathname);
    exibirEventos(eventosCache);
}

// ================== FUNÇÕES DE INTERFACE ==================
function abrirBusca() {
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
        mostrarAviso("Entre na sua conta para ver seus ingressos.", "info");
        abrirModal();
        return;
    }
    window.location.href = "meus-ingressos.html";
}
