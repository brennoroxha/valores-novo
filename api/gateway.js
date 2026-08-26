export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const SUPABASE_URL = 'https://xxhvnwllvwmirigqeamx.supabase.co';
    const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aHZud2xsdndtaXJpZ3FlYW14Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzY4NTM3NSwiZXhwIjoyMTAzMjYxMzc1fQ.pryomcIz2CfnE2C7sF5rqOdBnAIUsTJbWfX3AiIUXs4';

    try {
        const supabaseResponse = await fetch(`${SUPABASE_URL}/rest/v1/config_valores_novo?chave=eq.active_gateway&select=valor`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const configs = await supabaseResponse.json();
        
        let activeGateway = 'freepay'; // default
        if (Array.isArray(configs) && configs.length > 0) {
            activeGateway = configs[0].valor;
        }

        return res.status(200).json({ active_gateway: activeGateway });
    } catch (error) {
        console.error("Erro ao buscar active_gateway:", error);
        return res.status(200).json({ active_gateway: 'freepay' });
    }
}
