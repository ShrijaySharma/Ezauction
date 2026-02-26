import sharp from 'sharp';
import fs from 'fs';

async function testSharp() {
    try {
        // create a simple 800x1000 buffer (maybe with some text or color)
        // or we can just read an existing image if one exists.
        // Let's create a red image with a transparent background
        const transparentImg = await sharp({
            create: {
                width: 800,
                height: 1000,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 } // transparent
            }
        })
            .png()
            .toBuffer();

        console.log('Original image created.');

        const webpBuffer = await sharp(transparentImg)
            .resize(800, 1000, { fit: 'cover' })
            .webp({ quality: 75 })
            .withMetadata(false) // strip metadata
            .toBuffer();

        fs.writeFileSync('test_output.webp', webpBuffer);
        console.log('WebP image saved as test_output.webp');
    } catch (err) {
        console.error('Error:', err);
    }
}

testSharp();
