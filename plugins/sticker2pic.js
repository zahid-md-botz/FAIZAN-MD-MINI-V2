
// ===================================================
//  plugins/sticker2pic.js  —  Sticker → Image (PNG)
//  Commands: .s2p | .sticker2pic | .s2pic
// ===================================================

const { cmd } = require('../command');
const ffmpeg  = require('fluent-ffmpeg');
const ffPath  = require('@ffmpeg-installer/ffmpeg').path;
const fs      = require('fs');
const path    = require('path');
const os      = require('os');

ffmpeg.setFfmpegPath(ffPath);

cmd({
    pattern : 's2p',
    alias   : ['sticker2pic', 'photo', 'stopic'],   // removed 'sticker2img' — conflict with tool-converter.js
    desc    : 'Sticker ko image (PNG) mein convert karo',
    category: 'converter',
    react   : '🖼️',
    use     : '<reply to sticker>',
    filename: __filename
}, async (conn, mek, m, { reply }) => {
    try {
        // ── Validation ────────────────────────────────────────
        if (!m.quoted) {
            return reply(
                '❌ *Sticker py reply karo*\n\n' +
                'Usage: `.s2p` (kisi sticker par reply karo)'
            );
        }

        if (m.quoted.mtype !== 'stickerMessage') {
            return reply('❌ Sirf *sticker* messages support hain!');
        }

        // ── Processing notice ─────────────────────────────────
        await conn.sendMessage(
            mek.chat,
            { text: '⏳ Sticker ko image mein convert kar raha hai...' },
            { quoted: mek }
        );

        // ── Download + convert ────────────────────────────────
        const stickerBuffer = await m.quoted.download();
        const ts     = Date.now();
        const tmpDir = os.tmpdir();
        const tmpIn  = path.join(tmpDir, `s2p_in_${ts}.webp`);
        const tmpOut = path.join(tmpDir, `s2p_out_${ts}.png`);

        fs.writeFileSync(tmpIn, stickerBuffer);

        // FIX: Do NOT use .frames(1) or .format('png')
        // Just specify output path with .png extension — ffmpeg auto-detects format
        await new Promise((resolve, reject) => {
            ffmpeg(tmpIn)
                .output(tmpOut)
                .on('end', resolve)
                .on('error', (err) => reject(err))
                .run();
        });

        if (!fs.existsSync(tmpOut)) {
            throw new Error('ffmpeg did not produce output file');
        }

        const imgBuffer = fs.readFileSync(tmpOut);

        // ── Clean up temp files ───────────────────────────────
        try { fs.unlinkSync(tmpIn);  } catch (_) {}
        try { fs.unlinkSync(tmpOut); } catch (_) {}

        // ── Send result ───────────────────────────────────────
        await conn.sendMessage(
            mek.chat,
            {
                image   : imgBuffer,
                caption : '> 𝗦𝘁𝗶𝗰𝗸𝗲𝗿 → 𝗜𝗺𝗮𝗴𝗲 🖼️',
                mimetype: 'image/png'
            },
            { quoted: mek }
        );

    } catch (e) {
        console.error('[sticker2pic]', e.message);
        reply('❌ Convert nahi hua. Doosra sticker try karo.');
    }
});
