const { cmd } = require('../command');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const Config = require('../config');

// .take — rename sticker ──────────────────────────────────────────────────────
cmd({
    pattern: 'take', alias: ['rename','stake'],
    desc: 'Create sticker with custom pack name.',
    category: 'sticker', use: '<reply sticker/image>', filename: __filename
}, async (conn, mek, m, { reply, q }) => {
    try {
        if (!m.quoted) return reply('*Reply to a sticker or image.*');
        if (!q) return reply('*Usage: .take <packname>*');
        const mime = m.quoted.mtype;
        if (mime !== 'imageMessage' && mime !== 'stickerMessage') return reply('*Reply to an image or sticker.*');
        const media = await m.quoted.download();
        if (!media) return reply('❌ Failed to download media.');
        const sticker = new Sticker(media, { pack: q, type: StickerTypes.FULL, categories: ['🤩','🎉'], id: '12345', quality: 75, background: 'transparent' });
        return conn.sendMessage(mek.chat, { sticker: await sticker.toBuffer() }, { quoted: mek });
    } catch (e) { console.error('[take]', e); return reply('❌ Failed to create sticker!'); }
});

// .sticker / .s ───────────────────────────────────────────────────────────────
cmd({
    pattern: 'sticker', alias: ['s','stickergif'],
    desc: 'Create sticker from image, video, or GIF.',
    category: 'sticker', use: '<reply media>', filename: __filename
}, async (conn, mek, m, { reply }) => {
    try {
        if (!m.quoted) return reply('*Reply to an image, video, or GIF.*');
        const mime = m.quoted.mtype;
        if (!['imageMessage','stickerMessage','videoMessage','gifMessage'].includes(mime)) return reply('*Reply to an image, video, or GIF.*');
        const media = await m.quoted.download();
        if (!media) return reply('❌ Could not download media.');
        const sticker = new Sticker(media, {
            pack: Config.STICKER_NAME || '𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃🪄🎀',
            author: Config.OWNER_NAME || '𝐅𝐀𝐈𝐙𝐀𝐍',
            type: StickerTypes.FULL, categories: ['🤩','🎉'], id: '12345', quality: 75, background: 'transparent'
        });
        return conn.sendMessage(mek.chat, { sticker: await sticker.toBuffer() }, { quoted: mek });
    } catch (e) { console.error('[sticker]', e); return reply('❌ Failed to create sticker!'); }
});
