const { cmd } = require('../command');
const axios = require('axios');
const yts = require('yt-search');

cmd({
    pattern: "video3",
    alias: ["ytvideo", "mp4"],
    desc: "Download video from YouTube",
    category: "download",
    react: "🎬",
    filename: __filename
},
async (conn, mek, m, { from, q, reply, react }) => {
    try {
        if (!q) {
            return reply(`╭ׂ┄•─̇─̣┄•─̇─̣┄•─̇─̣┄•─̇─̣╮
│ ╌─̇─̣⊰ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 _⁸⁷³ ⊱┈─̇─̣╌
│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣
│❌ Please provide a video name
│📌 Example: .video funny cats
╰┄•─̇─̣┄•─̇─̣┄•─̇─̣┄•─̇─̣╯

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 _⁸⁷³`);
        }

        await react("⏳");
        
        // Search YouTube
        const search = await yts(q);
        if (!search.videos || !search.videos.length) {
            await react("❌");
            return reply(`╭ׂ┄•─̇─̣┄•─̇─̣┄•─̇─̣┄•─̇─̣╮
│ ╌─̇─̣⊰ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 _⁸⁷³ ⊱┈─̇─̣╌
│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣
│❌ No results found for "${q}"
╰┄•─̇─̣┄•─̇─̣┄•─̇─̣┄•─̇─̣╯

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 _⁸⁷³`);
        }
        
        const video = search.videos[0];
        
        // Send info with thumbnail
        await conn.sendMessage(from, {
            image: { url: video.thumbnail },
            caption: `╭ׂ┄•─̇─̣┄•─̇─̣┄•─̇─̣┄•─̇─̣╮
│ ╌─̇─̣⊰ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 _⁸⁷³ ⊱┈─̇─̣╌
│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣
│🎬 *${video.title}*
│⏱️ *Duration:* ${video.timestamp}
│⬇️ *Downloading video...*
╰┄•─̇─̣┄•─̇─̣┄•─̇─̣┄•─̇─̣╯

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 _⁸⁷³`
        }, { quoted: mek });
        
        // Working APIs
        const apis = [
            `https://api.agatz.xyz/api/ytmp4?url=${video.url}`,
            `https://api.ryzendesu.vip/api/downloader/ytmp4?url=${video.url}`,
            `https://api.siputzx.my.id/api/d/ytmp4?url=${video.url}`
        ];
        
        let downloadUrl = null;
        let finalTitle = video.title;
        
        for (const api of apis) {
            try {
                const { data } = await axios.get(api, { timeout: 15000 });
                
                if (api.includes('agatz') && data?.data?.download?.url) {
                    downloadUrl = data.data.download.url;
                    finalTitle = data.data.title || finalTitle;
                    break;
                }
                if (api.includes('ryzendesu') && data?.url) {
                    downloadUrl = data.url;
                    break;
                }
                if (api.includes('siputzx') && data?.data?.download?.url) {
                    downloadUrl = data.data.download.url;
                    finalTitle = data.data.metadata?.title || finalTitle;
                    break;
                }
            } catch (e) {
                console.log(`API ${api} failed, trying next...`);
            }
        }
        
        if (!downloadUrl) {
            await react("❌");
            return reply(`╭ׂ┄•─̇─̣┄•─̇─̣┄•─̇─̣┄•─̇─̣╮
│ ╌─̇─̣⊰ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 _⁸⁷³ ⊱┈─̇─̣╌
│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣
│❌ Video download failed!
│💡 Try another video
╰┄•─̇─̣┄•─̇─̣┄•─̇─̣┄•─̇─̣╯

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 _⁸⁷³`);
        }
        
        // Send video
        await conn.sendMessage(from, {
            video: { url: downloadUrl },
            mimetype: 'video/mp4',
            caption: `╭ׂ┄•─̇─̣┄•─̇─̣┄•─̇─̣┄•─̇─̣╮
│ ╌─̇─̣⊰ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 _⁸⁷³ ⊱┈─̇─̣╌
│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣
│✅ *Download Complete!*
│🎬 ${finalTitle}
╰┄•─̇─̣┄•─̇─̣┄•─̇─̣┄•─̇─̣╯

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 _⁸⁷³`
        }, { quoted: mek });
        
        await react("✅");
        
    } catch (e) {
        console.error("Video plugin error:", e);
        await react("❌");
        reply(`╭ׂ┄•─̇─̣┄•─̇─̣┄•─̇─̣┄•─̇─̣╮
│ ╌─̇─̣⊰ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 _⁸⁷³ ⊱┈─̇─̣╌
│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣
│❌ Error: ${e.message}
╰┄•─̇─̣┄•─̇─̣┄•─̇─̣┄•─̇─̣╯

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 _⁸⁷³`);
    }
});
