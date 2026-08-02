
// =====================================================
//  plugins/toptt.js  —  Audio/Video → Voice Message
//  Commands: .toptt | .voice | .ptt | .voicenote
// =====================================================

const { cmd }    = require('../command');
const ffmpeg     = require('fluent-ffmpeg');
const ffPath     = require('@ffmpeg-installer/ffmpeg').path;
const fs         = require('fs');
const path       = require('path');
const os         = require('os');

ffmpeg.setFfmpegPath(ffPath);

cmd({
    pattern : 'toptt',
    alias   : ['voice', 'ptt', 'voicenote', 'vn'],
    desc    : 'Audio/Video ko WhatsApp voice message (PTT) mein convert karo',
    category: 'converter',
    react   : '🎙️',
    use     : '<reply to audio/video>',
    filename: __filename
}, async (conn, mek, m, { reply }) => {
    try {
        // ── Validation ────────────────────────────────────────
        if (!m.quoted) {
            return reply(
                '❌ *Audio ya Video py reply karo*\n\n' +
                'Usage: `.toptt` (kisi audio/video par reply karo)\n' +
                'Limit: Max *1 minute*'
            );
        }

        const allowed = ['audioMessage', 'videoMessage'];
        if (!allowed.includes(m.quoted.mtype)) {
            return reply('❌ Sirf *audio* ya *video* messages support hain!');
        }

        if (m.quoted.seconds > 60) {
            return reply('⏱️ Media too long — max *1 minute* allowed for voice message.');
        }

        // ── Processing notice ─────────────────────────────────
        await conn.sendMessage(
            mek.chat,
            { text: '⏳ Voice message bana raha hai...' },
            { quoted: mek }
        );

        // ── Download ──────────────────────────────────────────
        const buffer = await m.quoted.download();
        const ts     = Date.now();
        const tmpDir = os.tmpdir();
        const ext    = m.quoted.mtype === 'videoMessage' ? 'mp4' : 'm4a';
        const tmpIn  = path.join(tmpDir, `ptt_in_${ts}.${ext}`);
        const tmpOut = path.join(tmpDir, `ptt_out_${ts}.ogg`);

        fs.writeFileSync(tmpIn, buffer);

        // ── Convert to OGG OPUS (WhatsApp PTT format) ─────────
        await new Promise((resolve, reject) => {
            ffmpeg(tmpIn)
                .audioCodec('libopus')
                .audioFrequency(48000)
                .audioChannels(1)
                .format('ogg')
                .output(tmpOut)
                .on('end', resolve)
                .on('error', (err) => reject(err))
                .run();
        });

        if (!fs.existsSync(tmpOut)) {
            throw new Error('ffmpeg did not produce output file');
        }

        const pttBuffer = fs.readFileSync(tmpOut);

        // ── Clean up temp files ───────────────────────────────
        try { fs.unlinkSync(tmpIn);  } catch (_) {}
        try { fs.unlinkSync(tmpOut); } catch (_) {}

        // ── Send as PTT (voice message) ───────────────────────
        await conn.sendMessage(
            mek.chat,
            {
                audio    : pttBuffer,
                mimetype : 'audio/ogg; codecs=opus',
                ptt      : true       // ← this flag makes it a voice note, not a file
            },
            { quoted: mek }
        );

    } catch (e) {
        console.error('[toptt]', e.message);
        reply('❌ Voice message nahi bana. Doosra audio/video try karo.');
    }
});
