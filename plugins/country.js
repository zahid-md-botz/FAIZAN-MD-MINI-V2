const { cmd } = require('../command');
const axios = require('axios');
const config = require('../config');

// FAIZAN style formatter
function faizanStyle(title, value, status) {
    return `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || '𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃'} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ 🌍 ${title}:* ${value}
*│❀ ⚙️ 𝐒𝐭𝐚𝐭𝐮𝐬:* ${status}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> ${config.DESCRIPTION || 'ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 🤍'}
`;
}

cmd({
    pattern: "country",
    alias: ["countryinfo", "nation", "cinfo"],
    desc: "Get detailed information about a country",
    category: "tools",
    react: "🌍",
    filename: __filename
}, async (conn, mek, m, { from, args, reply }) => {
    try {
        const countryName = args.join(" ");
        
        if (!countryName) {
            return reply(faizanStyle('Country Info', 'Please enter a country name\nExample: .country Pakistan', '❌'));
        }

        // Show loading
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

        // Fetch data from API
        const apiUrl = `https://api.mrfrankofc.gleeze.com/api/tools/countryInfo?name=${encodeURIComponent(countryName)}`;
        const res = await axios.get(apiUrl);

        if (!res.data.status || !res.data.data) {
            return reply(faizanStyle('Country Info', `No information found for "${countryName}"`, '❌'));
        }

        const c = res.data.data;

        // Build country info in FAIZAN style
        const countryInfo = `
*│❀ 🏷️ Name:* ${c.name}
*│❀ 🏛️ Capital:* ${c.capital || 'N/A'}
*│❀ 📍 Continent:* ${c.continent.name} ${c.continent.emoji || ''}
*│❀ 📞 Phone Code:* ${c.phoneCode || 'N/A'}
*│❀ 💰 Currency:* ${c.currency || 'N/A'}
*│❀ 🚗 Driving Side:* ${c.drivingSide || 'N/A'}
*│❀ 🗺️ Area:* ${c.area?.squareKilometers?.toLocaleString() || 'N/A'} km²
*│❀ 🌐 TLD:* ${c.internetTLD || 'N/A'}
*│❀ 📦 Form:* ${c.constitutionalForm || 'N/A'}
*│❀ 🦎 Famous For:* ${c.famousFor || 'N/A'}
*│❀ 🗣️ Languages:* ${c.languages?.native?.join(", ") || 'N/A'}
*│❀ 🔤 ISO Codes:* ${c.isoCode?.alpha2?.toUpperCase() || 'N/A'} / ${c.isoCode?.alpha3?.toUpperCase() || 'N/A'}
`.trim();

        // Send flag image + caption
        await conn.sendMessage(from, {
            image: { url: c.flag },
            caption: faizanStyle('COUNTRY INFO', countryInfo, '✅')
        }, { quoted: mek });

        // Success reaction
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

    } catch (err) {
        console.error("❌ Error fetching country info:", err.message);
        
        await reply(faizanStyle('Country Info', 'Failed to connect to API', '❌'));
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
    }
});
