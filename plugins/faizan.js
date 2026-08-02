const { cmd } = require("../command");
const os = require("os");
const config = require('../config');
cmd({
    pattern: "faizan",
    alias: ["fazi"],
    desc: "Faizan full introduction",
    category: "info",
    react: "👑",
    filename: __filename
}, async (conn, mek, m, { from }) => {
    try {

        const uptime = process.uptime();
        const h = Math.floor(uptime / 3600);
        const min = Math.floor((uptime % 3600) / 60);
        const sec = Math.floor(uptime % 60);

        const text = `
╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭
│ ╌─̇─̣⊰ ${config.OWNER_NAME} ⊱┈─̇─̣╌
│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣
│❀ 👤 *Name:* ${config.BOT_NAME || '𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃'}🪽
│❀ 🧑‍💼 *Nick:* 𝙵𝚊𝚣𝚒🪽
│❀ 🎂 *Age:* 20+🪽
│❀ 🧬 *Caste:* 𝙹𝚞𝚝𝚝🪽
│❀ 🌍 *Country:* 𝙿𝚊𝚔𝚒𝚜𝚝𝚊𝚗🪽
│❀ 🏙️ *City:* (𝙰𝚉𝙰𝙳 𝙺𝙰𝚂𝙷𝙼𝙸𝚁🪽)
│
│❀ 🤖 *Bot Name:* ${config.OWNER_NAME}
│❀ 👑 *Owner:* ${config.OWNER_NAME}
│❀ 📞 *Owner No:* ${config.OWNER_NUMBER}🫰
│❀ 🔣 *Prefix:* .
│❀ ⚙️ *Mode:* 𝙿𝚞𝚋𝚕𝚒𝚌🪄
│❀ 🔌 *Baileys:* 𝙼𝚞𝚕𝚝𝚒 𝙳𝚎𝚟𝚒𝚌𝚎🌙
│
│❀ ⏳ *Uptime:* ${h}h ${min}m ${sec}s
│❀ 💻 *Platform:* ${os.platform()}
╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭

 ${config.DESCRIPTION}
`;

        await conn.sendMessage(from, {
            text,
            contextInfo: {
                mentionedJid: [m.sender]
            }
        }, { quoted: mek });

    } catch (e) {
        console.log(e);
    }
});
