
const axios = require("axios");
const config = require('../config');
const { cmd } = require('../command');

cmd({
    pattern: "sss",
    alias: ["ssweb", "ss", "screenshot"],
    react: '📸',
    desc: "Website ka screenshot le",
    category: "tools",
    use: ".sss <url>",
    filename: __filename
}, async (conn, mek, m, {
    from, q, reply
}) => {
    if (!q) {
        return reply(`*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || config.OWNER_NAME} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ Usage:* .sss <website url>
*│❀ Example:* .sss https://google.com
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

 ${config.DESCRIPTION}`);
    }

    try {
        await conn.sendMessage(from, { react: { text: "⏳", key: m.key } });

        const apiUrl = `https://eliteprotech-apis.zone.id/ssweb?url=${encodeURIComponent(q)}`;

        const response = await axios.get(apiUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const imageBuffer = Buffer.from(response.data);

        const caption = `*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || config.OWNER_NAME} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ 🌐 𝐖𝐞𝐛𝐬𝐢𝐭𝐟:* ${q}
*│❀ 📸 𝐒𝐭𝐚𝐭𝐮𝐬:* Screenshot Ready ✅
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

 ${config.DESCRIPTION}`;

        await conn.sendMessage(from, {
            image: imageBuffer,
            caption: caption,
            contextInfo: {
                mentionedJid: [m.sender],
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363421896999345@newsletter',
                    newsletterName: `${config.BOT_NAME || config.OWNER_NAME}`,
                    serverMessageId: 143,
                },
            }
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: "✅", key: m.key } });

    } catch (error) {
        console.error('[ssweb] error:', error.message);

        await conn.sendMessage(from, { react: { text: "❌", key: m.key } });
        reply(`*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || config.OWNER_NAME} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❌ 𝐒𝐜𝐫𝐞𝐞𝐧𝐬𝐡𝐨𝐭 𝐅𝐚𝐢𝐥𝐞𝐝*
*│⏳ Please try again later*
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

 ${config.DESCRIPTION}`);
    }
});
