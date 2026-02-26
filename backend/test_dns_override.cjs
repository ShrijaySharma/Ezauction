import dns from 'dns';

// Mock DNS lookup
const originalLookup = dns.lookup;
dns.lookup = (hostname, options, callback) => {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    if (hostname === 'arrtlpxbyahfijxlxdpc.supabase.co') {
        console.log('Intercepted DNS request for Supabase!');
        return callback(null, '104.18.38.10', 4);
    }
    return originalLookup(hostname, options, callback);
};

const url = "https://arrtlpxbyahfijxlxdpc.supabase.co/rest/v1/";
fetch(url)
    .then(res => { console.log('Status with fetch:', res.status); })
    .catch(err => console.error('Fetch error:', err.message));
