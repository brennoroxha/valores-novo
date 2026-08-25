const SUPABASE_URL = 'https://xxhvnwllvwmirigqeamx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aHZud2xsdndtaXJpZ3FlYW14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2ODUzNzUsImV4cCI6MjEwMzI2MTM3NX0.j8aczTiuUaYQ1-yaBSvIbvDWXBVOvdlRgsY_ttzcGfA';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Elementos da UI
const appContainer = document.getElementById('app-container');
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const loginErrorText = document.getElementById('login-error-text');
const tablePedidos = document.getElementById('table-pedidos');

// Estado
let pedidosCachados = [];

// Checar sessão ao carregar
async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    appContainer.classList.remove('hidden');
    if (session) {
        showDashboard();
    } else {
        showLogin();
    }
}

function showLogin() {
    loginScreen.classList.remove('hidden');
    dashboardScreen.classList.add('hidden');
}

function showDashboard() {
    loginScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    fetchStats();
    fetchPedidos();
    fetchConfig();
}

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = document.getElementById('btn-login');
    
    btn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i>';
    loginError.classList.add('hidden');

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        loginErrorText.textContent = error.message;
        loginError.classList.remove('hidden');
        btn.innerHTML = '<span>Entrar</span><i data-lucide="arrow-right" class="w-4 h-4"></i>';
        lucide.createIcons();
    } else {
        showDashboard();
    }
});

// Logout
async function logout() {
    await supabaseClient.auth.signOut();
    showLogin();
}

// Navegação de abas
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tabId}`).classList.remove('hidden');
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-white/10', 'text-white');
        btn.classList.add('text-gray-300', 'hover:bg-white/5');
    });
    const activeBtn = document.getElementById(`nav-${tabId}`);
    activeBtn.classList.remove('text-gray-300', 'hover:bg-white/5');
    activeBtn.classList.add('bg-white/10', 'text-white');
}

// Buscar Dados
async function fetchStats() {
    const { data, error } = await supabase
        .from('pedidos_valores_novo')
        .select('status', { count: 'exact' });

    if (!error && data) {
        const total = data.length;
        const pagos = data.filter(p => p.status === 'pago').length;
        const pendentes = data.filter(p => p.status === 'pendente').length;

        document.getElementById('stat-total').textContent = total;
        document.getElementById('stat-pagos').textContent = pagos;
        document.getElementById('stat-pendentes').textContent = pendentes;
    }
}

async function fetchPedidos() {
    tablePedidos.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500"><i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto mb-2"></i>Carregando pedidos...</td></tr>';
    lucide.createIcons();

    const { data, error } = await supabase
        .from('pedidos_valores_novo')
        .select('*')
        .order('data_criacao', { ascending: false });

    if (error) {
        tablePedidos.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">Erro ao carregar dados: ${error.message}</td></tr>`;
        return;
    }

    pedidosCachados = data;
    renderTable();
}

function renderTable() {
    if (pedidosCachados.length === 0) {
        tablePedidos.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">Nenhum pedido encontrado.</td></tr>';
        return;
    }

    tablePedidos.innerHTML = '';
    pedidosCachados.forEach(p => {
        const data = new Date(p.data_criacao).toLocaleString('pt-BR');
        const statusClass = p.status === 'pago' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
        const isPago = p.status === 'pago';

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 transition-colors';
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-gray-500">${data}</td>
            <td class="px-6 py-4">
                <div class="font-semibold text-gray-900">${p.nome || 'Não informado'}</div>
                <div class="text-xs text-gray-500">CPF: ${p.cpf || 'Não informado'}</div>
            </td>
            <td class="px-6 py-4">
                <div class="text-gray-900">${p.email || '—'}</div>
                <div class="text-xs text-gray-500">${p.telefone || '—'}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${statusClass}">${p.status}</span>
            </td>
            <td class="px-6 py-4 text-gray-500 text-xs font-mono">${p.ip || '—'}</td>
            <td class="px-6 py-4 text-right space-x-2">
                ${!isPago ? `<button onclick="marcarPago('${p.id}')" title="Marcar Pago" class="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100"><i data-lucide="check" class="w-4 h-4"></i></button>` : ''}
                <button onclick="bloquearIP('${p.ip}')" title="Bloquear IP" class="p-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100"><i data-lucide="shield-alert" class="w-4 h-4"></i></button>
                <button onclick="removerPedido('${p.id}')" title="Excluir" class="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </td>
        `;
        tablePedidos.appendChild(tr);
    });
    lucide.createIcons();
}

// Ações
async function marcarPago(id) {
    if(!confirm("Marcar este pedido como PAGO?")) return;
    const { error } = await supabaseClient.from('pedidos_valores_novo').update({ status: 'pago' }).eq('id', id);
    if (!error) {
        fetchPedidos();
        fetchStats();
    } else {
        alert("Erro: " + error.message);
    }
}

async function removerPedido(id) {
    if(!confirm("Tem certeza que deseja excluir permanentemente este pedido?")) return;
    const { error } = await supabaseClient.from('pedidos_valores_novo').delete().eq('id', id);
    if (!error) {
        fetchPedidos();
        fetchStats();
    } else {
        alert("Erro: " + error.message);
    }
}

async function bloquearIP(ip) {
    if(!ip || ip === '—') {
        alert("Nenhum IP registrado para este pedido.");
        return;
    }
    const motivo = prompt(`Deseja bloquear o IP ${ip}? Informe um motivo (opcional):`, "Fraude suspeita");
    if (motivo === null) return;

    const { error } = await supabaseClient.from('blocked_ips_valores_novo').insert({ ip: ip, motivo: motivo });
    if (!error || error.code === '23505') { // 23505 é erro de unicidade (já bloqueado)
        alert(`IP ${ip} bloqueado com sucesso!`);
    } else {
        alert("Erro ao bloquear IP: " + error.message);
    }
}

// Configurações (Gateway)
async function fetchConfig() {
    const { data } = await supabaseClient.from('config_valores_novo').select('valor').eq('chave', 'active_gateway').single();
    if (data) {
        const radio = document.querySelector(`input[name="gateway"][value="${data.valor}"]`);
        if (radio) radio.checked = true;
    }
}

async function salvarGateway() {
    const selected = document.querySelector('input[name="gateway"]:checked');
    if (!selected) return;

    const btn = event.currentTarget;
    btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Salvando...';
    lucide.createIcons();

    const { error } = await supabaseClient.from('config_valores_novo').upsert({ chave: 'active_gateway', valor: selected.value });
    
    btn.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> Salvar Configuração';
    lucide.createIcons();

    if (!error) {
        const msg = document.getElementById('gateway-msg');
        msg.classList.remove('hidden');
        setTimeout(() => msg.classList.add('hidden'), 3000);
    } else {
        alert("Erro ao salvar: " + error.message);
    }
}

// Iniciar
checkSession();
