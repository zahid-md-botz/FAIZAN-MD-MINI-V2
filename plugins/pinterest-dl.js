const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const config = require('../config');

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);


function faizanStyle(title, value, status) {
    return `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || '𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃'} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ 📌 ${title}:* ${value}
*│❀ ⚙️ 𝐒𝐭𝐚𝐭𝐮𝐬:* ${status}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> ${config.DESCRIPTION || 'ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 🤍'}
`;
}

async function downloadAndConvert(url) {
    try {
        const apiUrl = `https://api.qasimdev.dpdns.org/api/download/pinterest?url=${encodeURIComponent(url)}&apiKey=qasim-dev`;
        const res = await axios.get(apiUrl, { timeout: 30000 });
        const data = res.data;

        if (!data?.success || !data?.data?.download_url) {
            throw new Error('No download URL found');
        }

        const videoUrl = data.data.download_url;
        
        // Download video
        const videoRes = await axios.get(videoUrl, {
            responseType: 'arraybuffer',
            timeout: 60000
        });
        
        let videoBuffer = Buffer.from(videoRes.data);
        
        // FFmpeg - Convert to proper format
        try {
            const tempInput = path.join(__dirname, `temp_pin_${Date.now()}.mp4`);
            const tempOutput = path.join(__dirname, `final_pin_${Date.now()}.mp4`);
            
            fs.writeFileSync(tempInput, videoBuffer);
            
            await new Promise((resolve, reject) => {
                ffmpeg(tempInput)
                    .videoCodec('libx264')
                    .audioCodec('aac')
                    .format('mp4')
                    .outputOptions(['-movflags', '+faststart'])
                    .on('end', resolve)
                    .on('error', reject)
                    .save(tempOutput);
            });
            
            videoBuffer = fs.readFileSync(tempOutput);
            
            // Cleanup
            if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
            if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
            
            console.log(`[PINTEREST] FFmpeg conversion successful`);
        } catch (ffErr) {
            console.log(`[PINTEREST] FFmpeg conversion skipped: ${ffErr.message}`);
        }
        
        return videoBuffer;
        
    } catch (error) {
        console.error('Pinterest download error:', error);
        return null;
    }
}

cmd({
    pattern: "pinterest",
    alias: ["pin", "pindl"],
    desc: "Download Pinterest videos",
    category: "download",
    react: "📌",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) {
            return reply(faizanStyle('PINTEREST', 'Please provide Pinterest link\nExample: .pin https://pin.it/xxxxx', '❌'));
        }

        if (!/pinterest\.com|pin\.it/i.test(q)) {
            return reply(faizanStyle('PINTEREST', 'Invalid Pinterest link', '❌'));
        }

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        await reply(faizanStyle('PINTEREST', `Processing: ${q}`, '🔍'));

        const videoBuffer = await downloadAndConvert(q);
        
        if (!videoBuffer) {
            throw new Error('Download failed');
        }

        await conn.sendMessage(from, {
            video: videoBuffer,
            mimetype: 'video/mp4',
            caption: faizanStyle('PINTEREST', 'Video Ready', '✅')
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

    } catch (err) {
        console.error('Pinterest downloader error:', err);
        
        const errorMsg = err.response?.data?.message || err.message || 'Download failed';
        await reply(faizanStyle('PINTEREST', errorMsg, '❌'));
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
    }
});
