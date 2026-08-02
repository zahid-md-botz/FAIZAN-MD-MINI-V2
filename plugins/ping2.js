const config = require('../config');
const { cmd } = require('../command');
const os = require('os');
const { runtime } = require('../lib/functions');

// REVERTED 2026-07-25: removed nativeFlowMessage/interactiveMessage +
// viewOnceMessage + carouselMessage sent via conn.relayMessage(). That
// send path kept failing in production (tap did nothing / card never
// showed, only the react fired) across 3 separate dispatch-logic fixes,
// and a live Heroku log during a retest showed the WhatsApp socket
// itself was closing around send time (Error: Connection Closed,
// statusCode 428) — a low-level transport issue independent of any
// command-matching code. Rather than keep guessing at that layer,
// ping2 now uses the exact same plain conn.sendMessage()/reply() path
// as the working `.ping` command (proven stable for 60+ days), so it
// no longer depends on the fragile interactive-card machinery at all.
cmd({
  pattern: "ping2",
  react: "🏓",
  alias: ["p2", "pingbtn"],
  desc: "Check bot response speed and status (alt style)",
  category: "main",
  filename: __filename
},
async (conn, mek, m, { from, reply }) => {
  try {
    const start = Date.now();
    await conn.sendMessage(from, { react: { text: "⏳", key: m.key } });
    const end = Date.now();
    const pingTime = end - start;

    let statusEmoji = "🟢", statusText = "Excellent";
    if (pingTime > 500) { statusEmoji = "🟡"; statusText = "Slow"; }
    else if (pingTime > 200) { statusEmoji = "🟠"; statusText = "Good"; }
    else { statusEmoji = "🟢"; statusText = "Fast"; }

    const uptime = runtime(process.uptime());

    const desc = `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ PING ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ 🏓 𝐁𝐨𝐭:* ${config.BOT_NAME}
*│❀ 🏓 𝐑𝐞𝐬𝐩𝐨𝐧𝐬𝐞:* ${pingTime}ms ${statusEmoji}
*│❀ 📊 𝐒𝐭𝐚𝐭𝐮𝐬:* ${statusText}
*│❀ ⚙️ 𝐀𝐥𝐢𝐯𝐞:* 🟢 Online
*│❀ ⏱️ 𝐔𝐩𝐭𝐢𝐦𝐞:* ${uptime}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ${config.OWNER_NAME} 🤍
`;

    await conn.sendMessage(from, {
      image: { url: "https://eliteprotech-url.zone.id/1783842644515tugmfr.jpg" },
      caption: desc
    }, { quoted: mek });

    if (pingTime < 200) await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
    else if (pingTime < 500) await conn.sendMessage(from, { react: { text: "⚠️", key: mek.key } });
    else await conn.sendMessage(from, { react: { text: "🐌", key: mek.key } });

  } catch (e) {
    console.error("PING2 ERROR:", e);
    reply("❌ Ping card load nahi ho saka");
  }
});
