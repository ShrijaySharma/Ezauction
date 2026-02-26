const url = "https://arrtlpxbyahfijxlxdpc.supabase.co/rest/v1/";
fetch(url)
    .then(res => { console.log('Status:', res.status); return res.text(); })
    .then(text => console.log('Body:', text))
    .catch(err => console.error('Error:', err.message, err.cause));
