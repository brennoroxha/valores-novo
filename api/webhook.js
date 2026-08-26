export default async function handler(req, res) {
    // Vercel lida automaticamente com req.body se for JSON
    
    // Retornar 200 rápido para GET (apenas teste/ping)
    if (req.method === 'GET') {
        return res.status(200).json({ status: 'Webhook endpoint is active. Waiting for POST.' });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const body = req.body || {};
        console.log("Webhook Recebido:", JSON.stringify(body));

        // Tentar extrair o Status de forma flexível (MangoFY ou FreePay)
        const statusRaw = body.payment_status || body.status || body.state || body.status_name || '';
        const statusStr = String(statusRaw).toLowerCase();

        // Tentar extrair o CPF de forma flexível
        let cpfRaw = body.customer?.document || body.customer?.cpf || body.cpf || body.document || '';
        
        // Se a estrutura do FreePay for diferente, tentar navegar
        if (!cpfRaw && body.customer?.document?.number) {
            cpfRaw = body.customer.document.number;
        }

        const cpf = String(cpfRaw).replace(/\D/g, '');

        // Identificar se é sucesso
        const isPaid = ['approved', 'paid', 'pago', 'sucesso', 'completed'].includes(statusStr);

        if (!isPaid) {
            console.log(`Pagamento não aprovado no webhook. Status recebido: ${statusRaw}`);
            return res.status(200).json({ message: 'Ignorado. Status não é de aprovação.', status: statusRaw });
        }

        if (!cpf) {
            console.log("CPF não encontrado no payload do webhook.");
            // Mesmo com erro, retornamos 200 para o gateway não ficar repetindo o webhook infinitamente
            return res.status(200).json({ message: 'CPF não encontrado no payload.' });
        }

        const SUPABASE_URL = 'https://xxhvnwllvwmirigqeamx.supabase.co';
        const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aHZud2xsdndtaXJpZ3FlYW14Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzY4NTM3NSwiZXhwIjoyMTAzMjYxMzc1fQ.pryomcIz2CfnE2C7sF5rqOdBnAIUsTJbWfX3AiIUXs4';

        // Buscar o último pedido pendente desse CPF
        const getQuery = `${SUPABASE_URL}/rest/v1/pedidos_valores_novo?cpf=eq.${cpf}&status=eq.pendente&order=data_criacao.desc&limit=1`;
        
        const getResponse = await fetch(getQuery, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const pedidos = await getResponse.json();

        if (!pedidos || pedidos.length === 0) {
            console.log(`Nenhum pedido pendente encontrado para o CPF ${cpf}. Pode já ter sido baixado.`);
            return res.status(200).json({ message: 'Nenhum pedido pendente encontrado para baixar.' });
        }

        const pedidoId = pedidos[0].id;

        // Atualizar pedido para pago
        const updateQuery = `${SUPABASE_URL}/rest/v1/pedidos_valores_novo?id=eq.${pedidoId}`;
        const updateResponse = await fetch(updateQuery, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ status: 'pago' })
        });

        if (!updateResponse.ok) {
            console.error("Erro ao atualizar o Supabase via Webhook", await updateResponse.text());
            return res.status(500).json({ error: 'Erro ao atualizar banco de dados.' });
        }

        console.log(`Baixa com sucesso! Pedido ${pedidoId} do CPF ${cpf} atualizado para pago.`);
        return res.status(200).json({ message: 'Pagamento processado com sucesso.' });

    } catch (error) {
        console.error("Erro no processamento do Webhook:", error);
        // Sempre bom retornar 2xx ou 4xx tratado para gateways
        return res.status(200).json({ error: 'Erro interno', details: error.message });
    }
}
