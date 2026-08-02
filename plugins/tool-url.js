const axios = require("axios");
const FormData = require('form-data');
const fs = require('fs');
const os = require('os');
const path = require("path");
const { cmd } = require("../command");
const config = require('../config');

cmd({
    'pattern': "tourl",
    'alias': ["imgtourl", "imgurl", "url", "geturl", "upload"],
    'react': '🖇',
    'desc': "Convert media to direct URL",
    'category': "utility",
    'use': ".tourl [reply to media]",
    'filename': __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        if (!m.quoted) {
            return reply("Please reply to an image, video, or audio file");
        }

        const mimeType = (m.quoted.msg || m.quoted).mimetype || '';
        if (!mimeType) {
            return reply("Please reply to an image, video, or audio file");
        }

        await conn.sendMessage(from, { react: { text: "⏳", key: m.key } });

        // Download media
        const mediaBuffer = await m.quoted.download();

        // Determine extension
        let extension = '.bin';
        if (mimeType.includes('image/jpeg'))      extension = '.jpg';
        else if (mimeType.includes('image/png'))  extension = '.png';
        else if (mimeType.includes('image/webp')) extension = '.webp';
        else if (mimeType.includes('image/gif'))  extension = '.gif';
        else if (mimeType.includes('video'))      extension = '.mp4';
        else if (mimeType.includes('audio/mpeg')) extension = '.mp3';
        else if (mimeType.includes('audio/ogg'))  extension = '.ogg';
        else if (mimeType.includes('audio'))      extension = '.mp3';

        const fileName = `file_${Date.now()}${extension}`;
        const tempFilePath = path.join(os.tmpdir(), fileName);
        fs.writeFileSync(tempFilePath, mediaBuffer);

        let mediaUrl;
        let host = 'eliteprotech';

        // Primary: eliteprotech-url.zone.id
        try {
            const form = new FormData();
            form.append('file', fs.createReadStream(tempFilePath), {
                filename: fileName,
                contentType: mimeType
            });
            const res = await axios.post('https://eliteprotech-url.zone.id/api/upload', form, {
                headers: {
                    ...form.getHeaders(),
                    'Accept': 'application/json'
                },
                timeout: 60000
            });
            if (!res.data || !res.data.public_url) {
                throw new Error('eliteprotech upload failed: ' + JSON.stringify(res.data));
            }
            mediaUrl = res.data.public_url;

        } catch (e1) {
            // Fallback: GiftedTech upload
            console.log('[tourl] eliteprotech failed:', e1.message, '— trying GiftedTech');
            const form2 = new FormData();
            form2.append('apikey', 'gifted');
            form2.append('file', fs.createReadStream(tempFilePath), {
                filename: fileName,
                contentType: mimeType
            });
            const res2 = await axios.post('https://api.giftedtech.co.ke/api/tools/upload', form2, {
                headers: form2.getHeaders(),
                timeout: 60000
            });
            if (!res2.data?.result) {
                throw new Error('GiftedTech upload failed: ' + JSON.stringify(res2.data));
            }
            mediaUrl = res2.data.result;
            host = 'GiftedTech';
        }

        // Cleanup
        try { fs.unlinkSync(tempFilePath); } catch (e) {}

        // Media type label
        let mediaType = '📁 File';
        if (mimeType.includes('image'))      mediaType = '🖼️ Image';
        else if (mimeType.includes('video')) mediaType = '🎥 Video';
        else if (mimeType.includes('audio')) mediaType = '🎵 Audio';

        const resultMsg = `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || config.OWNER_NAME} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ 📎 𝐓𝐲𝐩𝐞:* ${mediaType}
*│❀ 📊 𝐒𝐢𝐳𝐞:* ${formatBytes(mediaBuffer.length)}
*│❀ 🌐 𝐇𝐨𝐬𝐭:* ${host}
*│❀ 🔗 𝐔𝐑𝐋:* ${mediaUrl}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

 ${config.DESCRIPTION}`;

        await conn.sendMessage(from, { text: resultMsg }, { quoted: mek });
        await conn.sendMessage(from, { react: { text: "✅", key: m.key } });

    } catch (error) {
        console.error("tourl error:", error);

        const errorMsg = `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || config.OWNER_NAME} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❌ 𝐔𝐩𝐥𝐨𝐚𝐝 𝐅𝐚𝐢𝐥𝐞𝐝*
*│⏳ Please try again later*
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

 ${config.DESCRIPTION}`;

        await reply(errorMsg);
        await conn.sendMessage(from, { react: { text: "❌", key: m.key } });
    }
});

// Helper
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
