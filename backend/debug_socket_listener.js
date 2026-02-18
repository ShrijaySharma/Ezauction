
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { io } from 'socket.io-client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure .env is loaded
const envPath = join(__dirname, '.env');
dotenv.config({ path: envPath });

const port = process.env.PORT || 4000;
const socketUrl = `http://localhost:${port}`;

console.log(`Connecting to socket at ${socketUrl}...`);

const socket = io(socketUrl);

socket.on('connect', () => {
    console.log('Connected to socket!');

    // Listen for bid-placed to see what we get back (loopback)
    socket.on('bid-placed', (data) => {
        console.log('--- RECEIVED BID-PLACED EVENT ---');
        console.log('Full Data:', JSON.stringify(data, null, 2));

        if (!data.bid) console.error('EXECUTION ERROR: data.bid is missing!');
        if (data.increment === undefined) console.error('EXECUTION ERROR: data.increment is missing!');

        console.log('Disconnecting...');
        socket.disconnect();
        process.exit(0);
    });

    // We can't easily trigger a bid from here without being authenticated as admin/owner.
    // BUT we can listen.
    // To test, I will need to manually trigger a bid or assume the user is testing.
    // Actually, I can use the admin service logic to place a bid if I authenticate.
    // For now, let's just listen and I will ask the user to place a bid?
    // No, better to simulate the event emission if possible, or just checking the code again.

    console.log('Waiting for bid-placed event...');
    // Force a timeout
    setTimeout(() => {
        console.log('Timeout waiting for event.');
        process.exit(0);
    }, 10000);

});
