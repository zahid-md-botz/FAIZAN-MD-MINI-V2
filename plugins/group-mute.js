const config = require('../config')
const { cmd } = require('../command')

cmd({
    pattern: "mute",
    alias: ["close"],
    react: "🔇",
    desc: "Mute the group (Only admins can send messages).",
    category: "group",
    filename: __filename
},
async (conn, mek, m, { from, isGroup, reply }) => {
    try {
        if (!isGroup) return reply("❌ This command can only be used in groups.");

        await conn.groupSettingUpdate(from, "announcement");
        await conn.sendMessage(from, { react: { text: "🔇", key: mek.key } });
        reply("🔇 *Group Muted*\nOnly admins can send messages now.");
    } catch (e) {
        const msg = (e.message || '').toLowerCase();
        if (msg.includes('not-authorized') || msg.includes('forbidden') || msg.includes('403')) {
            return reply("❌ Make the bot an admin first, then try .mute again.");
        }
        console.error("Mute error:", e.message);
        reply("❌ Failed to mute: " + e.message);
    }
});
