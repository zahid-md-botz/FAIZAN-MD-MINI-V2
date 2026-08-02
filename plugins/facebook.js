const { cmd } = require("../command");
const config = require('../config');
const axios = require('axios');

// ============ FAIZAN-MD STYLE ============
function faizanStyle(title, value, status, quality = "") {
    return `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || '𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃'} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ 📘 ${title}:* ${value}
*│❀ 🎚️ 𝐐𝐮𝐚𝐥𝐢𝐭𝐲:* ${quality}
*│❀ ⚙️ 𝐒𝐭𝐚𝐭𝐮𝐬:* ${status}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> *𝐃σωɴℓσα∂є∂ 𝐒ᴜᴄᴄєѕѕfυℓℓу⎯꯭̽* ✅
`;
}

// ============ FAIZAN FACEBOOK API ============
const FB_API = "https://faizan-api.vercel.app/api/facebook1";

async function fetchFacebookVideo(url, quality = "720p") {
    try {
        const response = await axios.get(FB_API, {
            params: { url: url },
            timeout: 30000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        if (response.data?.success === true && response.data?.results) {
            const results = response.data.results;
            
            // Find video URL by requested quality
            let selected = results.find(r => r.quality.toLowerCase().includes(quality.toLowerCase()));
            
            // If exact quality not found, pick the first (usually highest)
            if (!selected) selected = results[0];
            
            return {
                success: true,
                videoUrl: selected.url,
                quality: selected.quality,
                source: response.data.source,
                allQualities: results.map(r => r.quality)
            };
        }
        return { success: false, error: 'Invalid API response' };
    } catch (err) {
        console.error('Facebook API Error:', err.message);
        return { success: false, error: err.message };
    }
}

// ============ MAIN COMMAND ============
cmd({
    pattern: "facebook",
    alias: ["fb", "fbdl", "facebookdl"],
    desc: "Download Facebook videos using Faizan API",
    category: "download",
    react: "📘",
    filename: __filename
}, async (conn, mek, m, { from, args, reply }) => {
    try {
        if (!args.length) {
            return reply(`*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ 📘 𝐅𝐀𝐂𝐄𝐁𝐎𝐎𝐊 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃𝐄𝐑 📘 ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ 📝 *Usage:* .fb <facebook_video_link> [quality]
*│❀ 🎬 *Example:* .fb https://www.facebook.com/share/v/xxx
*│❀ 🎚️ *Quality options:* 720p, 360p, 480p, 240p (default: highest)
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> *𝐏𝐫𝐨𝐯𝐢𝐝𝐞 𝐚 𝐅𝐚𝐜𝐞𝐛𝐨𝐨𝐤 𝐯𝐢𝐝𝐞𝐨 𝐥𝐢𝐧𝐤⎯꯭̽* 📘`);
        }

        let url = args[0];
        let qualityArg = args[1] || "720p";
        
        // Validate Facebook URL
        if (!url.includes('facebook.com') && !url.includes('fb.watch')) {
            return reply(faizanStyle('ERROR', 'Please provide a valid Facebook video link!', '❌', '—'));
        }

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        // Fetch video data
        const result = await fetchFacebookVideo(url, qualityArg);
        
        if (!result.success || !result.videoUrl) {
            return reply(faizanStyle('ERROR', result.error || 'Failed to fetch video', '❌', '—'));
        }

        // Send video
        await conn.sendMessage(from, {
            video: { url: result.videoUrl },
            mimetype: 'video/mp4',
            caption: faizanStyle('FACEBOOK', 'Video downloaded successfully!', '✅', result.quality)
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (err) {
        console.error('Facebook Error:', err.message);
        reply(faizanStyle('ERROR', err.message || 'Download failed. Try again later.', '❌', '—'));
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
    }
});

// ============ QUALITY LIST COMMAND ============
cmd({
    pattern: "fbqualities",
    alias: ["fbq", "fbqual"],
    desc: "Get available qualities for a Facebook video",
    category: "download",
    react: "📋",
    filename: __filename
}, async (conn, mek, m, { from, args, reply }) => {
    try {
        if (!args.length) {
            return reply("❌ Provide a Facebook video link!\nExample: .fbq https://www.facebook.com/share/v/xxx");
        }

        let url = args[0];
        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        const result = await fetchFacebookVideo(url);
        
        if (!result.success || !result.allQualities) {
            return reply(faizanStyle('ERROR', 'Could not fetch qualities', '❌', '—'));
        }

        let list = '';
        result.allQualities.forEach((q, i) => {
            list += `*│❀ ${i+1}. ${q}*\n`;
        });

        const message = `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ 📋 𝐀𝐕𝐀𝐈𝐋𝐀𝐁𝐋𝐄 𝐐𝐔𝐀𝐋𝐈𝐓𝐈𝐄𝐒 📋 ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
${list}
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ 💡 Use:* .fb <link> <quality>
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> *𝐃σωɴℓσα∂є∂ 𝐒ᴜᴄᴄєѕѕfυℓℓу⎯꯭̽* ✅`;

        await reply(message);
        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (err) {
        reply(faizanStyle('ERROR', err.message, '❌', '—'));
    }
});
