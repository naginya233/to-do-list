require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Enable CORS for all routes so the frontend can communicate with this backend
app.use(cors());

// Parse incoming JSON body payloads
app.use(express.json());

// Load Secure Environment Variables
const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY;
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;

// Provider Configurations map holding endpoints and their respective secure keys
const API_PROVIDERS = {
    zhipu: {
        url: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
        key: ZHIPU_API_KEY
    },
    // Map all the NVIDIA models to the same NVIDIA api endpoint and key
    nvidia_llama_70b: { url: "https://integrate.api.nvidia.com/v1/chat/completions", key: NVIDIA_API_KEY },
    nvidia_llama_8b: { url: "https://integrate.api.nvidia.com/v1/chat/completions", key: NVIDIA_API_KEY },
    nvidia_nemotron: { url: "https://integrate.api.nvidia.com/v1/chat/completions", key: NVIDIA_API_KEY },
    nvidia_mixtral: { url: "https://integrate.api.nvidia.com/v1/chat/completions", key: NVIDIA_API_KEY },
    nvidia_glm: { url: "https://integrate.api.nvidia.com/v1/chat/completions", key: NVIDIA_API_KEY },
    nvidia_minimax: { url: "https://integrate.api.nvidia.com/v1/chat/completions", key: NVIDIA_API_KEY }
};

app.post('/api/chat', async (req, res) => {
    try {
        const { providerId, requestBody } = req.body;
        const config = API_PROVIDERS[providerId];

        if (!config) {
            return res.status(400).json({ error: `Unknown provider mapping: ${providerId}` });
        }

        console.log(`[Proxy] Forwarding request to ${providerId} (${requestBody.model})...`);

        // Forward the fetch request to the actual LLM API endpoint
        const response = await fetch(config.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.key}` // Securely attach the key backend-side
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[Proxy Error] API responded with ${response.status}`, errText);
            return res.status(response.status).send(errText);
        }

        const data = await response.json();
        res.json(data); // Send the successful response back to the frontend

    } catch (error) {
        console.error("[Proxy Internal Error]:", error);
        res.status(500).json({ error: "Backend proxy server failed to fetch from LLM API." });
    }
});

app.listen(PORT, () => {
    console.log(`Web Toolbox AI Proxy Server running securely on http://localhost:${PORT}`);
    console.log(`Loaded ${Object.keys(API_PROVIDERS).length} AI Provider configurations.`);
});
