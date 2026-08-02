const config = require('../config');
const baileysPkg = config.BAILEYS || '@whiskeysockets/baileys';
const { proto, downloadContentFromMessage, getContentType } = require(baileysPkg);
const fs = require('fs');

function isUrl(url) {
    return url ? /https?:\/\//.test(url) : false;
}

const downloadMediaMessage = async(m, filename) => {
    if (!m || !m.msg) return null;
    
    let msgType = m.type || m.mtype;
    if (msgType === 'viewOnceMessage') {
        msgType = m.msg.type || getContentType(m.msg.message);
    }
    
    let mediaType = 'image';
    let extension = '.jpg';
    
    if (msgType === 'imageMessage') {
        mediaType = 'image';
        extension = '.jpg';
    } else if (msgType === 'videoMessage') {
        mediaType = 'video';
        extension = '.mp4';
    } else if (msgType === 'audioMessage') {
        mediaType = 'audio';
        extension = '.mp3';
    } else if (msgType === 'stickerMessage') {
        mediaType = 'sticker';
        extension = '.webp';
    } else if (msgType === 'documentMessage') {
        mediaType = 'document';
        extension = m.msg.fileName ? '.' + m.msg.fileName.split('.').pop() : '.pdf';
    } else {
        return null;
    }
    
    const fileName = filename ? filename + extension : 'media' + Date.now() + extension;
    const stream = await downloadContentFromMessage(m.msg, mediaType);
    let buffer = Buffer.from([]);
    
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    
    fs.writeFileSync(fileName, buffer);
    return fs.readFileSync(fileName);
}

const sms = (conn, m, store) => {
    if (!m) return m;
    
    if (m.key) {
        m.id = m.key.id;
        m.isBaileys = m.id && (m.id.startsWith('BAE5') && m.id.length === 16);
        m.chat = m.key.remoteJid;
        m.fromMe = m.key.fromMe || false;
        m.isGroup = m.chat ? m.chat.endsWith('@g.us') : false;
        
        if (m.fromMe) {
            m.sender = conn.user ? (conn.user.id.split(':')[0] + '@s.whatsapp.net') : 'unknown';
        } else {
            m.sender = m.isGroup ? (m.key.participant || m.chat) : m.chat;
        }
    }
    
    if (m.message) {
        m.mtype = getContentType(m.message);
        
        if (m.mtype === 'viewOnceMessage') {
            const viewOnceMsg = m.message[m.mtype].message;
            m.mtype = getContentType(viewOnceMsg);
            m.msg = viewOnceMsg[m.mtype];
        } else {
            m.msg = m.message[m.mtype];
        }
        
        // Extract text body
        try {
            if (m.mtype === 'conversation') {
                m.body = m.message.conversation;
            } else if (m.mtype === 'extendedTextMessage' && m.message.extendedTextMessage.text) {
                m.body = m.message.extendedTextMessage.text;
            } else {
                m.body = '';
            }
        } catch (e) {
            m.body = '';
        }
        
        // Handle quoted message
        if (m.msg.contextInfo && m.msg.contextInfo.quotedMessage) {
            const quotedMsg = m.msg.contextInfo.quotedMessage;
            let quotedType = getContentType(quotedMsg);
            m.quoted = quotedMsg[quotedType];
            
            if (typeof m.quoted === 'string') {
                m.quoted = { text: m.quoted };
            }
            
            if (m.quoted) {
                m.quoted.mtype = quotedType;
                m.quoted.id = m.msg.contextInfo.stanzaId;
                m.quoted.chat = m.msg.contextInfo.remoteJid || m.chat;
                m.quoted.sender = m.msg.contextInfo.participant || m.chat;
                m.quoted.text = m.quoted.text || m.quoted.caption || '';
                
                // Delete quoted message
                m.quoted.delete = async () => {
                    const key = {
                        remoteJid: m.chat,
                        fromMe: false,
                        id: m.quoted.id,
                        participant: m.quoted.sender
                    };
                    await conn.sendMessage(m.chat, { delete: key });
                };
                
                // Download quoted message
                m.quoted.download = () => downloadMediaMessage(m.quoted);
            }
        }
        
        m.type = m.mtype;
    }
    
    // Set text
    m.text = m.msg?.text || m.msg?.caption || m.body || '';
    
    // Reply function
    m.reply = async (content) => {
        return await conn.sendMessage(m.chat, { text: content }, { quoted: m });
    };
    
    // React function
    m.react = (emoji) => {
        conn.sendMessage(m.chat, { react: { text: emoji, key: m.key } }).catch(() => {});
    };
    
    return m;
};

module.exports = { sms, downloadMediaMessage };
