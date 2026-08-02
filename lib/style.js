const config = require('../config');

function faizanStyle({ title, quality, speed, status, type }) {

let lines = [];

if (title) lines.push(`*│❀ ${type || "📌"} 𝐓𝐢𝐭𝐥𝐞:* ${title}`);
if (quality) lines.push(`*│❀ 🎀 𝐐𝐮𝐚𝐥𝐢𝐭𝐲:* ${quality}`);
if (speed) lines.push(`*│❀ 🪄 𝐒𝐩𝐞𝐞𝐝:* ${speed}`);
if (status) lines.push(`*│❀ ⚙️ 𝐒𝐭𝐚𝐭𝐮𝐬:* ${status}`);

return `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
${lines.join('\n')}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ${config.OWNER_NAME} 🤍
`;
}

module.exports = { faizanStyle };
