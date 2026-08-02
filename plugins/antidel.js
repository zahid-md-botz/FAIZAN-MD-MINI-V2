const { cmd } = require('../command');
const config = require('../config');

// ==================== MESSAGE STORE ====================
const messageStore = new Map();

// Store messages for anti-delete
async function storeMessageForAntiDelete(message) {
    try {
        if (!message || !message.key || !message.message) return;
        if (message.key.fromMe) return;
        if (message.key.remoteJid === 'status@broadcast') return;
        
        const messageKey = `${message.key.remoteJid}_${message.key.id}`;
        messageStore.set(messageKey, {
            message: message,
            sender: message.key.participant || message.key.remoteJid,
            chat: message.key.remoteJid,
            timestamp: Date.now()
        });
        
        // Clean old messages (older than 24 hours)
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        for (const [key, value] of messageStore.entries()) {
            if (value.timestamp && value.timestamp < oneDayAgo) {
                messageStore.delete(key);
            }
        }
    } catch (err) {}
}

// Get stored message
async function getStoredMessage(messageId, chatId) {
    const messageKey = `${chatId}_${messageId}`;
    return messageStore.get(messageKey) || null;
}

// ==================== HANDLE DELETED MESSAGE ====================
async function handleDeletedMessage(conn, updates) {
    for (const update of updates) {
        if (update.update && update.update.message === null) {
            const storedMsg = update.storedMessage;
            if (!storedMsg || !storedMsg.message) continue;
            
            const mek = storedMsg.message;
            const chatId = update.key.remoteJid;
            const isGroup = chatId.endsWith('@g.us');
            const sender = storedMsg.sender;
            const senderNum = sender.split('@')[0];
            const deleter = update.key.participant || chatId;
            const deleterNum = deleter.split('@')[0];
            
            // Detect message type
            let msgType = "📝 TEXT";
            let isMedia = false;
            let caption = '';
            
            if (mek.message?.imageMessage) {
                msgType = "🖼️ IMAGE";
                isMedia = true;
                caption = mek.message.imageMessage.caption || '';
            } else if (mek.message?.videoMessage) {
                msgType = "🎥 VIDEO";
                isMedia = true;
                caption = mek.message.videoMessage.caption || '';
            } else if (mek.message?.audioMessage) {
                msgType = "🔊 AUDIO";
                isMedia = true;
            } else if (mek.message?.documentMessage) {
                msgType = "📄 DOCUMENT";
                isMedia = true;
                caption = mek.message.documentMessage.fileName || '';
            } else if (mek.message?.stickerMessage) {
                msgType = "🏷️ STICKER";
                isMedia = true;
            } else if (mek.message?.viewOnceMessage || mek.message?.viewOnceMessageV2) {
                msgType = "🔓 VIEW ONCE";
                isMedia = true;
                // Extract actual media from view once
                const viewOnce = mek.message?.viewOnceMessageV2?.message || mek.message?.viewOnceMessage?.message;
                if (viewOnce) {
                    mek.message = viewOnce;
                    if (viewOnce.imageMessage) msgType = "🔓 IMAGE (View Once)";
                    else if (viewOnce.videoMessage) msgType = "🔓 VIDEO (View Once)";
                }
            }
            
            // Create delete info
            let deleteInfo = `╭────⬡ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 _⁸⁷³_ ⬡────\n`;
            deleteInfo += `├📌 *TYPE:* ${msgType}\n`;
            deleteInfo += `├👤 *SENDER:* @${senderNum}\n`;
            
            if (isGroup) {
                try {
                    const group = await conn.groupMetadata(chatId);
                    deleteInfo += `├👥 *GROUP:* ${group.subject}\n`;
                } catch {}
            }
            
            deleteInfo += `├🗑️ *DELETED BY:* @${deleterNum}\n`;
            deleteInfo += `├⏰ *TIME:* ${new Date().toLocaleString()}\n`;
            
            if (caption) {
                deleteInfo += `├📝 *CAPTION:* ${caption}\n`;
            }
            
            deleteInfo += `╰💬 *MESSAGE:* Content Below 🔽`;
            
            const dest = config.ANTI_DEL_PATH === 'inbox' ? conn.user.id : chatId;
            
            // Send notification
            await conn.sendMessage(dest, {
                text: deleteInfo,
                mentions: [sender, deleter]
            }, { quoted: mek });
            
            // Send media if exists
            if (isMedia) {
                try {
                    const mediaMsg = JSON.parse(JSON.stringify(mek.message));
                    const msgTypeKey = Object.keys(mediaMsg)[0];
                    if (mediaMsg[msgTypeKey]) {
                        mediaMsg[msgTypeKey].contextInfo = {
                            stanzaId: mek.key.id,
                            participant: sender,
                            quotedMessage: mek.message
                        };
                        await conn.relayMessage(dest, mediaMsg, {});
                        console.log(`✅ Anti-delete: ${msgType} sent`);
                    }
                } catch (err) {
                    console.log("Error sending media:", err.message);
                }
            } else {
                // For text messages, send content
                const content = mek.message?.conversation || mek.message?.extendedTextMessage?.text || '';
                await conn.sendMessage(dest, {
                    text: `📝 *Content:*\n${content}`
                }, { quoted: mek });
            }
            
            console.log(`✅ Anti-delete: ${msgType} from ${senderNum} processed`);
        }
    }
}

// ==================== MAIN ANTI-DELETE COMMAND ====================
cmd({
    pattern: "antidel",
    alias: ["antidelete", "ad"],
    desc: "Enable/Disable Anti-Delete feature",
    category: "owner",
    react: "🛡️",
    filename: __filename
},
async (conn, mek, m, { from, args, reply, isCreator }) => {
    try {
        if (!isCreator) return reply("❌ This command is only for owner!");
        
        if (!args[0]) {
            const status = config.ANTI_DELETE === 'true' ? '✅ ON' : '❌ OFF';
            const path = config.ANTI_DEL_PATH === 'inbox' ? '📥 Bot Inbox' : '💬 Same Chat';
            
            return reply(`╭────⬡ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 _⁸⁷³_ ⬡────
├🛡️ *ANTI-DELETE STATUS*
├──────────────────
├📌 *Status:* ${status}
├📌 *Destination:* ${path}
├──────────────────
├📝 *Usage:*
├• .antidel on   - Enable
├• .antidel off  - Disable
├• .antidel path - Change destination
╰────────────────────

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 🤍`);
        }
        
        const option = args[0].toLowerCase();
        
        if (option === 'on') {
            config.ANTI_DELETE = 'true';
            return reply(`✅ *Anti-Delete ENABLED*\n\nAll deleted messages will be sent to ${config.ANTI_DEL_PATH === 'inbox' ? 'your inbox' : 'the same chat'}.`);
        }
        else if (option === 'off') {
            config.ANTI_DELETE = 'false';
            return reply(`❌ *Anti-Delete DISABLED*`);
        }
        else if (option === 'path' || option === 'destination') {
            if (!args[1]) {
                return reply(`╭────⬡ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 _⁸⁷³_ ⬡────
├📌 *Current Destination:* ${config.ANTI_DEL_PATH}
├──────────────────
├📝 *Change destination:*
├• .antidel path inbox - Send to your DM
├• .antidel path same  - Send to same chat
╰────────────────────`);
            }
            
            const dest = args[1].toLowerCase();
            if (dest === 'inbox') {
                config.ANTI_DEL_PATH = 'inbox';
                return reply(`✅ *Destination changed to INBOX*\n\nDeleted messages will be sent to your DM.`);
            }
            else if (dest === 'same') {
                config.ANTI_DEL_PATH = 'same';
                return reply(`✅ *Destination changed to SAME CHAT*\n\nDeleted messages will be resent in the same chat.`);
            }
            else {
                return reply(`❌ Invalid destination! Use "inbox" or "same".`);
            }
        }
        else {
            return reply(`❌ Invalid option! Use .antidel on/off/path`);
        }
    } catch (e) {
        console.error(e);
        reply(`❌ Error: ${e.message}`);
    }
});

// ==================== STORE MESSAGES EVENT ====================
// یہ ہر میسج کو اسٹور کرے گا
cmd({
    on: "body"
},
async (conn, mek, m, { from }) => {
    if (config.ANTI_DELETE === 'true') {
        await storeMessageForAntiDelete(mek);
    }
});

// ==================== EXPORT FOR INDEX.JS ====================
// یہ functions index.js میں استعمال ہوں گے
module.exports = {
    handleDeletedMessage,
    getStoredMessage,
    messageStore
};
