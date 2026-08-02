const { cmd } = require('../command');
const axios = require('axios');
const config = require('../config');

function faizanStyle(title, value, status) {
    return `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || '𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃'} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ 📺 ${title}:* ${value}
*│❀ ⚙️ 𝐒𝐭𝐚𝐭𝐮𝐬:* ${status}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> ${config.DESCRIPTION || 'ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 🤍'}
`;
}

cmd({
    pattern: "ytpost",
    alias: ["ytcommunity", "ytc"],
    desc: "Download a YouTube community post or video",
    category: "downloader",
    react: "🎯",
    filename: __filename
},
async (conn, mek, m, { from, args, q, reply, react }) => {
    try {
        if (!q) return reply(faizanStyle(
            'YT COMMUNITY',
            'Please provide a YouTube community post or video URL\nExample: `.ytpost <url>`',
            '❌'
        ));

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

        // Primary: GiftedTech YouTube video downloader (for video links in posts)
        if (/youtube\.com\/watch|youtu\.be/.test(q)) {
            const res = await axios.get('https://api.giftedtech.co.ke/api/download/ytvideo', {
                params: { apikey: 'gifted', url: q },
                timeout: 30000
            });

            if (res.data?.success && res.data?.result?.download_url) {
                const { title, download_url, thumbnail } = res.data.result;
                await conn.sendMessage(from, {
                    video: { url: download_url },
                    mimetype: 'video/mp4',
                    caption: faizanStyle('YT VIDEO', title || 'YouTube Video', '✅')
                }, { quoted: mek });
                await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
                return;
            }
        }

        // Fallback: siputzx community post API
        const apiUrl = `https://api.siputzx.my.id/api/d/ytpost?url=${encodeURIComponent(q)}`;
        const { data } = await axios.get(apiUrl, { timeout: 20000 });

        if (!data.status || !data.data) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            return reply(faizanStyle('YT COMMUNITY', 'Failed to fetch the community post. Please check the URL.', '❌'));
        }

        const post = data.data;
        let caption = faizanStyle(
            'YT COMMUNITY',
            `📝 ${post.content || 'YouTube Community Post'}`,
            '✅'
        );

        if (post.images && post.images.length > 0) {
            for (const img of post.images) {
                await conn.sendMessage(from, { image: { url: img }, caption }, { quoted: mek });
                caption = "";
            }
        } else {
            await conn.sendMessage(from, { text: caption }, { quoted: mek });
        }

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

    } catch (e) {
        console.error("Error in ytpost command:", e.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply(faizanStyle('YT COMMUNITY', e.message || 'An error occurred', '❌'));
    }
});
