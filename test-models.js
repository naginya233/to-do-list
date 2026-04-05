async function getModels() {
    const res = await fetch('https://integrate.api.nvidia.com/v1/models', {
        headers: {
            'Authorization': 'Bearer REDACTED'
        }
    });
    const data = await res.json();
    console.log(JSON.stringify(data.data.map(m => m.id), null, 2));
}

getModels();
