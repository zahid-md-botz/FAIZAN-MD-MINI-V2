const { cmd } = require('../command');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');

cmd({
    pattern: "debugadmin",
    alias: ["da"],
    desc: "Debug bot admin status in this group",
    category: "owner",
    react: "🔍",
    use: ".debugadmin",
    filename: __filename
},
async (conn, mek, m, { from, isGroup, reply }) => {
    if (!isGroup) return reply("❌ Groups only!");

    try {
        const botId = conn.user.id;
        const botNumber2 = jidNormalizedUser(botId);
        const botRawNum = botId.split(':')[0].split('@')[0];

        let groupMetadata = null;
        let fetchErr = null;
        try {
            groupMetadata = await conn.groupMetadata(from);
        } catch (e) {
            fetchErr = e.message || String(e);
        }

        if (!groupMetadata) {
            return reply(
`🔍 *DEBUG ADMIN*

❌ *groupMetadata fetch FAILED!*
Error: ${fetchErr || 'null returned'}

Bot ID: ${botId}
Bot Raw Num: ${botRawNum}

This is why isBotAdmins = false.
The bot cannot fetch group info.
Check Baileys connection stability.`
            );
        }

        const participants = groupMetadata.participants || [];
        const groupAdmins = participants.filter(p => p.admin).map(p => p.id);
        const botInAdmins = groupAdmins.some(a => a.split('@')[0] === botRawNum);

        return reply(
`🔍 *DEBUG ADMIN*

*Bot JID:* ${botId}
*Bot Number:* ${botRawNum}
*jidNormalizedUser:* ${botNumber2}

*Group Admins (${groupAdmins.length}):*
${groupAdmins.join('\n') || '(none)'}

*Bot in admins?* ${botInAdmins ? '✅ YES' : '❌ NO — MISMATCH!'}

*All Participants (${participants.length}):*
${participants.map(p => `${p.id} [${p.admin || 'member'}]`).join('\n')}`
        );

    } catch (e) {
        reply(`❌ Debug error: ${e.message}`);
    }
});
