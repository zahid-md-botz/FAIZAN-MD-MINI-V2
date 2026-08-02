const { cmd } = require('../command');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');

// Debug command v2 - check LID format participant data
cmd({
    pattern: "bottest",
    alias: ["bt", "debugbot"],
    desc: "Debug: show bot admin status and group metadata info (v2 - LID aware)",
    category: "owner",
    react: "🔍",
    filename: __filename
},
async (conn, mek, m, { from, isGroup, isOwner, isBotAdmins, isAdmins, sender, groupMetadata, groupAdmins, participants, reply }) => {
    try {
        if (!isGroup) return reply('❌ Use in group only');
        
        const botJid = conn.user?.id || 'UNKNOWN';
        const botNormalized = jidNormalizedUser(botJid);
        const botLid = conn.user?.lid || 'NO LID';
        const botNumber = botNormalized.split('@')[0];
        
        let rawMeta = null;
        let rawError = null;
        try {
            rawMeta = await conn.groupMetadata(from);
        } catch (e) {
            rawError = e.message;
        }
        
        let debugMsg = `🔍 *BOT DEBUG v2*\n\n`;
        debugMsg += `📱 *Bot JID:* ${botJid}\n`;
        debugMsg += `📱 *Bot normalized:* ${botNormalized}\n`;
        debugMsg += `📱 *Bot LID:* ${botLid}\n`;
        debugMsg += `📱 *Bot number:* ${botNumber}\n\n`;
        
        debugMsg += `📊 *From index.js:*\n`;
        debugMsg += `  isBotAdmins = ${isBotAdmins}\n`;
        debugMsg += `  groupAdmins = ${JSON.stringify(groupAdmins?.slice(0,5))}\n\n`;
        
        if (rawError) {
            debugMsg += `❌ *groupMetadata error:* ${rawError}\n`;
        } else if (rawMeta) {
            const rawParticipants = rawMeta.participants || [];
            const adminParticipants = rawParticipants.filter(p => p.admin);
            
            debugMsg += `🔄 *Fresh metadata:*\n`;
            debugMsg += `  Group: ${rawMeta.subject}\n`;
            debugMsg += `  Total: ${rawParticipants.length}\n\n`;
            
            // Show FULL participant objects for admins (to see all fields)
            debugMsg += `👑 *Admin participant objects:*\n`;
            for (const admin of adminParticipants) {
                debugMsg += `  ${JSON.stringify(admin)}\n`;
            }
            debugMsg += `\n`;
            
            // Show bot's participant object
            const botParticipant = rawParticipants.find(p => {
                const pId = (p.id || '').split('@')[0].split(':')[0];
                const pLid = (p.lid || '').split('@')[0];
                return pId === botNumber || pLid === (botLid ? botLid.split('@')[0] : '___');
            });
            debugMsg += `🤖 *Bot's participant object:*\n`;
            debugMsg += botParticipant ? `  ${JSON.stringify(botParticipant)}` : '  NOT FOUND in participants';
        }
        
        reply(debugMsg);
    } catch (e) {
        reply(`❌ Debug error: ${e.message}\n${e.stack?.slice(0, 200)}`);
    }
});
