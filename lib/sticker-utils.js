const axios   = require('axios');
const fs      = require('fs');
const path    = require('path');
const { tmpdir } = require('os');
const Crypto  = require('crypto');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg  = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Fetch a buffer from a URL.
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
async function fetchImage(url) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
}

/**
 * Fetch a GIF buffer from a URL.
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
async function fetchGif(url) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
}

/**
 * Convert a GIF/video buffer to an animated WebP sticker.
 * @param {Buffer} gifBuffer
 * @returns {Promise<Buffer>}
 */
async function gifToSticker(gifBuffer) {
    const inputPath  = path.join(tmpdir(), Crypto.randomBytes(6).toString('hex') + '.gif');
    const outputPath = path.join(tmpdir(), Crypto.randomBytes(6).toString('hex') + '.webp');

    fs.writeFileSync(inputPath, gifBuffer);

    await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .addOutputOptions([
                '-vcodec', 'libwebp',
                '-vf', "scale=320:320:force_original_aspect_ratio=decrease,fps=15,pad=320:320:-1:-1:color=white@0.0",
                '-loop', '0',
                '-preset', 'default',
                '-an',
                '-vsync', '0',
            ])
            .toFormat('webp')
            .save(outputPath)
            .on('end', resolve)
            .on('error', reject);
    });

    const webpBuffer = fs.readFileSync(outputPath);

    // cleanup
    try { fs.unlinkSync(inputPath);  } catch {}
    try { fs.unlinkSync(outputPath); } catch {}

    return webpBuffer;
}

module.exports = { fetchImage, fetchGif, gifToSticker };
