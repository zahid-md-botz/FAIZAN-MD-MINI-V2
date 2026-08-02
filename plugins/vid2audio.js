
// ===================================================
//  plugins/vid2audio.js  —  Video → Audio (MP3)
//  Commands: .v2a | .vid2audio | .tomp3
// ===================================================

const { cmd } = require('../command');
const ffmpeg  = require('fluent-ffmpeg');
const ffPath  = require('@ffmpeg-installer/ffmpeg').path;
const fs      = require('fs');
const path    = require('path');
const os      = require('os');

ffmpeg.setFfmpegPath(ffPath);

cmd({
    pattern : 'tomp3',
    alias   : ['vid2audio', 'audio', 'videoaudio'],
    desc    : 'Video sy audio extract karo (MP3)',
    category: 'converter',
    react   : '🎵',
    use     : '<reply to video>',
    filename: __filename
}, async (conn, mek, m, { reply }) => {
    try {
        // ── Validation ────────────────────────────────────────
        if (!m.quoted) {
            return reply(
                '❌ *Video py reply karo*\n\n' +
                '*🔊 Please reply to a video/audio message*'
            );
        }

        const mtype = m.quoted.mtype;
        if (mtype !== 'videoMessage') {
            return reply('❌ *Please reply to a video/audio message*');
        }

        const dur = m.quoted.seconds || 0;
        if (dur > 600) {
            return reply('⚠️ Video bohot lambi hai! Max *10 minutes* allowed hain.');
        }

        // ── Processing notice ─────────────────────────────────
        await conn.sendMessage(
            mek.chat,
            { text: '⏳ Video se audio extract ho raha hai...' },
            { quoted: mek }
        );

        // ── Download + convert ────────────────────────────────
        const videoBuffer = await m.quoted.download();
        const tmpDir  = os.tmpdir();
        const tmpIn   = path.join(tmpDir, `vid2a_in_${Date.now()}.mp4`);
        const tmpOut  = path.join(tmpDir, `vid2a_out_${Date.now()}.mp3`);

        fs.writeFileSync(tmpIn, videoBuffer);

        await new Promise((resolve, reject) => {
            ffmpeg(tmpIn)
                .noVideo()
                .audioCodec('libmp3lame')
                .audioBitrate('128k')
                .format('mp3')
                .output(tmpOut)
                .on('end', resolve)
                .on('error', (err) => reject(err))
                .run();
        });

        const audioBuffer = fs.readFileSync(tmpOut);

        // ── Clean up temp files ───────────────────────────────
        try { fs.unlinkSync(tmpIn);  } catch (_) {}
        try { fs.unlinkSync(tmpOut); } catch (_) {}

        // ── Send result ───────────────────────────────────────
        await conn.sendMessage(
            mek.chat,
            {
                audio   : audioBuffer,
                mimetype: 'audio/mpeg',
                fileName: 'audio.mp3'
            },
            { quoted: mek }
        );

    } catch (e) {
        console.error('[vid2audio]', e.message);
        reply('❌ Audio extract nahi hua. Doosri video try karo.');
    }
});
