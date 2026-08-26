export default async function handler(req, res) {
    // Apenas permite requisições POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const SUPABASE_URL = 'https://xxhvnwllvwmirigqeamx.supabase.co';
    const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aHZud2xsdndtaXJpZ3FlYW14Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzY4NTM3NSwiZXhwIjoyMTAzMjYxMzc1fQ.pryomcIz2CfnE2C7sF5rqOdBnAIUsTJbWfX3AiIUXs4';

    try {
        const { cpf, nome, email, telefone } = req.body;

        if (!cpf || !nome) {
            return res.status(400).json({ error: 'CPF e Nome são obrigatórios.' });
        }

        // 1. Buscar Chaves do FreePay no Supabase
        const supabaseResponse = await fetch(`${SUPABASE_URL}/rest/v1/config_valores_novo?select=chave,valor`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const configs = await supabaseResponse.json();
        
        // Verifica se o Supabase retornou erro ou não achou configs
        if (!Array.isArray(configs)) {
            return res.status(500).json({ error: 'Erro de permissão no Supabase. A API precisa da SERVICE ROLE KEY para ler as configurações.', detalhes: configs });
        }

        const getConf = (key) => {
            const found = configs.find(c => c.chave === key);
            return found ? found.valor : null;
        };

        const publicKey = getConf('freepay_public_key');
        const secretKey = getConf('freepay_secret_key');
        const amountStr = '72.22';

        if (!publicKey || !secretKey) {
            return res.status(500).json({ error: 'Chaves da API do FreePay não configuradas no Admin.' });
        }

        // Converter valor de R$ para centavos
        const amountCents = Math.round(parseFloat(amountStr) * 100);

        // 2. Chamar a API do FreePay
        const authBase64 = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');
        
        const freepayPayload = {
            amount: amountCents,
            payment_method: "pix",
            customer: {
                name: nome,
                email: email || "nao_informado@email.com",
                document: {
                    number: cpf.replace(/\D/g, ''),
                    type: "cpf"
                },
                phone: telefone || "11999999999"
            },
            items: [
                {
                    title: "Taxa de Verificação de Valores",
                    unit_price: amountCents,
                    quantity: 1,
                    tangible: false
                }
            ],
            pix: {
                expires_in_days: 1
            },
            metadata: {
                origem: "checkout_valores"
            }
        };

        const freepayResponse = await fetch('https://api.freepaybrasil.com/v1/payment-transaction/create', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authBase64}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(freepayPayload)
        });

        const freepayData = await freepayResponse.json();

        if (!freepayResponse.ok) {
            console.error("Erro no FreePay:", freepayData);
            return res.status(400).json({ error: 'Erro ao gerar PIX no gateway.', details: freepayData });
        }

        // O FreePay geralmente retorna no seguinte formato para transações PIX
        // transaction.pix.qrcode_text e transaction.pix.qrcode_base64
        const pixData = freepayData.data?.pix || freepayData.pix || freepayData;

        return res.status(200).json({
            success: true,
            transaction_id: freepayData.data?.id || freepayData.id,
            qr_code_base64: pixData.qrcode_base64 || pixData.qr_code_base64 || null, 
            emv_code: pixData.qr_code || pixData.qrcode_text || pixData.emv_code || pixData.copy_paste || pixData.payload,
            raw_response: freepayData
        });

    } catch (error) {
        console.error("Erro interno:", error);
        return res.status(500).json({ error: 'Erro interno no servidor', details: error.message });
    }
}
