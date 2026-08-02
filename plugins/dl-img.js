const { cmd } = require("../command");
const axios = require('axios');
const config = require('../config');

// =============== FAIZAN-MD STYLE ===============
function faizanStyle(title, value, status) {
    return `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || '𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃'} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ 🖼️ ${title}:* ${value}
*│❀ ✨ 𝐒𝐭𝐚𝐭𝐮𝐬:* ${status}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> ${config.DESCRIPTION || 'ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 🤍'}
`;
}

// =============== FAIZAN API (image search) ===============
const FAIZAN_IMG_API = "https://faizan-api.vercel.app/api/image";

async function searchImages(query) {
    try {
        const res = await axios.get(FAIZAN_IMG_API, {
            params: { q: query },
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const data = res.data;
        if (!data?.success || !Array.isArray(data?.result)) return [];

        // Use thumbnail (direct image URL), filter nulls and broken entries
        return data.result
            .filter(item => item?.thumbnail && typeof item.thumbnail === 'string' && item.thumbnail.startsWith('http'))
            .map(item => ({
                url: item.thumbnail,
                title: item.title || query
            }));
    } catch (err) {
        console.error('[IMG] Faizan API error:', err.message);
        return [];
    }
}

// =============== .image — send up to 5 images ===============
cmd({
    pattern: "image",
    alias: ["img", "gimages", "imagesearch", "pic"],
    desc: "Search wallpaper images",
    category: "search",
    react: "🖼️",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) {
            return reply(faizanStyle('IMAGE SEARCH', 'Please enter search query\nExample: .image car', '❌'));
        }

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        await reply(faizanStyle('IMAGE SEARCH', `Searching: "${q}"`, '🔍'));

        const images = await searchImages(q);

        if (!images || images.length === 0) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            return reply(faizanStyle('IMAGE SEARCH', 'No images found', '❌'));
        }

        const maxImages = Math.min(images.length, 5);

        for (let i = 0; i < maxImages; i++) {
            try {
                await conn.sendMessage(from, {
                    image: { url: images[i].url },
                    caption: i === 0
                        ? faizanStyle('IMAGE RESULTS', `${q}\n\n📸 Found ${images.length} images`, '✅')
                        : ''
                }, { quoted: mek });

                await new Promise(r => setTimeout(r, 1000));
            } catch (e) {
                console.log(`[IMG] Failed to send image ${i + 1}: ${e.message}`);
            }
        }

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

    } catch (err) {
        console.error("Image Search Error:", err);
        await reply(faizanStyle('IMAGE SEARCH', err.message || 'Failed to search', '❌'));
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
    }
});

// =============== .image1 — single random image ===============
cmd({
    pattern: "image1",
    alias: ["img1", "randomimg", "pic1"],
    desc: "Get a single random wallpaper image",
    category: "search",
    react: "🖼️",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) {
            return reply(faizanStyle('RANDOM IMAGE', 'Please enter search query\nExample: .image1 cat', '❌'));
        }

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

        const images = await searchImages(q);

        if (!images || images.length === 0) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            return reply(faizanStyle('RANDOM IMAGE', 'No images found', '❌'));
        }

        const randomIndex = Math.floor(Math.random() * images.length);
        const image = images[randomIndex];

        await conn.sendMessage(from, {
            image: { url: image.url },
            caption: faizanStyle('RANDOM IMAGE', `${q}\n\n📸 Random result`, '✅')
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

    } catch (err) {
        console.error("Random Image Error:", err);
        await reply(faizanStyle('RANDOM IMAGE', err.message || 'Failed to search', '❌'));
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
    }
});
