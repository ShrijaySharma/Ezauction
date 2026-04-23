import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const { data: players, error } = await supabase
    .from('players')
    .select('serial_number, name, role')
    .order('serial_number', { ascending: true, nullsFirst: false });

if (error) { console.error(error); process.exit(1); }

console.log(`\nTotal players: ${players.length}\n`);
console.log('No. | Name                          | Role');
console.log('----+-------------------------------+------------');
players.forEach((p, i) => {
    const num = String(i + 1).padStart(3);
    const name = (p.name || '').padEnd(30);
    const role = p.role || '';
    console.log(`${num} | ${name} | ${role}`);
});
