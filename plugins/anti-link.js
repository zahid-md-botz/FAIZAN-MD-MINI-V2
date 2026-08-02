const { cmd } = require('../command');
const config = require('../config');

// ════════════════════════════════════════════════════════════
// 📁 ANTILINK - In-Memory Storage (no file system = no Heroku reset issues)
// ════════════════════════════════════════════════════════════
// antilinkGroups: Map<groupJid, boolean>
// antilinkWarnings: Map<"groupJid:senderJid", number>
const antilinkGroups = new Map();
const antilinkWarnings = new Map();

// Link detection patterns — social media + generic URLs
const linkPatterns = [
    /https?:\/\/(?:chat\.whatsapp\.com|wa\.me)\/\S+/gi,
    /https?:\/\/(www\.)?whatsapp\.com\/channel\/\S+/gi,
    /wa\.me\/\S+/gi,
    /https?:\/\/(?:t\.me|telegram\.me)\/\S+/gi,
    /https?:\/\/(?:www\.)?youtube\.com\/\S+/gi,
    /https?:\/\/youtu\.be\/\S+/gi,
    /https?:\/\/(?:www\.)?facebook\.com\/\S+/gi,
    /https?:\/\/fb\.me\/\S+/gi,
    /https?:\/\/(?:www\.)?instagram\.com\/\S+/gi,
    /https?:\/\/(?:www\.)?twitter\.com\/\S+/gi,
    /https?:\/\/(?:www\.)?x\.com\/\S+/gi,
    /https?:\/\/(?:www\.)?tiktok\.com\/\S+/gi,
    /https?:\/\/(?:www\.)?linkedin\.com\/\S+/gi,
    /https?:\/\/(?:www\.)?snapchat\.com\/\S+/gi,
    /https?:\/\/(?:www\.)?pinterest\.com\/\S+/gi,
    /https?:\/\/(?:www\.)?reddit\.com\/\S+/gi,
    /https?:\/\/(?:www\.)?discord\.gg\/\S+/gi,
    /https?:\/\/(?:www\.)?discord\.com\/\S+/gi,
    /https?:\/\/(?:www\.)?twitch\.tv\/\S+/gi,
    /https?:\/\/bit\.ly\/\S+/gi,
    /https?:\/\/tinyurl\.com\/\S+/gi,
    /https?:\/\/t\.co\/\S+/gi,
    /https?:\/\/\S+\.\S{2,6}(\/\S*)?/gi,   // catch-all generic URL
];

function faizan(title, value, status) {
    return `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || '𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃'} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ 🔗 ${title}:* ${value}
*│❀ ⚙️ 𝐒𝐭𝐚𝐭𝐮𝐬:* ${status}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> ${config.DESCRIPTION || '𝐏σωєяє∂ 𝐁у 𝐅αɪᴢαɴ-𝐌ᴅ 🤖'}
`;
}

// =========== ANTILINK ON/OFF COMMAND ===========
cmd({
    pattern: "antilink",
    alias: ["al"],
    desc: "Enable/disable antilink (warn + delete first, remove on second offense)",
    category: "group",
    react: "🔗",
    use: ".antilink on/off",
    filename: __filename
},
async (conn, mek, m, { from, args, isGroup, isOwner, isAdmins, isBotAdmins, reply }) => {
    try {
        if (!isGroup) return reply(faizan('ANTILINK', 'Groups only', '❌'));
        if (!isOwner && !isAdmins) return reply(faizan('ANTILINK', 'Admin/Owner only', '❌'));
        if (!isBotAdmins) return reply(faizan('ANTILINK', 'Bot must be admin', '❌'));

        const action = (args[0] || '').toLowerCase();
        if (!['on', 'off'].includes(action)) {
            return reply(faizan('ANTILINK', 'Use: .antilink on/off', '❓'));
        }

        if (action === 'on') {
            antilinkGroups.set(from, true);
            reply(faizan('ANTILINK', 'Enabled ✅', '🟢'));
        } else {
            antilinkGroups.set(from, false);
            // Clear all warnings for this group
            for (const key of antilinkWarnings.keys()) {
                if (key.startsWith(from + ':')) antilinkWarnings.delete(key);
            }
            reply(faizan('ANTILINK', 'Disabled ❌', '🔴'));
        }

    } catch (e) {
        console.error('Antilink cmd error:', e);
        reply(faizan('ANTILINK', 'Error occurred', '❌'));
    }
});

// =========== ANTILINK DETECTOR (on every message body) ===========
// 1st offense: warn + delete link
// 2nd offense: remove from group
cmd({
    on: "body"
},
async (conn, mek, m, { from, body, sender, isGroup, isAdmins, isBotAdmins, reply }) => {
    try {
        if (!isGroup || isAdmins || !isBotAdmins) return;
        if (m.key?.fromMe) return; // Never process bot's own messages for antilink

        // Check if antilink is enabled for this group
        if (!antilinkGroups.get(from)) return;

        // Reset regex lastIndex before testing (important for /g flags)
        const hasLink = linkPatterns.some(p => {
            p.lastIndex = 0;
            return p.test(body);
        });
        if (!hasLink) return;

        const warnKey = `${from}:${sender}`;
        const userWarnings = antilinkWarnings.get(warnKey) || 0;

        if (userWarnings === 0) {
            // ⚠️ FIRST OFFENSE: Warn + Delete message
            antilinkWarnings.set(warnKey, 1);

            try { await conn.sendMessage(from, { delete: mek.key }); } catch {}

            await conn.sendMessage(from, {
                text: `⚠️ *WARNING!* @${sender.split('@')[0]}\n\n🔗 Links are not allowed in this group!\n🗑️ Your message has been deleted.\n\n❗ _Next time you will be removed from the group._`,
                mentions: [sender]
            }, { quoted: mek });

        } else {
            // 🚫 SECOND OFFENSE: Delete + Remove from group
            antilinkWarnings.delete(warnKey);

            try { await conn.sendMessage(from, { delete: mek.key }); } catch {}

            await conn.sendMessage(from, {
                text: `🚫 *REMOVED!* @${sender.split('@')[0]}\n\n🔗 You were warned about sending links.\n👮 You have been removed from the group.`,
                mentions: [sender]
            }, { quoted: mek });

            await conn.groupParticipantsUpdate(from, [sender], "remove");
        }

    } catch (e) {
        console.error('Antilink detect error:', e);
    }
});
