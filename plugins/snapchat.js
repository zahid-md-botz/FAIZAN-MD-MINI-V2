const { cmd } = require('../command');
const axios = require('axios');
const config = require('../config');


function faizanStyle(title, value, status) {
    return `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || '𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃'} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ 👻 ${title}:* ${value}
*│❀ ⚙️ 𝐒𝐭𝐚𝐭𝐮𝐬:* ${status}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> ${config.DESCRIPTION || 'ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 🤍'}
`;
}

cmd({
    pattern: "snapchat",
    alias: ["snap", "snp", "snapdl"],
    desc: "Download Snapchat videos",
    category: "download",
    react: "👻",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) {
            return reply(faizanStyle('SNAPCHAT', 'Please provide Snapchat video link\nExample: .snap https://www.snapchat.com/...', '❌'));
        }

        if (!/snapchat\.com/i.test(q)) {
            return reply(faizanStyle('SNAPCHAT', 'Invalid Snapchat link', '❌'));
        }

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        await reply(faizanStyle('SNAPCHAT', `Processing: ${q}`, '🔍'));

        // ✅ QASIM API - SNAPCHAT
        const apiUrl = `https://api.qasimdev.dpdns.org/api/download/snapchat?url=${encodeURIComponent(q)}&apiKey=qasim-dev`;
        const response = await axios.get(apiUrl, { timeout: 30000 });
        const data = response.data;

        if (!data?.success || !data?.data?.result || !data.data.result.length) {
            throw new Error('No video found');
        }

        const videoUrl = data.data.result[0].video;
        
        if (!videoUrl) {
            throw new Error('No download URL found');
        }

        await conn.sendMessage(from, {
            video: { url: videoUrl },
            mimetype: 'video/mp4',
            caption: faizanStyle('SNAPCHAT', 'Snapchat Video Ready', '✅')
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

    } catch (err) {
        console.error('Snapchat downloader error:', err);
        
        const errorMsg = err.response?.data?.message || err.message || 'Download failed';
        await reply(faizanStyle('SNAPCHAT', errorMsg, '❌'));
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
    }
});
