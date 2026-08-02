const { cmd } = require('../command');
const axios = require('axios');
const config = require('../config');


function faizanStyle(title, value, status) {
    return `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || '𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃'} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ 📌 ${title}:* ${value}
*│❀ ⚙️ 𝐒𝐭𝐚𝐭𝐮𝐬:* ${status}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> ${config.DESCRIPTION || 'ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 🤍'}
`;
}

cmd({
    pattern: "pinimg",
    alias: ["pinterestimg", "pinimage", "imgpin"],
    desc: "Download images from Pinterest by search query",
    category: "download",
    react: "📌",
    filename: __filename
},
async (conn, mek, m, { from, args, reply }) => {
    try {
        const query = args.join(' ').trim();
        
        if (!query) {
            return reply(faizanStyle('PINIMG', 'Please provide search query\nExample: .pinimg cat\nExample: .pinimg nature', '❌'));
        }

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        await reply(faizanStyle('PINIMG', `Searching: "${query}"`, '🔍'));

        // ✅ QASIM API - PINTEREST SEARCH
        const apiUrl = `https://api.qasimdev.dpdns.org/api/pinterest/search?query=${encodeURIComponent(query)}&apiKey=qasim-dev`;
        const response = await axios.get(apiUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.data?.success || !response.data?.data) {
            throw new Error('No images found');
        }

        const images = response.data.data;
        
        if (!images || images.length === 0) {
            return reply(faizanStyle('PINIMG', 'No images found', '❌'));
        }

        // Send first 5 images
        const maxImages = Math.min(images.length, 5);
        let sentCount = 0;

        for (let i = 0; i < maxImages; i++) {
            try {
                const imageUrl = images[i].images_url;
                
                if (!imageUrl || !imageUrl.startsWith('http')) {
                    continue;
                }

                const imageBuffer = await axios.get(imageUrl, {
                    responseType: 'arraybuffer',
                    timeout: 30000
                }).then(res => Buffer.from(res.data));

                const title = images[i].grid_title || 'Pinterest Image';
                const imgCaption = `📌 *${title}*\n\n🔍 *Search:* ${query}\n📸 *Image ${i + 1}/${maxImages}*`;
                
                await conn.sendMessage(from, {
                    image: imageBuffer,
                    caption: faizanStyle('PINIMG', imgCaption, '✅')
                }, { quoted: mek });

                sentCount++;
                await new Promise(r => setTimeout(r, 1500));

            } catch (imgErr) {
                console.error(`[PINIMG] Image ${i + 1} failed:`, imgErr.message);
                continue;
            }
        }

        if (sentCount === 0) {
            return reply(faizanStyle('PINIMG', 'Failed to download images', '❌'));
        }

        await reply(faizanStyle('PINIMG', `✅ Downloaded ${sentCount} images\n🔍 Query: ${query}`, '✅'));
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

    } catch (e) {
        console.error("[PINIMG] Error:", e);
        const errorMsg = e.response?.data?.message || e.message || 'Download failed';
        await reply(faizanStyle('PINIMG', errorMsg, '❌'));
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
    }
});
