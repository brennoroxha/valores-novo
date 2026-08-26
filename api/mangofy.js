export default async function handler(req, res) {
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

        // Buscar Chaves do MangoFY no Supabase
        const supabaseResponse = await fetch(`${SUPABASE_URL}/rest/v1/config_valores_novo?select=chave,valor`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const configs = await supabaseResponse.json();
        
        if (!Array.isArray(configs)) {
            return res.status(500).json({ error: 'Erro ao consultar Supabase.', detalhes: configs });
        }

        const getConf = (key) => {
            const found = configs.find(c => c.chave === key);
            return found ? found.valor : null;
        };

        const apiKey = getConf('mangofy_api_key');
        const storeCode = getConf('mangofy_store_code');
        const amountStr = '72.22';

        if (!apiKey || !storeCode) {
            return res.status(500).json({ error: 'Chaves da API do MangoFY não configuradas no Admin.' });
        }

        // Converter valor de R$ para centavos
        const amountCents = Math.round(parseFloat(amountStr) * 100);

        // Registrar pedido no Supabase ignorando RLS
        const ip = req.body.ip || '—';
        await fetch(`${SUPABASE_URL}/rest/v1/pedidos_valores_novo`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            },
            body: JSON.stringify({ cpf: cpf.replace(/\D/g, ""), nome: nome, ip: ip, status: 'pendente' })
        }).catch(err => console.error("Erro ao salvar pedido no banco (MangoFY):", err));

        const mangofyPayload = {
            external_code: `pedido-${Date.now()}`,
            payment_method: "pix",
            payment_format: "regular",
            installments: 1,
            payment_amount: amountCents,
            shipping_amount: 0,
            postback_url: `https://${req.headers.host || 'consultagora.site'}/api/webhook/mangofy`,
            items: [
                {
                    title: "Taxa de Consulta",
                    unit_price: amountCents,
                    quantity: 1,
                    tangible: false
                }
            ],
            customer: {
                name: nome,
                email: email || "nao_informado@email.com",
                document: cpf.replace(/\D/g, ''),
                phone: telefone || "11999999999",
                ip: ip
            },
            pix: {
                expires_in_days: 1
            }
        };

        const apiResponse = await fetch('https://checkout.mangofy.com.br/api/v1/payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': apiKey.trim(),
                'Store-Code': storeCode.trim()
            },
            body: JSON.stringify(mangofyPayload)
        });

        const rawText = await apiResponse.text();
        let apiData;
        try {
            apiData = JSON.parse(rawText);
        } catch (e) {
            console.error("MangoFY retornou HTML em vez de JSON. Status:", apiResponse.status);
            return res.status(400).json({ 
                error: `A API do MangoFY retornou um erro não esperado (Status ${apiResponse.status}). Provavelmente URL ou chaves inválidas.`, 
                details: { html_snippet: rawText.substring(0, 200) } 
            });
        }

        if (!apiResponse.ok) {
            console.error("Erro no MangoFY:", apiData);
            return res.status(400).json({ error: 'Erro ao gerar PIX no MangoFY.', details: apiData });
        }

        // Tenta achar o PIX no formato mais provável do MangoFY
        const pixData = apiData.data?.pix || apiData.pix || apiData.payment || apiData;

        return res.status(200).json({
            success: true,
            transaction_id: apiData.payment_code || apiData.id || pixData.id,
            qr_code_base64: pixData.pix_qrcode_image || pixData.qrcode_base64 || pixData.qr_code_base64 || null, 
            emv_code: pixData.pix_qrcode_text || pixData.qr_code || pixData.qrcode || pixData.emv_code || pixData.copy_paste || pixData.payload || pixData.pix_key,
            raw_response: apiData
        });

    } catch (error) {
        console.error("Erro interno no MangoFY:", error);
        return res.status(500).json({ error: 'Erro interno no servidor (MangoFY).', details: error.message });
    }
}
