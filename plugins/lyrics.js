const { cmd } = require('../command');
const axios = require('axios');
const config = require('../config');

// ============ FAIZAN-MD 1.0.0 STYLE ============
function faizanStyle(title, value, status) {
    return `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || '𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃'} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ 🎵 ${title}:* ${value}
*│❀ ⚙️ 𝐒𝐭𝐚𝐭𝐮𝐬:* ${status}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> *𝐃σωɴℓσα∂є∂ 𝐒ᴜᴄᴄєѕѕfυℓℓу⎯꯭̽* ✅
`;
}

// ============ LYRIC API ============
const LYRIC_API = "https://discardapi.dpdns.org/api/music/lyrics";

async function fetchLyrics(songName) {
    try {
        const response = await axios.get(LYRIC_API, {
            params: { apikey: 'qasim', song: songName },
            timeout: 20000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        if (response.data?.status === 200 && response.data?.result?.message) {
            const data = response.data.result.message;
            return {
                success: true,
                title: data.title || songName,
                artist: data.artist || 'Unknown',
                lyrics: data.lyrics || 'No lyrics found',
                image: data.image || null
            };
        }
        return { success: false };
    } catch (err) {
        console.error('Lyrics API Error:', err.message);
        return { success: false };
    }
}

// ============ MAIN LYRICS COMMAND ============
cmd({
    pattern: "lyrics",
    alias: ["lyric", "songlyrics", "ly"],
    desc: "Get lyrics of a song with artist and image",
    category: "music",
    react: "🎵",
    filename: __filename
}, async (conn, mek, m, { from, args, reply }) => {
    try {
        const songTitle = args.join(' ').trim();
        
        if (!songTitle) {
            return reply(`*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ 🎵 𝐋𝐘𝐑𝐈𝐂𝐒 𝐅𝐈𝐍𝐃𝐄𝐑 🎵 ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ 📝 Usage:* .lyrics <song name>
*│❀ 🎤 Example:* .lyrics shape of you
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> *𝐏𝐫𝐨𝐯𝐢𝐝𝐞 𝐚 𝐬𝐨𝐧𝐠 𝐧𝐚𝐦𝐞⎯꯭̽* 🎵`);
        }

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        const result = await fetchLyrics(songTitle);
        
        if (!result.success || !result.lyrics || result.lyrics === 'No lyrics found') {
            return reply(faizanStyle('LYRICS', `"${songTitle}"`, '❌ No lyrics found'));
        }

        // Handle long lyrics (WhatsApp limit ~4096)
        let lyricsText = result.lyrics;
        if (lyricsText.length > 4000) {
            lyricsText = lyricsText.substring(0, 3950) + "\n\n... (truncated)";
        }

        const caption = `🎵 *${result.title}*\n👤 *Artist:* ${result.artist}\n\n📝 *Lyrics:*\n${lyricsText}`;

        if (result.image && result.image.startsWith('http')) {
            await conn.sendMessage(from, {
                image: { url: result.image },
                caption: caption
            }, { quoted: mek });
        } else {
            await reply(faizanStyle('LYRICS', `${result.title}\n👤 Artist: ${result.artist}`, '✅'));
            await conn.sendMessage(from, { text: `📝 *Lyrics:*\n\n${lyricsText}` }, { quoted: mek });
        }

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (err) {
        console.error('Lyrics Error:', err.message);
        reply(faizanStyle('ERROR', 'Failed to fetch lyrics', '❌'));
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
    }
});
