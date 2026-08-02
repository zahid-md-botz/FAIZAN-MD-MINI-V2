const { cmd } = require("../command");
const config = require('../config');
const axios = require('axios');
const yts = require('yt-search');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

// =================== FFMPEG SETUP ===================
ffmpeg.setFfmpegPath(ffmpegPath);

// =================== TEMP DIRECTORY ===================
const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// =================== FAIZAN-MD STYLE ===================
function faizanStyle(title, value, status, quality = "", duration = "") {
    return `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || '𝐅αɪᴢαɴ-𝐌ᴅ⎯꯭̽'} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❖ 🍵 ${title}:* ${value}
*│❖ 🌧 𝐐𝐮𝐚𝐥𝐢𝐭𝐲:* ${quality}
*│❖ ⏱️ 𝐃𝐮𝐫𝐚𝐭𝐢𝐨𝐧:* ${duration}
*│❖ ✨ 𝐒𝐭𝐚𝐭𝐮𝐬:* ${status}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> ${config.DESCRIPTION || '𝆸𝆰𝆴𝆸𝆰𝆴 𝆵𝆰 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 🍍'}
`;
}

// =================== FAIZAN API (ytdl - YouTube Legacy) ===================
const FAIZAN_API = "https://faizan-api.vercel.app/api/ytdl"; // switched to ytdl (YouTube Legacy)

async function downloadWithFaizan(url) {
    try {
        const response = await axios.get(FAIZAN_API, {
            params: { url, type: 'mp3' },
            timeout: 60000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const data = response.data;

        if (data?.status === true && data?.result?.audio_download) {
            return {
                success: true,
                audioUrl: data.result.audio_download,
                title: data.result.title || 'Audio',
                duration: data.result.duration ? `${data.result.duration}s` : 'Unknown',
                quality: '128kbps'
            };
        }
        return { success: false, error: 'No download link found' };
    } catch (err) {
        console.error('Faizan API Error:', err.message);
        return { success: false, error: err.message };
    }
}

// =================== GET VIDEO URL (NAME OR LINK) ===================
async function getVideoUrl(query) {
    if (query.includes('youtube.com') || query.includes('youtu.be')) {
        return { url: query, title: null, thumbnail: null, duration: null };
    }

    const search = await yts(query);
    if (!search.videos || search.videos.length === 0) {
        throw new Error("No results found");
    }
    const video = search.videos[0];
    return {
        url: video.url,
        title: video.title,
        thumbnail: video.thumbnail,
        duration: video.timestamp
    };
}

// =================== DOWNLOAD URL TO TEMP FILE ===================
async function downloadToFile(url, filePath) {
    const response = await axios({ url, method: 'GET', responseType: 'stream', timeout: 60000 });
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

// =================== FFMPEG: CONVERT + APPLY EFFECT ===================
async function convertToOpus(inputPath, outputPath, effect = null) {
    return new Promise((resolve, reject) => {
        let command = ffmpeg(inputPath);

        // Apply effect filter
        if (effect) {
            switch (effect) {
                case 'fast':    command.audioFilters('atempo=1.5'); break;
                case 'slow':    command.audioFilters('atempo=0.8'); break;
                case 'bass':    command.audioFilters('bass=g=10'); break;
                case 'volume':  command.audioFilters('volume=2.0'); break;
                case 'reverse': command.audioFilters('areverse'); break;
            }
        }

        // Convert to OGG Opus — WhatsApp ka best supported audio format
        command
            .audioCodec('libopus')
            .audioChannels(1)
            .audioFrequency(48000)
            .format('ogg')
            .output(outputPath)
            .on('end', () => resolve(outputPath))
            .on('error', reject)
            .run();
    });
}

// =================== CLEANUP TEMP FILES ===================
function cleanTemp(...files) {
    for (const f of files) {
        try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {}
    }
}

// =================== MAIN COMMAND ===================
cmd({
    pattern: "song",
    alias: ["play", "music", "audio", "yta", "mp3"],
    desc: "Download audio from YouTube by name or link (Faizan API)",
    category: "download",
    react: "🍵",
    filename: __filename
}, async (conn, mek, m, { from, args, reply }) => {
    const tempInput = path.join(tempDir, `input_${Date.now()}.mp3`);
    const tempOutput = path.join(tempDir, `output_${Date.now()}.ogg`);

    try {
        if (!args.length) {
            return reply(`*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || '𝐅𝐀𝐈𝐙𝐀𝐍 𝐌𝐄𝐍𝐔'} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❖ 📝 Usage:* .song <name or link>
*│❖ 📗 Example:* .song Believer Imagine Dragons
*│❖ 📗 Example:* .song https://youtube.com/shorts/xxx
*│❖ ✨ Effects:* fast, slow, bass, volume, reverse
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> *𝐏𝐫𝐨𝐯𝐢𝐝𝐞𝐝 𝐁𝐲 𝐅𝐚𝐢𝐳𝐚𝐧-𝐌𝐝 🍵*`);
        }

        let query = args.join(" ");
        let effect = null;

        // Check for effects
        const effects = ['fast', 'slow', 'bass', 'volume', 'reverse'];
        for (const eff of effects) {
            if (args.includes(eff)) {
                effect = eff;
                query = args.filter(a => a !== eff).join(" ");
                break;
            }
        }

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

        // Get video URL and info
        const videoInfo = await getVideoUrl(query);

        // Send thumbnail if available
        if (videoInfo.thumbnail) {
            await conn.sendMessage(from, {
                image: { url: videoInfo.thumbnail },
                caption: faizanStyle('PROCESSING', videoInfo.title ? videoInfo.title.substring(0, 60) : 'Searching...', '⏳ Fetching audio...', '128kbps', videoInfo.duration || 'Unknown')
            }, { quoted: mek });
        }

        // Download audio using Faizan API
        let result = await downloadWithFaizan(videoInfo.url);

        if (!result.success || !result.audioUrl) {
            throw new Error(result.error || "Download failed");
        }

        const finalTitle = result.title || videoInfo.title || 'Audio';
        const finalDuration = result.duration || videoInfo.duration || 'Unknown';

        // ✅ Download audio to temp file
        await downloadToFile(result.audioUrl, tempInput);

        // ✅ Convert to OGG Opus via FFmpeg (with optional effect)
        await convertToOpus(tempInput, tempOutput, effect);

        // ✅ Send as PTT (voice note) — plays automatically in WhatsApp
        await conn.sendMessage(from, {
            audio: { url: tempOutput },
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true,
            fileName: `${finalTitle.replace(/[^\w\s-]/g, '').substring(0, 50)}.ogg`,
            caption: faizanStyle('SONG', `${finalTitle.substring(0, 100)}${effect ? `\n🎮️ Effect: ${effect}` : ''}`, '✅', result.quality, finalDuration)
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

    } catch (err) {
        console.error('Song Error:', err.message);
        reply(faizanStyle('ERROR', err.message || 'Download failed. Try again later.', '❌', '—', '—'));
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
    } finally {
        // Cleanup temp files
        cleanTemp(tempInput, tempOutput);
    }
});
