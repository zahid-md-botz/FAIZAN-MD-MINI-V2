const fetch = require("node-fetch");
const axios = require("axios");
const { cmd } = require("../command");
const config = require("../config");

function faizanStyle(title, value, status) {
    return `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || '𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃'} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ 🎵 ${title}:* ${value}
*│❀ ⚙️ 𝐒𝐭𝐚𝐭𝐮𝐬:* ${status}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> ${config.DESCRIPTION || 'ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 🤍'}
`;
}

cmd({
  pattern: "tiktocsearch",
  alias: ["tiktos", "tiks", "ttsearch"],
  desc: "Search and download TikTok videos using a query.",
  react: '✅',
  category: 'tools',
  filename: __filename
}, async (conn, m, store, {
  from,
  args,
  reply
}) => {
  if (!args[0]) {
    return reply(faizanStyle(
      'TIKTOK SEARCH',
      'Please provide a search query\nExample: .tiks funny cats',
      '❌'
    ));
  }

  const query = args.join(" ");
  await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });
  await reply(faizanStyle('TIKTOK SEARCH', `Searching: "${query}"`, '🔄'));

  try {
    // Step 1: Google Search for TikTok video URLs via GiftedTech
    const searchRes = await axios.get('https://api.giftedtech.co.ke/api/search/google', {
      params: { apikey: 'gifted', query: `${query} site:tiktok.com/video` },
      timeout: 15000
    });

    const results = searchRes.data?.results || [];
    // Filter only actual video links
    const videoLinks = results
      .filter(r => r.link && r.link.includes('/video/'))
      .slice(0, 3);

    if (!videoLinks.length) {
      await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
      return reply(faizanStyle('TIKTOK SEARCH', `No TikTok videos found for: "${query}". Try different keywords.`, '❌'));
    }

    let sent = 0;
    for (const item of videoLinks) {
      try {
        // Step 2: Download each video via GiftedTech TikTok API
        const dlRes = await axios.get('https://api.giftedtech.co.ke/api/download/tiktok', {
          params: { apikey: 'gifted', url: item.link },
          timeout: 25000
        });

        const r = dlRes.data?.result;
        if (!r?.video) continue;

        const authorName = r.author?.name || 'Unknown';
        const caption = faizanStyle(
          'TIKTOK SEARCH',
          `🎬 ${(r.title || item.title || 'TikTok Video').substring(0, 80)}\n*│❀ 👤 Author:* ${authorName}\n*│❀ 🔗 URL:* ${item.link}`,
          '✅'
        );

        await conn.sendMessage(from, {
          video: { url: r.video },
          mimetype: 'video/mp4',
          caption
        }, { quoted: m });

        sent++;
        await new Promise(res => setTimeout(res, 1200));

      } catch (e) {
        console.error('[TikTokSearch] video failed:', e.message);
      }
    }

    if (sent === 0) {
      await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
      return reply(faizanStyle('TIKTOK SEARCH', 'Found results but failed to download videos.', '❌'));
    }

    await conn.sendMessage(from, { react: { text: '✅', key: m.key } });

  } catch (error) {
    console.error("Error in TikTokSearch:", error.message);
    await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
    reply(faizanStyle('TIKTOK SEARCH', error.message || 'Search failed', '❌'));
  }
});
