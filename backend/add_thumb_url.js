import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase URL or Key missing in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addThumbUrlColumn() {
    try {
        // Unfortunately Supabase JS client doesn't support raw SQL easily unless using RPC.
        // We will just try an empty update to see if the column exists.  But we can't alter table.
        console.log("Please run this SQL in your Supabase SQL Editor:");
        console.log("-------------------------------------------------");
        console.log("ALTER TABLE players ADD COLUMN thumb_url TEXT;");
        console.log("-------------------------------------------------");
        console.log("I cannot run raw SQL ALTER TABLE commands from the JS client directly.");

    } catch (err) {
        console.error('Error:', err);
    }
}

addThumbUrlColumn();
