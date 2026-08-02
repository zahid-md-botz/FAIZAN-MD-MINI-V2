const { cmd } = require('../command');
const config = require('../config');
const os = require('os');
const { runtime } = require('../lib/functions');

cmd({
    pattern: "ping",
    alias: ["pong", "speed", "lag"],
    desc: "Check bot response speed and status",
    category: "info",
    react: "🏓",
    filename: __filename
}, async (conn, mek, m, { from, reply, isOwner }) => {
    try {
        const start = Date.now();
        await conn.sendMessage(from, { react: { text: "⏳", key: m.key } });
        const end = Date.now();
        const pingTime = end - start;
        
        const botName = config.BOT_NAME || '𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃';
        const botNumber = conn.user.id.split(':')[0];
        const ownerNumber = config.OWNER_NUMBER || '923174838990';
        
        const usedMemory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
        const totalMemory = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
        const cpuUsage = os.loadavg()[0].toFixed(1);
        const uptime = runtime(process.uptime());
        
        let statusEmoji = "🟢", statusText = "Excellent";
        if (pingTime > 500) { statusEmoji = "🟡"; statusText = "Slow"; }
        else if (pingTime > 200) { statusEmoji = "🟠"; statusText = "Good"; }
        else { statusEmoji = "🟢"; statusText = "Fast"; }
        
        const message = `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${botName} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ 🏓 𝐑𝐞𝐬𝐩𝐨𝐧𝐬𝐞:* ${pingTime}ms ${statusEmoji}
*│❀ 📊 𝐒𝐭𝐚𝐭𝐮𝐬:* ${statusText}
*│❀ 🤖 𝐁𝐨𝐭:* ${botName}
*│❀ 👤 𝐎𝐰𝐧𝐞𝐫:* ${ownerNumber}
*│❀ 🔢 𝐍𝐮𝐦𝐛𝐞𝐫:* ${botNumber}
*│❀ 💾 𝐑𝐀𝐌:* ${usedMemory}MB / ${totalMemory}GB
*│❀ 🖥️ 𝐂𝐏𝐔:* ${cpuUsage}%
*│❀ ⚙️ 𝐒𝐭𝐚𝐭𝐮𝐬:* 🟢 Online
*│❀ ⏱️ 𝐔𝐩𝐭𝐢𝐦𝐞:* ${uptime}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> *𝐏σωєяє∂ 𝐁у 𝐅αɪᴢαɴ-𝐌ᴅ⎯꯭̽* ✅`;

        await reply(message);
        
        if (pingTime < 200) await conn.sendMessage(from, { react: { text: "✅", key: m.key } });
        else if (pingTime < 500) await conn.sendMessage(from, { react: { text: "⚠️", key: m.key } });
        else await conn.sendMessage(from, { react: { text: "🐌", key: m.key } });
        
    } catch (error) {
        console.error("Ping command error:", error);
        reply(`
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ ❌ 𝐄𝐫𝐫𝐨𝐫:* ${error.message}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> *𝐄ʀʀᴏʀ 𝐎ᴄᴄᴜʀʀᴇᴅ⎯꯭̽* ❌`);
        await conn.sendMessage(from, { react: { text: "❌", key: m.key } });
    }
});
