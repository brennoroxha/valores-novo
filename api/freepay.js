export default async function handler(req, res) {
    // Apenas permite requisições POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const SUPABASE_URL = 'https://xxhvnwllvwmirigqeamx.supabase.co';
    const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aHZud2xsdndtaXJpZ3FlYW14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2ODUzNzUsImV4cCI6MjEwMzI2MTM3NX0.j8aczTiuUaYQ1-yaBSvIbvDWXBVOvdlRgsY_ttzcGfA';

    if (!SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: 'Chave do Supabase ausente.' });
    }

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
        const pixData = freepayData.transaction?.pix || freepayData.pix || freepayData;

        return res.status(200).json({
            success: true,
            transaction_id: freepayData.id || freepayData.transaction?.id,
            qr_code_base64: pixData.qrcode_base64 || pixData.qr_code_base64 || pixData.qr_code, 
            emv_code: pixData.qrcode_text || pixData.emv_code || pixData.copy_paste
        });

    } catch (error) {
        console.error("Erro interno:", error);
        return res.status(500).json({ error: 'Erro interno no servidor', details: error.message });
    }
}
