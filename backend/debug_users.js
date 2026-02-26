import 'dotenv/config';
import { supabase } from './supabaseClient.js';

async function getUsers() {
    console.log('Fetching users...');
    try {
        const { data, error } = await supabase.from('users').select('*');
        if (error) {
            console.error('Supabase error:', error);
        } else {
            console.log('Users found:', data.length);
            console.log(data);
        }
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

getUsers();
