const config = require('../config')
const { cmd } = require('../command')

cmd({
    pattern: "unmute",
    alias: ["open"],
    react: "🔊",
    desc: "Unmute the group (Everyone can send messages).",
    category: "group",
    filename: __filename
},
async (conn, mek, m, { from, isGroup, reply }) => {
    try {
        if (!isGroup) return reply("❌ This command can only be used in groups.");

        await conn.groupSettingUpdate(from, "not_announcement");
        await conn.sendMessage(from, { react: { text: "🔊", key: mek.key } });
        reply("🔊 *Group Unmuted*\nEveryone can send messages now.");
    } catch (e) {
        const msg = (e.message || '').toLowerCase();
        if (msg.includes('not-authorized') || msg.includes('forbidden') || msg.includes('403')) {
            return reply("❌ Make the bot an admin first, then try .unmute again.");
        }
        console.error("Unmute error:", e.message);
        reply("❌ Failed to unmute: " + e.message);
    }
});
