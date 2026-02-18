import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase URL or Key missing in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPlayers() {
    console.log('🔍 Checking players in Supabase...');
    try {
        const { data: players, error } = await supabase
            .from('players')
            .select('*, teams(name)')
            .order('id', { ascending: true });

        if (error) {
            console.error('❌ Error fetching players:', error.message);
            return;
        }

        console.log(`✅ Found ${players.length} players.`);
        if (players.length > 0) {
            console.log('Last 5 players:');
            players.slice(-5).forEach(p => console.log(` - [${p.id}] ${p.name} (${p.status})`));
        }
    } catch (err) {
        console.error('❌ Unexpected error:', err);
    }
}

checkPlayers();
