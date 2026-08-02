const { cmd } = require('../command');
const config = require('../config');


function faizanStyle(title, value, status) {
    return `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || '𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃'} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ 🧹 ${title}:* ${value}
*│❀ ⚙️ 𝐒𝐭𝐚𝐭𝐮𝐬:* ${status}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> ${config.DESCRIPTION || 'ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 🤍'}
`;
}

cmd({
    pattern: "clear",
    alias: ["clr", "clean", "deleteall", "purge"],
    desc: "Clear all bot messages from chat",
    category: "owner",
    filename: __filename
},
async (conn, mek, m, { from, isOwner, reply }) => {
    try {
        // Owner check
        if (!isOwner) {
            return reply(faizanStyle('ACCESS', 'Owner only command', '❌'));
        }

        // Get messages using store
        let messages = [];
        
        // Try different methods to get messages
        if (conn.store && conn.store.messages) {
            // Method 1: Using store
            const chatMessages = conn.store.messages[from];
            if (chatMessages) {
                messages = Array.from(chatMessages.values());
            }
        }
        
        // If no messages found, try alternative
        if (messages.length === 0) {
            // Create a temporary message to know we tried
            const tempMsg = await conn.sendMessage(from, { 
                text: faizanStyle('CLEAR', 'Fetching messages...', '⏳')
            }, { quoted: mek });
            
            await conn.sendMessage(from, { delete: tempMsg.key });
        }

        // Filter bot's own messages
        const botMessages = messages.filter(msg => 
            msg.key && msg.key.fromMe === true
        );

        if (botMessages.length === 0) {
            return reply(faizanStyle('CLEAR', 'No bot messages found', 'ℹ️'));
        }

        // Send progress
        const processing = await conn.sendMessage(from, { 
            text: faizanStyle('CLEAR', `Deleting ${botMessages.length} messages...`, '⏳')
        }, { quoted: mek });

        // Delete all bot messages
        let deleted = 0;
        for (const msg of botMessages) {
            try {
                await conn.sendMessage(from, { delete: msg.key });
                deleted++;
                await new Promise(resolve => setTimeout(resolve, 150));
            } catch (e) {
                console.log('Delete failed:', e.message);
            }
        }

        // Delete progress message
        await conn.sendMessage(from, { delete: processing.key });

        // Send success message (auto-delete after 3 seconds)
        const success = await conn.sendMessage(from, { 
            text: faizanStyle('CLEAR', `✅ Deleted ${deleted}/${botMessages.length} messages\n\n*This message will self-destruct*`, '✅')
        }, { quoted: mek });

        setTimeout(async () => {
            await conn.sendMessage(from, { delete: success.key }).catch(() => {});
        }, 3000);

    } catch(error) {
        console.error('Clear error:', error);
        
        // Alternative method: try to delete last message only
        try {
            await conn.sendMessage(from, { delete: mek.key });
            await reply(faizanStyle('CLEAR', 'Last message deleted', '✅'));
        } catch (e) {
            await reply(faizanStyle('CLEAR', error.message || 'Failed to clear chat', '❌'));
        }
    }
});
