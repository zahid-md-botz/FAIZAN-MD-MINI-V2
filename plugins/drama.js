const { cmd } = require("../command");
const config = require('../config');
const axios = require('axios');
const yts = require('yt-search');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

// ============ SET FFMPEG PATH ============
ffmpeg.setFfmpegPath(ffmpegPath);

// ============ TEMP DIRECTORY ============
const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// ============ FAIZAN-MD STYLE ============
function faizanStyle(title, value, status) {
    return `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || '𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃'} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ 🎭 ${title}:* ${value}
*│❀ ⚙️ 𝐒𝐭𝐚𝐭𝐮𝐬:* ${status}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

 ${config.DESCRIPTION}
`;
}

// ============ FFMPEG VIDEO PROCESSING ============
async function processVideo(inputUrl, outputPath, options = {}) {
    return new Promise((resolve, reject) => {
        const tempInput = path.join(tempDir, `input_${Date.now()}.mp4`);
        const tempOutput = path.join(tempDir, `output_${Date.now()}.mp4`);
        
        // Download video first
        axios({
            method: 'get',
            url: inputUrl,
            responseType: 'stream'
        }).then(response => {
            const writer = fs.createWriteStream(tempInput);
            response.data.pipe(writer);
            
            writer.on('finish', () => {
                // Process with FFmpeg
                let command = ffmpeg(tempInput);
                
                // Apply options
                if (options.compress) {
                    command = command.videoCodec('libx264').size('720x?');
                }
                if (options.audioOnly) {
                    command = command.noVideo().audioCodec('libmp3lame');
                }
                if (options.trim) {
                    command = command.setStartTime(options.trim.start).setDuration(options.trim.duration);
                }
                
                command
                    .output(tempOutput)
                    .on('end', () => {
                        const buffer = fs.readFileSync(tempOutput);
                        // Cleanup
                        fs.unlinkSync(tempInput);
                        fs.unlinkSync(tempOutput);
                        resolve(buffer);
                    })
                    .on('error', (err) => {
                        // Cleanup
                        try { fs.unlinkSync(tempInput); } catch(e) {}
                        try { fs.unlinkSync(tempOutput); } catch(e) {}
                        reject(err);
                    })
                    .run();
            });
            
            writer.on('error', reject);
        }).catch(reject);
    });
}

// ============ APIs (Multiple Fallbacks) ============
const APIS = {
    silva: async (url) => {
        try {
            const response = await axios.get(`https://silva-api.vercel.app/download/yt-stream`, {
                params: { url, type: 'video' },
                timeout: 30000
            });
            if (response.data?.url || response.data?.download_url) {
                return {
                    success: true,
                    downloadUrl: response.data.url || response.data.download_url,
                    title: response.data.title || 'Drama Waka Video',
                    quality: response.data.quality || '720p'
                };
            }
            return { success: false };
        } catch (e) {
            return { success: false };
        }
    },
    gifted: async (url) => {
        try {
            const response = await axios.get(`https://api.giftedtech.co.ke/api/download/ytmp4v2`, {
                params: { apikey: 'gifted', url },
                timeout: 30000
            });
            if (response.data?.success && response.data?.result?.download_url) {
                return {
                    success: true,
                    downloadUrl: response.data.result.download_url,
                    title: response.data.result.title,
                    quality: response.data.result.quality || '720p'
                };
            }
            return { success: false };
        } catch (e) {
            return { success: false };
        }
    },
    yupra: async (url) => {
        try {
            const response = await axios.get(`https://api.yupra.my.id/api/downloader/ytmp4`, {
                params: { url },
                timeout: 30000
            });
            if (response.data?.success && response.data?.data?.download_url) {
                return {
                    success: true,
                    downloadUrl: response.data.data.download_url,
                    title: response.data.data.title,
                    quality: response.data.data.quality || '720p'
                };
            }
            return { success: false };
        } catch (e) {
            return { success: false };
        }
    }
};

// ============ SEARCH VIDEO ============
async function searchVideo(query) {
    const search = await yts(query);
    if (!search.videos || search.videos.length === 0) {
        throw new Error("No results found");
    }
    const video = search.videos[0];
    return {
        url: video.url,
        title: video.title,
        thumbnail: video.thumbnail,
        duration: video.timestamp,
        views: video.views
    };
}

// ============ DRAMA WAKA MAIN COMMAND ============
cmd({
    pattern: "drama",
    alias: ["dw", "dd", "dramadoc"],
    desc: "Send YouTube video as document (with FFmpeg processing)",
    category: "download",
    react: "🎭",
    filename: __filename
}, async (conn, mek, m, { from, args, reply }) => {
    try {
        if (!args.length) {
            return reply(`*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ 🎭 𝐃𝐑𝐀𝐌𝐀 🎭 ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ 📝 *𝐔𝐄𝐒𝐈𝐍𝐆:* .drama <song name or link>
*│❀ 🎬 *𝐄𝐗𝐀𝐌𝐏𝐋𝐄:* .drama Imagine Dragons Believer
*│❀ 🔗 *𝐁𝐘 𝐋𝐈𝐍𝐊:* .drama https://youtu.be/xxxxx
*│❀ 📄 *𝐎𝐔𝐓𝐏𝐔𝐓:* Video as Document (Processed)
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> *𝐏𝐫𝐨𝐯𝐢𝐝𝐞 𝐬𝐨𝐧𝐠 𝐧𝐚𝐦𝐞 𝐨𝐫 𝐘𝐨𝐮𝐓𝐮𝐛𝐞 𝐥𝐢𝐧𝐤⎯꯭̽* 🎭`);
        }

        let query = args.join(" ");
        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        // Check if query is YouTube link or search term
        let videoUrl, videoTitle, videoThumb, videoDuration;
        
        if (query.includes('youtube.com') || query.includes('youtu.be')) {
            videoUrl = query;
            const videoId = videoUrl.match(/(?:youtu\.be\/|v=)([a-zA-Z0-9_-]{11})/)?.[1];
            if (videoId) {
                const search = await yts({ videoId });
                if (search) {
                    videoTitle = search.title;
                    videoThumb = search.thumbnail;
                    videoDuration = search.timestamp;
                }
            }
        } else {
            const searchResult = await searchVideo(query);
            videoUrl = searchResult.url;
            videoTitle = searchResult.title;
            videoThumb = searchResult.thumbnail;
            videoDuration = searchResult.duration;
        }

        if (!videoTitle) videoTitle = "Drama Waka Video";

        // Send thumbnail
        if (videoThumb) {
            await conn.sendMessage(from, {
                image: { url: videoThumb },
                caption: `🎭 *𝔻𝕣𝕒𝕞𝕒  ℙ𝕣𝕠𝕔𝕖𝕤𝕤𝕚𝕟𝕘...*\n\n📹 *𝐓𝐈𝐓𝐋𝐄:* ${videoTitle.substring(0, 60)}\n⏱️ *𝐃𝐔𝐑𝐀𝐓𝐈𝐎𝐍:* ${videoDuration || 'Unknown'}\n🎬 *𝐃𝐎𝐂𝐔𝐌𝐄𝐍𝐓:* Processing...`
            }, { quoted: mek });
        }

        // Download video
        let result = null;
        for (const [name, apiFn] of Object.entries(APIS)) {
            try {
                console.log(`[DRAMA] Trying ${name}...`);
                result = await apiFn(videoUrl);
                if (result.success && result.downloadUrl) {
                    console.log(`[DRAMA] ✅ ${name} success`);
                    break;
                }
            } catch(e) {}
        }

        if (!result || !result.downloadUrl) {
            throw new Error("All APIs failed. Try again later.");
        }

        const finalTitle = result.title || videoTitle;
        const safeFileName = finalTitle.replace(/[^\w\s-]/g, '').substring(0, 50);

        // ============ PROCESS WITH FFMPEG ============
        let finalBuffer;
        try {
            console.log('[DRAMA] Processing with FFmpeg...');
            finalBuffer = await processVideo(result.downloadUrl, null, { compress: true });
            console.log('[DRAMA] ✅ 𝐃𝐨𝐜𝐮𝐦𝐞𝐧𝐭 processing complete');
        } catch (ffErr) {
            console.log('[DRAMA] FFmpeg failed, using direct download:', ffErr.message);
            // Fallback: download directly
            const { data } = await axios.get(result.downloadUrl, { responseType: 'arraybuffer' });
            finalBuffer = Buffer.from(data);
        }
        
        // Send as DOCUMENT
        await conn.sendMessage(from, {
            document: finalBuffer,
            mimetype: 'video/mp4',
            fileName: `${safeFileName}.mp4`,
            caption: faizanStyle('DRAMA ', `📄 *${finalTitle.substring(0, 50)}*\n📦 Sent as Document\n🎚️ Quality: ${result.quality}\n🎬 FFmpeg: ${finalBuffer.length > 0 ? '✅' : '⚠️'}`, '✅')
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (err) {
        console.error('Drama Waka Error:', err);
        reply(faizanStyle('DRAMA ', err.message || 'Download failed', '❌'));
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
    }
});

// ============ SHORTCUT ============
cmd({
    pattern: "dw",
    alias: ["dramawaka"],
    desc: "Send YouTube video as document (shortcut)",
    category: "download",
    react: "🎭",
    filename: __filename
}, async (conn, mek, m, { from, args, reply }) => {
    if (!args.length) return reply("❌ Provide song name or link!\nExample: .dw Imagine Dragons");
    await cmd.functions.get('drama')(conn, mek, m, { from, args, reply });
});
