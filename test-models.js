require('dotenv').config();

async function getModels() {
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
        throw new Error('Missing NVIDIA_API_KEY in .env');
    }

    const res = await fetch('https://integrate.api.nvidia.com/v1/models', {
        headers: {
            Authorization: `Bearer ${apiKey}`
        }
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`NVIDIA API request failed: ${res.status} ${body}`);
    }

    const data = await res.json();
    const ids = Array.isArray(data?.data) ? data.data.map((m) => m.id) : [];
    console.log(JSON.stringify(ids, null, 2));
}

getModels().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
