async function getModels() {
    const res = await fetch('https://integrate.api.nvidia.com/v1/models', {
        headers: {
            'Authorization': 'Bearer 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'
        }
    });
    const data = await res.json();
    console.log(JSON.stringify(data.data.map(m => m.id), null, 2));
}

getModels();
