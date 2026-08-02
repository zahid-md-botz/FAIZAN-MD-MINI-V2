const { cmd } = require('../command');
const axios = require('axios');
const config = require('../config');

// =================== FAIZAN-MD STYLE ===================
function faizanStyle(title, value, status) {
    return `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || '𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃'} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❖ 📸 ${title}:* ${value}
*│❖ ✨️ 𝐒𝐭𝐚𝐭𝐮𝐬:* ${status}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> ${config.DESCRIPTION || '𝆸𝆰𝆴𝆸𝆰𝆴 𝆵𝆰 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 🍍'}
`;
}

// =================== FAIZAN API (Instagram) ===================
const INSTA_API = 'https://faizan-api.vercel.app/api/instagram';

cmd({
    pattern: 'instagram',
    alias: ['ig', 'igdl', 'insta', 'reels'],
    desc: 'Download Instagram Reels / Posts / Videos',
    category: 'download',
    react: '📸',
    filename: __filename
},
async (conn, mek, m, { from, q, args, reply }) => {
    try {
        // ─ Usage check
        if (!q) {
            return reply(faizanStyle(
                'INSTAGRAM DL',
                'Please provide an Instagram link\n*Example:* .ig https://www.instagram.com/reel/...\n*Audio only:* .ig https://... mp3',
                '❌'
            ));
        }

        // ─ Extract URL and check for mp3 flag
        const wantsAudio = args.includes('mp3') || args.includes('audio');
        const url = args.find(a => a.includes('instagram.com'));

        if (!url) {
            return reply(faizanStyle('INSTAGRAM DL', 'Invalid or missing Instagram link', '❌'));
        }

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

        // ─ Call Faizan API
        const res = await axios.get(INSTA_API, {
            params: { url },
            timeout: 30000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const data = res.data;

        if (!data?.status) {
            throw new Error('API returned failure status');
        }

        const videoUrl = data?.video;
        const audioUrl = data?.mp3;
        const username = data?.username ? data.username.replace(/\n/g, '').trim() : 'Unknown';

        // ─ Send audio only if mp3 flag given
        if (wantsAudio) {
            if (!audioUrl) throw new Error('No audio URL found in response');

            await conn.sendMessage(from, {
                audio: { url: audioUrl },
                mimetype: 'audio/mpeg',
                caption: faizanStyle(
                    'INSTAGRAM AUDIO',
                    `@${username}`,
                    '✅ Downloaded'
                )
            }, { quoted: mek });

            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
            return;
        }

        // ─ Send video (default)
        if (!videoUrl) throw new Error('No video URL found in response');

        await conn.sendMessage(from, {
            video: { url: videoUrl },
            mimetype: 'video/mp4',
            caption: faizanStyle(
                'INSTAGRAM',
                `@${username}`,
                '✅ Downloaded'
            )
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

    } catch (err) {
        console.error('Instagram DL error:', err.message);
        const errMsg = err.response?.data?.message || err.message || 'Download failed';
        await reply(faizanStyle('INSTAGRAM', errMsg, '❌'));
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
    }
});
