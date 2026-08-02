const { cmd } = require('../command');
const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const config = require('../config');

ffmpeg.setFfmpegPath(ffmpegPath);


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

async function getVideoInfo(query) {
    try {
        const search = await yts(query);
        if (!search.videos || search.videos.length === 0) return null;
        return search.videos[0];
    } catch (e) {
        console.error("Search error:", e);
        return null;
    }
}

async function downloadVideo(url) {
    const apis = [
        `https://api.giftedtech.co.ke/api/download/ytmp4v2?apikey=gifted&url=${encodeURIComponent(url)}`,
        `https://api.dhamzxploit.my.id/api/ytmp4?url=${encodeURIComponent(url)}`,
        `https://jawad-tech.vercel.app/download/ytdl?url=${encodeURIComponent(url)}`
    ];
    
    for (const apiUrl of apis) {
        try {
            const response = await axios.get(apiUrl, { timeout: 30000 });
            
            let videoUrl = null;
            let title = null;
            let quality = "720p";
            
            if (response.data?.success && response.data?.result?.download_url) {
                videoUrl = response.data.result.download_url;
                title = response.data.result.title;
                quality = response.data.result.quality || "720p";
            }
            else if (response.data?.status && response.data?.result?.url) {
                videoUrl = response.data.result.url;
                title = response.data.result.title;
                quality = response.data.result.quality || "720p";
            }
            else if (response.data?.status && response.data?.result?.mp4) {
                videoUrl = response.data.result.mp4;
                title = response.data.result.title;
            }
            
            if (videoUrl) {
                const videoRes = await axios.get(videoUrl, {
                    responseType: 'arraybuffer',
                    timeout: 120000
                });
                
                let videoBuffer = Buffer.from(videoRes.data);
                
                if (videoBuffer && videoBuffer.length > 10000) {
                    const header = videoBuffer.slice(0, 5).toString('hex');
                    if (header !== '3c68746d' && !videoBuffer.toString().includes('<!DOCTYPE')) {
                        try {
                            const tempInput = path.join(__dirname, `temp_vid_${Date.now()}.mp4`);
                            const tempOutput = path.join(__dirname, `final_vid_${Date.now()}.mp4`);
                            
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
                            
                            if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
                            if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
                        } catch (ffErr) {}
                        
                        return {
                            buffer: videoBuffer,
                            title: title || "Video",
                            quality: quality
                        };
                    }
                }
            }
        } catch (e) {}
    }
    return null;
}

async function downloadAudio(url) {
    const apis = [
        `https://api.giftedtech.co.ke/api/download/ytmp3v2?apikey=gifted&url=${encodeURIComponent(url)}&quality=320`,
        `https://api.dhamzxploit.my.id/api/ytmp3?url=${encodeURIComponent(url)}`,
        `https://jawad-tech.vercel.app/download/ytmp3?url=${encodeURIComponent(url)}`
    ];
    
    for (const apiUrl of apis) {
        try {
            const response = await axios.get(apiUrl, { timeout: 30000 });
            
            let audioUrl = null;
            let title = null;
            
            if (response.data?.success && response.data?.result?.download_url) {
                audioUrl = response.data.result.download_url;
                title = response.data.result.title;
            }
            else if (response.data?.status && response.data?.result?.url) {
                audioUrl = response.data.result.url;
                title = response.data.result.title;
            }
            
            if (audioUrl) {
                const audioRes = await axios.get(audioUrl, {
                    responseType: 'arraybuffer',
                    timeout: 120000
                });
                return {
                    buffer: Buffer.from(audioRes.data),
                    title: title || "Audio"
                };
            }
        } catch (e) {}
    }
    return null;
}

cmd({
    pattern: "yt",
    alias: ["play3", "song3", "video3"],
    desc: "Download YouTube video or audio",
    category: "download",
    react: "🎬",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) {
            return reply(faizanStyle('YOUTUBE', 'Please provide song/video name\nExample: .yt shape of you', '❌'));
        }

        await conn.sendMessage(from, { react: { text: '🔍', key: mek.key } });
        await reply(faizanStyle('YOUTUBE', `Searching: "${q}"`, '🔍'));

        const videoInfo = await getVideoInfo(q);
        if (!videoInfo) {
            return reply(faizanStyle('YOUTUBE', 'No results found', '❌'));
        }

        const sentMsg = await conn.sendMessage(from, {
            image: { url: videoInfo.thumbnail },
            caption: faizanStyle('SELECT OPTION', 
                `🎬 *Title:* ${videoInfo.title}\n⏰ *Duration:* ${videoInfo.timestamp}\n👁️ *Views:* ${videoInfo.views}\n\n📌 *Reply with:*\n1️⃣ Video\n2️⃣ Audio`, 
                '🎬')
        }, { quoted: mek });

        const messageID = sentMsg.key.id;

        const handler = async (msgData) => {
            try {
                const receivedMsg = msgData.messages[0];
                if (!receivedMsg?.message) return;

                const isReplyToMenu = receivedMsg.message.extendedTextMessage?.contextInfo?.stanzaId === messageID;
                if (!isReplyToMenu) return;

                const receivedText = receivedMsg.message.conversation || 
                                    receivedMsg.message.extendedTextMessage?.text || '';
                const senderID = receivedMsg.key.remoteJid;

                if (receivedText === "1") {
                    await conn.sendMessage(senderID, { react: { text: '⬇️', key: receivedMsg.key } });
                    await conn.sendMessage(senderID, { text: faizanStyle('VIDEO', `Downloading: ${videoInfo.title}`, '⏳') }, { quoted: receivedMsg });
                    
                    const videoData = await downloadVideo(videoInfo.url);
                    if (videoData && videoData.buffer && videoData.buffer.length > 10000) {
                        // ✅ VIDEO AS VIDEO (not document)
                        await conn.sendMessage(senderID, {
                            video: videoData.buffer,
                            mimetype: 'video/mp4',
                            fileName: `${videoData.title.replace(/[^\w\s]/g, '')}.mp4`,
                            caption: faizanStyle('VIDEO READY', `${videoData.title}\n🎬 Quality: ${videoData.quality}`, '✅')
                        }, { quoted: receivedMsg });
                        await conn.sendMessage(senderID, { react: { text: '✅', key: receivedMsg.key } });
                    } else {
                        await conn.sendMessage(senderID, { text: faizanStyle('VIDEO', 'Download failed', '❌') }, { quoted: receivedMsg });
                        await conn.sendMessage(senderID, { react: { text: '❌', key: receivedMsg.key } });
                    }
                } 
                else if (receivedText === "2") {
                    await conn.sendMessage(senderID, { react: { text: '⬇️', key: receivedMsg.key } });
                    await conn.sendMessage(senderID, { text: faizanStyle('AUDIO', `Downloading: ${videoInfo.title}`, '⏳') }, { quoted: receivedMsg });
                    
                    const audioData = await downloadAudio(videoInfo.url);
                    if (audioData && audioData.buffer && audioData.buffer.length > 10000) {
                        await conn.sendMessage(senderID, {
                            audio: audioData.buffer,
                            mimetype: 'audio/mpeg',
                            fileName: `${audioData.title.replace(/[^\w\s]/g, '')}.mp3`,
                            ptt: false,
                            caption: faizanStyle('AUDIO READY', `${audioData.title}\n🎧 Quality: 320kbps`, '✅')
                        }, { quoted: receivedMsg });
                        await conn.sendMessage(senderID, { react: { text: '✅', key: receivedMsg.key } });
                    } else {
                        await conn.sendMessage(senderID, { text: faizanStyle('AUDIO', 'Download failed', '❌') }, { quoted: receivedMsg });
                        await conn.sendMessage(senderID, { react: { text: '❌', key: receivedMsg.key } });
                    }
                }
                else {
                    await conn.sendMessage(senderID, { text: faizanStyle('INVALID', 'Reply with 1 or 2', '❌') }, { quoted: receivedMsg });
                }

                conn.ev.off('messages.upsert', handler);
            } catch (e) {}
        };

        conn.ev.on('messages.upsert', handler);
        setTimeout(() => conn.ev.off('messages.upsert', handler), 120000);

    } catch (err) {
        console.error("YTDL Error:", err);
        await reply(faizanStyle('ERROR', err.message || 'Download failed', '❌'));
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
    }
});
