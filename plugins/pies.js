const { cmd } = require('../command');
const axios = require('axios');

const BASE = 'https://shizoapi.onrender.com/api/pies';
const VALID_COUNTRIES = ['china', 'indonesia', 'japan', 'korea', 'hijab'];

// FAIZAN style formatter
function faizanStyle(title, value, status) {
    return `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 _⁸⁷³_ ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ 🍰 ${title}:* ${value}
*│❀ ⚙️ 𝐒𝐭𝐚𝐭𝐮𝐬:* ${status}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 🤍
`;
}

async function fetchPiesImageBuffer(country) {
    try {
        const url = `${BASE}/${country}?apikey=shizo`;
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        
        if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
        
        const contentType = response.headers['content-type'] || '';
        if (!contentType.includes('image')) throw new Error('API did not return an image');
        
        return Buffer.from(response.data);
    } catch (error) {
        console.error('Error fetching pies:', error);
        throw error;
    }
}

cmd({
    pattern: "pies",
    alias: ["pie", "pics"],
    desc: "Get a pies image from a specific country",
    category: "fun",
    react: "🍰",
    filename: __filename
},
async (conn, mek, m, { from, args, reply }) => {
    try {
        const sub = (args[0] || '').toLowerCase();

        // Agar country nahi di to menu dikhao
        if (!sub) {
            let menuText = `🍰 *Pies Image Generator*\n\n` +
                          `*Usage:* .pies <country>\n\n` +
                          `*Available Countries:*\n`;
            
            VALID_COUNTRIES.forEach((country, i) => {
                menuText += `${i + 1}. ${country}\n`;
            });
            
            menuText += `\n*Example:* .pies japan\n.pies korea\n.pies hijab`;
            
            return reply(menuText);
        }

        // Check if country is valid
        if (!VALID_COUNTRIES.includes(sub)) {
            return reply(faizanStyle('Invalid Country', sub, 
                `❌ Try: ${VALID_COUNTRIES.join(', ')}`));
        }

        // Loading message
        await reply(faizanStyle('Country', sub, '⏳ Fetching...'));

        // Fetch image
        const imageBuffer = await fetchPiesImageBuffer(sub);

        // Send image
        await conn.sendMessage(from, {
            image: imageBuffer,
            caption: faizanStyle('Country', sub, '✅ Success!')
        }, { quoted: mek });

        // React with success
        await conn.sendMessage(from, {
            react: { text: "✅", key: mek.key }
        });

    } catch (error) {
        console.error('Pies Command Error:', error);
        reply(faizanStyle('Error', '', '❌ Failed to fetch image'));
        
        await conn.sendMessage(from, {
            react: { text: "❌", key: mek.key }
        });
    }
});
