require('dotenv').config();

async function getModels() {
    const res = await fetch('https://integrate.api.nvidia.com/v1/models', {
        headers: {
            'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`
        }
    });
    const data = await res.json();
    console.log(JSON.stringify(data.data.map(m => m.id), null, 2));
}

getModels();
