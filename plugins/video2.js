const axios = require("axios");
const yts = require("yt-search");
const { cmd } = require("../command");

cmd({
    pattern: "video2",
    alias: ["ytmp4", "ytvideo"],
    react: "🎬",
    desc: "Download YouTube Video (360p)",
    category: "download",
    use: ".video <youtube link | search>",
    filename: __filename
},
async (conn, mek, m, { from, args, reply }) => {

    const query = args.join(" ").trim();
    if (!query) {
        return reply(`
╭ׂ┄•─̇─̣┄•─̇─̣┄•─̇─̣┄•─̇─̣╮
│ ╌─̇─̣⊰ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 _⁸⁷³ ⊱┈─̇─̣╌
│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣
│🎥 Video Name Ya Link Do
│
│Example:
│ .video Alan Walker Faded
╰┄•─̇─̣┄•─̇─̣┄•─̇─̣┄•─̇─̣╯
> ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 _⁸⁷³
`);
    }

    try {

        let videoUrl = "";

        // If link provided
        if (query.includes("youtube.com") || query.includes("youtu.be")) {
            videoUrl = query;
        } else {
            await reply("🔍 Searching video...");
            const search = await yts(query);
            if (!search.videos.length) {
                throw new Error("No videos found");
            }
            videoUrl = search.videos[0].url;
        }

        const api = `https://api.qasimdev.dpdns.org/api/loaderto/download?apiKey=qasim-dev&format=360&url=${encodeURIComponent(videoUrl)}`;

        await reply("⏳ Downloading... Please wait");

        const { data } = await axios.get(api, { timeout: 60000 });

        if (!data?.success || !data?.data?.downloadUrl) {
            throw new Error("API failed to fetch video");
        }

        const result = data.data;

        const caption =
`╭ׂ┄•─̇─̣┄•─̇─̣┄•─̇─̣┄•─̇─̣╮
│ ╌─̇─̣⊰ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 _⁸⁷³ ⊱┈─̇─̣╌
│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣
│🎬 ${result.title}
│
│🎚 Quality: ${result.quality}
╰┄•─̇─̣┄•─̇─̣┄•─̇─̣┄•─̇─̣╯
> ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 _⁸⁷³`;

        await conn.sendMessage(from, {
            video: { url: result.downloadUrl },
            mimetype: "video/mp4",
            caption
        }, { quoted: mek });

    } catch (error) {

        console.error("Video Plugin Error:", error.message);

        reply(`
╭ׂ┄•─̇─̣┄•─̇─̣┄•─̇─̣┄•─̇─̣╮
│ ╌─̇─̣⊰ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 _⁸⁷³ ⊱┈─̇─̣╌
│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣
│❌ Download Failed
│ ${error.message}
╰┄•─̇─̣┄•─̇─̣┄•─̇─̣┄•─̇─̣╯
> ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 _⁸⁷³
`);
    }

});
