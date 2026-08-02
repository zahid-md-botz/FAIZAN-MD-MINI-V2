const { cmd } = require('../command');
const config = require('../config');
const QasimAny = require('api-qasim');

// FAIZAN style formatter
function faizanStyle(title, value, status) {
    return `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || '𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃'} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ ✍️ ${title}:* ${value}
*│❀ ⚙️ 𝐒𝐭𝐚𝐭𝐮𝐬:* ${status}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> ${config.DESCRIPTION || 'ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 🤍'}
`;
}

cmd({
    pattern: "stext",
    alias: ["fancy", "textstyle", "styletext", "styletxt"],
    desc: "Convert text into various fancy font styles",
    category: "tools",
    react: "✍️",
    filename: __filename
}, async (conn, mek, m, { from, args, reply }) => {
    try {
        const text = args.join(' ');
        
        if (!text || text.trim() === '') {
            return reply(faizanStyle('STYLE TEXT', 'Please provide text to style\nExample: .stext Hello', '❌'));
        }

        // Show loading
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        await reply(faizanStyle('STYLE TEXT', `Styling: "${text}"`, '🔍'));

        // ⭐ QASIM API - same as original
        const styledResult = await QasimAny.styletext(text);

        if (!styledResult || styledResult.length === 0) {
            throw new Error('No styled text found.');
        }

        // Build menu message
        let menuText = `✍️ *Style Text Generator*\n\n`;
        menuText += `📝 *Original:* ${text}\n\n`;
        menuText += `*Reply with number to select style:*\n\n`;
        
        styledResult.forEach((item, index) => {
            const styledText = item.result || item;
            menuText += `*${index + 1}.* ${styledText}\n`;
        });
        
        menuText += `\n> ${config.BOT_NAME || 'FAIZAN-MD'} Style Text`;

        const sentMsg = await conn.sendMessage(from, {
            text: menuText
        }, { quoted: mek });

        // Store for reply handler
        conn.styletext = conn.styletext || {};
        conn.styletext[sentMsg.key.id] = styledResult;

        // Reply handler
        const handler = async (msgData) => {
            try {
                const receivedMsg = msgData.messages[0];
                if (!receivedMsg?.message) return;

                // Check if reply to menu
                let isReply = false;
                if (receivedMsg.message.extendedTextMessage?.contextInfo?.stanzaId === sentMsg.key.id) {
                    isReply = true;
                }
                
                const receivedText = receivedMsg.message.conversation || 
                                    receivedMsg.message.extendedTextMessage?.text || '';
                
                if (!receivedText) return;
                if (!isReply) return;

                const choice = parseInt(receivedText.trim(), 10);
                
                if (!isNaN(choice) && choice >= 1 && choice <= styledResult.length) {
                    const selectedItem = styledResult[choice - 1];
                    const selectedText = selectedItem.result || selectedItem;
                    
                    await conn.sendMessage(from, {
                        text: `✍️ *${selectedItem.name || `Style ${choice}`}*\n\n${selectedText}`,
                        contextInfo: {
                            mentionedJid: [m.sender],
                            forwardingScore: 999,
                            isForwarded: true
                        }
                    }, { quoted: receivedMsg });
                    
                    await conn.sendMessage(from, {
                        react: { text: '✅', key: receivedMsg.key }
                    });
                    
                    // Clean up
                    delete conn.styletext[sentMsg.key.id];
                    conn.ev.off('messages.upsert', handler);
                } else {
                    await conn.sendMessage(from, {
                        text: `❌ Invalid selection. Please choose a number between 1 and ${styledResult.length}.`
                    }, { quoted: receivedMsg });
                }
            } catch (e) {
                console.log('Style text handler error:', e.message);
            }
        };

        conn.ev.on('messages.upsert', handler);
        
        // Auto cleanup after 2 minutes
        setTimeout(() => {
            if (conn.styletext[sentMsg.key.id]) {
                delete conn.styletext[sentMsg.key.id];
                conn.ev.off('messages.upsert', handler);
            }
        }, 120000);

    } catch (error) {
        console.error('Error in styleTextCommand:', error);
        await reply(faizanStyle('STYLE TEXT', error.message || 'Failed to style text', '❌'));
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
    }
});
