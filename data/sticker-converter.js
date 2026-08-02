const fs   = require('fs');
const path = require('path');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegPath);

class StickerConverter {
    constructor() {
        this.tempDir = path.join(__dirname, '../temp');
        this.ensureTempDir();
    }

    ensureTempDir() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    /**
     * Convert a WebP sticker buffer to a PNG image buffer.
     * @param {Buffer} stickerBuffer
     * @returns {Promise<Buffer>}
     */
    async convertStickerToImage(stickerBuffer) {
        const ts         = Date.now();
        const tempPath   = path.join(this.tempDir, `sticker_${ts}.webp`);
        const outputPath = path.join(this.tempDir, `image_${ts}.png`);

        await fs.promises.writeFile(tempPath, stickerBuffer);

        await new Promise((resolve, reject) => {
            ffmpeg(tempPath)
                .output(outputPath)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });

        if (!fs.existsSync(outputPath)) {
            throw new Error('FFmpeg did not produce output file');
        }

        const result = await fs.promises.readFile(outputPath);

        // cleanup
        await fs.promises.unlink(tempPath).catch(() => {});
        await fs.promises.unlink(outputPath).catch(() => {});

        return result;
    }
}

module.exports = new StickerConverter();
