import { supabase } from './supabaseClient.js';
import https from 'https';

async function checkUrlSize(urlStr, label) {
    if (!urlStr) {
        console.log(`  ${label}: No URL found`);
        return;
    }
    return new Promise((resolve) => {
        https.request(urlStr, { method: 'HEAD' }, (res) => {
            const size = res.headers['content-length'];
            if (size) {
                console.log(`  ${label}: ${urlStr}`);
                console.log(`  Size: ${(parseInt(size) / 1024).toFixed(2)} KB`);
            } else {
                console.log(`  ${label}: Size unknown (no content-length header)`);
            }
            resolve();
        }).on('error', (err) => {
            console.error(`  Error checking ${urlStr}:`, err.message);
            resolve();
        }).end();
    });
}

async function check() {
    const { data: players, error } = await supabase.from('players').select('name, image, thumb_url').ilike('name', '%Tattu%');
    if (error) {
        console.error('Error fetching player:', error);
        process.exit(1);
        return;
    }

    if (!players || players.length === 0) {
        console.log('Player Tattu not found.');
        process.exit(0);
        return;
    }

    for (const player of players) {
        console.log(`\nPlayer: ${player.name}`);
        await checkUrlSize(player.image, 'Main Image');
        await checkUrlSize(player.thumb_url, 'Thumbnail');
    }
    process.exit(0);
}

check();
