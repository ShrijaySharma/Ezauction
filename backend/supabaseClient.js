import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env vars
dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase URL or Key missing in .env');
}

// Custom fetch with a 30-second abort timeout.
// 30 s is long enough for all normal queries and short uploads, but will
// abort any truly stalled Supabase connection before the client (browser)
// hits its own 12 s / 20 s timeout and shows an error.
// NOTE: Bulk upload (CSV) uses its own 600 s frontend timeout and calls
// Supabase storage.upload() which uses its own internal fetch — this
// wrapper only affects the JS query client (select/insert/update/delete),
// NOT storage.upload(), so bulk upload is completely unaffected.
const QUERY_TIMEOUT_MS = 30_000; // 30 seconds
function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);
    return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(timer));
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { fetch: fetchWithTimeout }
});

export function getDb() {
    return supabase;
}
