
const config = require('../config');
const { proto, downloadContentFromMessage, getContentType } = require('@whiskeysockets/baileys')
const fs = require('fs')
const { isUrl } = require('./functions');

// ─────────────────────────────────────────────────────────────────────────────
//  downloadMediaMessage
//  Works for BOTH:
//   • Regular serialized message  (m.msg = inner content, m.mtype set)
//   • Quoted message object       (m itself IS the inner content, m.mtype set)
// ─────────────────────────────────────────────────────────────────────────────
const downloadMediaMessage = async (m, filename) => {
    if (!m) return null;

    // Determine the inner media object
    // For regular messages: m.msg has mediaKey/url
    // For quoted messages:  m itself has mediaKey/url (m.msg is undefined)
    const innerMsg = (m.msg && (m.msg.mediaKey || m.msg.url)) ? m.msg : m;

    if (!innerMsg || (!innerMsg.mediaKey && !innerMsg.url)) return null;

    // Determine media type string (needed by downloadContentFromMessage)
    const msgType = m.mtype || m.type || '';
    let mediaType = 'image';
    let extension = '.jpg';

    if      (msgType === 'imageMessage')    { mediaType = 'image';    extension = '.jpg';  }
    else if (msgType === 'videoMessage')    { mediaType = 'video';    extension = '.mp4';  }
    else if (msgType === 'audioMessage')    { mediaType = 'audio';    extension = '.mp3';  }
    else if (msgType === 'stickerMessage')  { mediaType = 'sticker';  extension = '.webp'; }
    else if (msgType === 'documentMessage') {
        mediaType = 'document';
        extension = (m.fileName || innerMsg.fileName) ? '.' + (m.fileName || innerMsg.fileName).split('.').pop() : '.pdf';
    } else {
        // Fallback: guess from available fields
        if (innerMsg.ptt || innerMsg.seconds) mediaType = 'audio';
    }

    try {
        const stream = await downloadContentFromMessage(innerMsg, mediaType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        if (filename) {
            const filePath = filename + extension;
            fs.writeFileSync(filePath, buffer);
            return buffer;
        }

        return buffer;
    } catch (e) {
        console.error('[downloadMediaMessage] Error:', e.message);
        return null;
    }
};

const sms = (conn, m, store) => {
    if (!m) return m;

    let M = proto.WebMessageInfo;

    if (m.key) {
        m.id = m.key.id;
        m.isBot = m.id && (m.id.startsWith('BAES') && m.id.length === 16);
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

        // FIX v2: getContentType() picks the FIRST key containing "Message" —
        // messageContextInfo (attached by WhatsApp to interactive button
        // replies) sits before interactiveResponseMessage in proto field
        // order and also matches that filter, so m.mtype was silently
        // resolving to 'messageContextInfo' for tapped buttons. Override with
        // a direct field-presence check so button replies are never hidden
        // behind field order.
        if (m.message.interactiveResponseMessage) m.mtype = 'interactiveResponseMessage';
        else if (m.message.buttonsResponseMessage) m.mtype = 'buttonsResponseMessage';
        else if (m.message.listResponseMessage) m.mtype = 'listResponseMessage';
        else if (m.message.templateButtonReplyMessage) m.mtype = 'templateButtonReplyMessage';

        if (m.mtype === 'viewOnceMessage' || m.mtype === 'viewOnceMessageV2') {
            const voMsg = m.message[m.mtype].message;
            m.mtype = getContentType(voMsg);
            m.msg = voMsg[m.mtype];
        } else {
            m.msg = m.message[m.mtype];
        }

        // Extract text body
        try {
            if      (m.mtype === 'conversation')          m.body = m.message.conversation;
            else if (m.mtype === 'imageMessage')           m.body = m.message.imageMessage.caption || '';
            else if (m.mtype === 'videoMessage')           m.body = m.message.videoMessage.caption || '';
            else if (m.mtype === 'extendedTextMessage')    m.body = m.message.extendedTextMessage.text || '';
            else if (m.mtype === 'buttonsResponseMessage') m.body = m.message.buttonsResponseMessage.selectedButtonId || '';
            else if (m.mtype === 'listResponseMessage')    m.body = m.message.listResponseMessage.singleSelectReply?.selectedRowId || '';
            else if (m.mtype === 'templateButtonReplyMessage') m.body = m.message.templateButtonReplyMessage.selectedId || '';
            else if (m.mtype === 'interactiveResponseMessage') {
                // FIX: nativeFlowMessage quick_reply buttons (used by ping2/menu2-style
                // interactive cards) reply with interactiveResponseMessage, not
                // buttonsResponseMessage. Previously unhandled -> body stayed '' ->
                // command matcher never fired -> tapping the button did nothing
                // (only the WhatsApp UI's own tap acknowledgement was visible).
                const paramsJson = m.message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
                try {
                    const parsed = paramsJson ? JSON.parse(paramsJson) : {};
                    m.body = parsed.id || parsed.selectedId || '';
                } catch (e2) { m.body = ''; }
            }
            else m.body = '';
        } catch (e) { m.body = ''; }

        m.mentionedJid = m.msg?.contextInfo?.mentionedJid || [];

        // Handle quoted message
        if (m.msg?.contextInfo?.quotedMessage) {
            const quotedMsg  = m.msg.contextInfo.quotedMessage;
            let   quotedType = getContentType(quotedMsg);
            m.quoted = quotedMsg[quotedType];

            if (quotedType === 'productMessage') {
                quotedType = getContentType(m.quoted);
                m.quoted = m.quoted[quotedType];
            }

            if (typeof m.quoted === 'string') m.quoted = { text: m.quoted };

            if (m.quoted) {
                m.quoted.mtype    = quotedType;
                m.quoted.id       = m.msg.contextInfo.stanzaId;
                m.quoted.chat     = m.msg.contextInfo.remoteJid || m.chat;
                m.quoted.isBot    = m.quoted.id ? (m.quoted.id.startsWith('BAES') && m.quoted.id.length === 16) : false;
                m.quoted.isBaileys = m.quoted.id ? (m.quoted.id.startsWith('BAE5') && m.quoted.id.length === 16) : false;
                m.quoted.sender   = conn.decodeJid ? conn.decodeJid(m.msg.contextInfo.participant) : (m.msg.contextInfo.participant || m.chat);
                m.quoted.fromMe   = m.quoted.sender === (conn.user && conn.user.id);
                m.quoted.text     = m.quoted.text || m.quoted.caption || m.quoted.conversation || m.quoted.contentText || m.quoted.selectedDisplayText || m.quoted.title || '';
                m.quoted.mimetype = m.quoted.mimetype || '';
                m.quoted.fileName = m.quoted.fileName || '';
                m.quoted.mentionedJid = m.msg.contextInfo?.mentionedJid || [];

                m.getQuotedObj = async () => {
                    if (!m.quoted.id) return false;
                    let q = await store.loadMessage(m.chat, m.quoted.id, conn);
                    return sms(conn, q, store);
                };

                m.quoted.delete = async () => {
                    const key = { remoteJid: m.chat, fromMe: false, id: m.quoted.id, participant: m.quoted.sender };
                    await conn.sendMessage(m.chat, { delete: key });
                };

                // ✅ Fixed: downloadMediaMessage now handles m.quoted correctly
                m.quoted.download = () => downloadMediaMessage(m.quoted);
            }
        }

        m.type = m.mtype;
    }

    if (m.msg && (m.msg.url || m.msg.mediaKey)) {
        m.download = () => downloadMediaMessage(m);
    }

    m.text = m.msg?.text || m.msg?.caption || m.body || '';

    m.reply = async (content, opt = {}, type = 'text') => {
        switch (type.toLowerCase()) {
            case 'image':
                if (Buffer.isBuffer(content)) return conn.sendMessage(m.chat, { image: content, ...opt }, { quoted: m });
                if (isUrl(content))           return conn.sendMessage(m.chat, { image: { url: content }, ...opt }, { quoted: m });
                break;
            case 'video':
                if (Buffer.isBuffer(content)) return conn.sendMessage(m.chat, { video: content, ...opt }, { quoted: m });
                if (isUrl(content))           return conn.sendMessage(m.chat, { video: { url: content }, ...opt }, { quoted: m });
                break;
            case 'audio':
                if (Buffer.isBuffer(content)) return conn.sendMessage(m.chat, { audio: content, ...opt }, { quoted: m });
                if (isUrl(content))           return conn.sendMessage(m.chat, { audio: { url: content }, ...opt }, { quoted: m });
                break;
            default:
                return conn.sendMessage(m.chat, { text: content }, { quoted: m });
        }
    };

    m.react = (emoji) => {
        conn.sendMessage(m.chat, { react: { text: emoji, key: m.key } }).catch(() => {});
    };

    m.copy           = () => sms(conn, M.fromObject(M.toObject(m)), store);
    m.copyNForward   = (jid = m.chat, forceForward = false, options = {}) => conn.copyNForward(jid, m, forceForward, options);
    m.sticker        = (stik, id = m.chat, option = { mentions: [m.sender] }) =>
        conn.sendMessage(id, { sticker: stik, contextInfo: { mentionedJid: option.mentions } }, { quoted: m });
    m.replyimg       = (img, teks, id = m.chat, option = { mentions: [m.sender] }) =>
        conn.sendMessage(id, { image: img, caption: teks, contextInfo: { mentionedJid: option.mentions } }, { quoted: m });
    m.imgurl         = (img, teks, id = m.chat, option = { mentions: [m.sender] }) =>
        conn.sendMessage(id, { image: { url: img }, caption: teks, contextInfo: { mentionedJid: option.mentions } }, { quoted: m });
    m.senddoc        = (doc, type, id = m.chat, option = {}) =>
        conn.sendMessage(id, { document: doc, mimetype: type, fileName: option.filename || 'document', contextInfo: { mentionedJid: option.mentions || [m.sender] } }, { quoted: m });
    m.sendcontact    = (name, info, number) => {
        const vcard = 'BEGIN:VCARD\nVERSION:3.0\nFN:' + name + '\nORG:' + info + ';\nTEL;type=CELL;type=VOICE;waid=' + number + ':+' + number + '\nEND:VCARD';
        conn.sendMessage(m.chat, { contacts: { displayName: name, contacts: [{ vcard }] } }, { quoted: m });
    };

    return m;
};

module.exports = { sms, downloadMediaMessage };
