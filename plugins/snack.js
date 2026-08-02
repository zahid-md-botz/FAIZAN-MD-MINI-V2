const axios = require("axios");
const { cmd } = require("../command");
const config = require('../config');

// FAIZAN style formatter
function faizanStyle(title, value, status) {
    return `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || '𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃'} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ 🎬 ${title}:* ${value}
*│❀ ⚙️ 𝐒𝐭𝐚𝐭𝐮𝐬:* ${status}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> ${config.DESCRIPTION || 'ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 🤍'}
`;
}

cmd({
    pattern: "snack",
    alias: ["snackvideo", "snackdl", "kvideo", "snackvd"],
    desc: "Download videos from SnackVideo",
    react: "🎬",
    category: "download",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) {
            return reply(faizanStyle('SNACKVIDEO', 'Please provide a valid SnackVideo URL\nExample: .snack https://s.snackvideo.com/...', '❌'));
        }

        // Show working reaction
        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });
        await reply(faizanStyle('SNACKVIDEO', 'Downloading...', '⏳'));

        // Working API
        const apiURL = `https://api.deline.web.id/downloader/snackvideo?url=${encodeURIComponent(q)}`;

        let data;
        try {
            const apiResp = await axios.get(apiURL, { 
                timeout: 30000, 
                maxRedirects: 5,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                }
            });
            data = apiResp.data;
            console.log("API Response:", JSON.stringify(data, null, 2));
        } catch (apiErr) {
            console.error("API Request Failed:", apiErr.message);
            return reply(faizanStyle('SNACKVIDEO', 'Failed to connect to API', '❌'));
        }

        // Check status
        if (data.status === false || data.status === "false") {
            return reply(faizanStyle('SNACKVIDEO', 'API returned an error', '❌'));
        }

        // Extract video URL - multiple methods
        let videoUrl = null;
        let videoTitle = "SnackVideo";
        
        if (data.result && data.result.video) {
            videoUrl = data.result.video;
            videoTitle = data.result.title || videoTitle;
        } else if (data.result && typeof data.result === "string") {
            videoUrl = data.result;
        } else if (data.video) {
            videoUrl = data.video;
        } else if (data.url) {
            videoUrl = data.url;
        }

        if (!videoUrl) {
            console.error("Full API Response:", data);
            return reply(faizanStyle('SNACKVIDEO', 'No video URL found', '❌'));
        }

        console.log("Video URL Found:", videoUrl);

        // Update reaction
        await conn.sendMessage(from, { react: { text: "⬇️", key: mek.key } });

        // Download video buffer
        let videoBuffer = null;
        let sizeMB = "0";
        
        try {
            const videoResp = await axios.get(videoUrl, {
                responseType: "arraybuffer",
                timeout: 120000,
                maxRedirects: 10,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "*/*",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Connection": "keep-alive",
                    "Referer": "https://www.snackvideo.com/"
                }
            });

            videoBuffer = Buffer.from(videoResp.data);
            sizeMB = (videoBuffer.length / (1024 * 1024)).toFixed(2);
            console.log(`✅ Video Downloaded: ${sizeMB} MB`);

        } catch (dlErr) {
            console.error("Download Error:", dlErr.message);
        }

        // Build caption
        const infoText = `🎬 *Title:* ${videoTitle}\n📦 *Size:* ${sizeMB} MB`;
        
        // Send video
        if (videoBuffer && videoBuffer.length > 1000) {
            try {
                await conn.sendMessage(from, {
                    video: videoBuffer,
                    mimetype: "video/mp4",
                    fileName: "snackvideo.mp4",
                    caption: faizanStyle('SNACKVIDEO', infoText, '✅')
                }, { quoted: mek });

                await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
                return;
            } catch (e) {
                console.error("Send Error:", e.message);
            }
        }

        // Fallback: Send as document
        try {
            await conn.sendMessage(from, {
                document: { url: videoUrl },
                mimetype: "video/mp4",
                fileName: "snackvideo.mp4",
                caption: faizanStyle('SNACKVIDEO', infoText, '✅')
            }, { quoted: mek });

            await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
            return;
        } catch (e) {
            console.error("Document Send Error:", e.message);
        }

        // Final fallback: Send link
        await reply(faizanStyle('SNACKVIDEO', `Download Link:\n${videoUrl}`, '🔗'));

    } catch (error) {
        console.error("Main Error:", error);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply(faizanStyle('SNACKVIDEO', error.message || 'An error occurred', '❌'));
    }
});
