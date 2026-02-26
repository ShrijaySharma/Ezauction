import 'dotenv/config';
import { supabase } from './supabaseClient.js';
import sharp from 'sharp';
import fs from 'fs';

async function testUpload() {
    try {
        const fileContent = fs.readFileSync('test-upload/dummy.png');
        const buffer = await sharp(fileContent)
            .resize(100, 100)
            .webp({ quality: 80 })
            .toBuffer();

        console.log('Buffer generated. Size:', buffer.length);
        const filename = `test/buffer-${Date.now()}.webp`;

        const { data, error } = await supabase.storage
            .from('auction-images')
            .upload(filename, buffer, {
                contentType: 'image/webp',
                upsert: true
            });

        if (error) {
            console.error('Upload Error:', error);
        } else {
            console.log('Upload Success:', data);
        }

    } catch (err) {
        console.error('Test error:', err);
    }
}

testUpload();
