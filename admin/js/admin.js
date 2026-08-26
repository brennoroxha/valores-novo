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
let bloqueiosCachados = [];

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
    fetchBloqueios();
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

    let query = supabaseClient.from('pedidos_valores_novo').select('*').order('data_criacao', { ascending: false });

    const filterEl = document.getElementById('filter-date');
    const filter = filterEl ? filterEl.value : 'total';
    const now = new Date();
    
    if (filter === 'hoje') {
        const start = new Date(now.setHours(0,0,0,0)).toISOString();
        query = query.gte('data_criacao', start);
    } else if (filter === 'ontem') {
        const start = new Date(now.setDate(now.getDate() - 1));
        start.setHours(0,0,0,0);
        const end = new Date(start);
        end.setHours(23,59,59,999);
        query = query.gte('data_criacao', start.toISOString()).lte('data_criacao', end.toISOString());
    } else if (filter === '7dias') {
        const start = new Date(now.setDate(now.getDate() - 7));
        start.setHours(0,0,0,0);
        query = query.gte('data_criacao', start.toISOString());
    } else if (filter === 'personalizado') {
        const startVal = document.getElementById('date-start').value;
        const endVal = document.getElementById('date-end').value;
        if (startVal) query = query.gte('data_criacao', new Date(startVal + 'T00:00:00').toISOString());
        if (endVal) query = query.lte('data_criacao', new Date(endVal + 'T23:59:59').toISOString());
    }

    const { data, error } = await query;

    if (error) {
        tablePedidos.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">Erro ao carregar dados: ${error.message}</td></tr>`;
        return;
    }

    pedidosCachados = data;
    renderTable();
}

function renderTable() {
    if (pedidosCachados.length === 0) {
        tablePedidos.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">Nenhum pedido encontrado no período.</td></tr>';
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

function toggleCustomDate() {
    const filter = document.getElementById('filter-date').value;
    const container = document.getElementById('custom-date-container');
    if (filter === 'personalizado') {
        container.classList.remove('hidden');
        container.classList.add('flex');
    } else {
        container.classList.add('hidden');
        container.classList.remove('flex');
        fetchPedidos(); // Atualiza automaticamente ao trocar (exceto personalizado)
    }
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
        fetchBloqueios();
    } else {
        alert("Erro ao bloquear IP: " + error.message);
    }
}

async function fetchBloqueios() {
    const table = document.getElementById('table-bloqueios');
    if(!table) return;

    table.innerHTML = '<tr><td colspan="4" class="px-6 py-8 text-center text-gray-500"><i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto mb-2"></i>Carregando bloqueios...</td></tr>';
    lucide.createIcons();

    const { data, error } = await supabaseClient.from('blocked_ips_valores_novo').select('*').order('data_bloqueio', { ascending: false });

    if (error) {
        table.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-red-500">Erro: ${error.message}</td></tr>`;
        return;
    }

    bloqueiosCachados = data;
    renderBloqueios();
}

function renderBloqueios() {
    const table = document.getElementById('table-bloqueios');
    if (!table) return;

    if (bloqueiosCachados.length === 0) {
        table.innerHTML = '<tr><td colspan="4" class="px-6 py-8 text-center text-gray-500">Nenhum IP bloqueado no momento.</td></tr>';
        return;
    }

    table.innerHTML = '';
    bloqueiosCachados.forEach(b => {
        const data = new Date(b.data_bloqueio).toLocaleString('pt-BR');
        
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 transition-colors';
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-gray-900 font-mono font-medium">${b.ip}</td>
            <td class="px-6 py-4 text-gray-600">${b.motivo || 'Sem motivo'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-gray-500 text-sm">${data}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right">
                <button onclick="desbloquearIP('${b.ip}')" class="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 flex items-center gap-1 ml-auto">
                    <i data-lucide="unlock" class="w-4 h-4"></i> Desbloquear
                </button>
            </td>
        `;
        table.appendChild(tr);
    });
    lucide.createIcons();
}

async function bloquearIPManual() {
    const ipInput = document.getElementById('input-block-ip');
    const motivoInput = document.getElementById('input-block-motivo');
    
    if(!ipInput || !ipInput.value) {
        alert("Por favor, digite um IP válido.");
        return;
    }
    
    const { error } = await supabaseClient.from('blocked_ips_valores_novo').insert({ 
        ip: ipInput.value.trim(), 
        motivo: motivoInput.value.trim() || 'Bloqueio Manual' 
    });
    
    if (!error || error.code === '23505') {
        alert(`IP ${ipInput.value} bloqueado com sucesso!`);
        ipInput.value = '';
        motivoInput.value = '';
        fetchBloqueios();
    } else {
        alert("Erro ao bloquear IP: " + error.message);
    }
}

async function desbloquearIP(ip) {
    if(!confirm(`Tem certeza que deseja desbloquear o IP: ${ip}?`)) return;
    
    const { error } = await supabaseClient.from('blocked_ips_valores_novo').delete().eq('ip', ip);
    if (!error) {
        fetchBloqueios();
    } else {
        alert("Erro ao desbloquear: " + error.message);
    }
}

// Configurações (Gateway)
function toggleGatewaySettings() {
    const selected = document.querySelector('input[name="gateway"]:checked');
    const fpSettings = document.getElementById('freepay-settings');
    if (fpSettings) {
        if (selected && selected.value === 'freepay') {
            fpSettings.classList.remove('hidden');
        } else {
            fpSettings.classList.add('hidden');
        }
    }
}

async function fetchConfig() {
    const { data: configs } = await supabaseClient.from('config_valores_novo').select('*');
    if (configs) {
        const activeGw = configs.find(c => c.chave === 'active_gateway');
        if (activeGw) {
            const radio = document.querySelector(`input[name="gateway"][value="${activeGw.valor}"]`);
            if (radio) {
                radio.checked = true;
                toggleGatewaySettings();
            }
        }
        
        const fpPub = configs.find(c => c.chave === 'freepay_public_key');
        if (fpPub && document.getElementById('freepay-public-key')) document.getElementById('freepay-public-key').value = fpPub.valor;
        
        const fpSec = configs.find(c => c.chave === 'freepay_secret_key');
        if (fpSec && document.getElementById('freepay-secret-key')) document.getElementById('freepay-secret-key').value = fpSec.valor;
        

    }
}

async function salvarGateway() {
    const selected = document.querySelector('input[name="gateway"]:checked');
    if (!selected) return;

    const btn = event.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Salvando...';
    lucide.createIcons();

    let updates = [{ chave: 'active_gateway', valor: selected.value }];
    
    if (selected.value === 'freepay') {
        const pub = document.getElementById('freepay-public-key')?.value || '';
        const sec = document.getElementById('freepay-secret-key')?.value || '';

        
        updates.push({ chave: 'freepay_public_key', valor: pub });
        updates.push({ chave: 'freepay_secret_key', valor: sec });

    }

    let hasError = false;
    for (const update of updates) {
        const { error } = await supabaseClient.from('config_valores_novo').upsert(update);
        if (error) hasError = true;
    }
    
    btn.innerHTML = originalText;
    lucide.createIcons();

    if (!hasError) {
        const msg = document.getElementById('gateway-msg');
        msg.classList.remove('hidden');
        setTimeout(() => msg.classList.add('hidden'), 3000);
    } else {
        alert("Ocorreu um erro ao salvar algumas configurações.");
    }
}

// Iniciar
checkSession();
