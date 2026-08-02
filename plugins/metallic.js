const { cmd } = require('../command');
const mumaker = require('mumaker');
const config = require('../config');


function faizanStyle(title, value, status) {
    return `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || '𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃'} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ 🎨 ${title}:* ${value}
*│❀ ⚙️ 𝐒𝐭𝐚𝐭𝐮𝐬:* ${status}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> ${config.DESCRIPTION || 'ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 🤍'}
`;
}

// Style configurations
const styles = {
    metallic: {
        url: "https://en.ephoto360.com/impressive-decorative-3d-metal-text-effect-798.html",
        emoji: "🔥",
        name: "METALLIC"
    },
    ice: {
        url: "https://en.ephoto360.com/ice-text-effect-online-101.html",
        emoji: "❄️",
        name: "ICE"
    },
    snow: {
        url: "https://en.ephoto360.com/create-a-snow-3d-text-effect-free-online-621.html",
        emoji: "☃️",
        name: "SNOW"
    },
    impressive: {
        url: "https://en.ephoto360.com/create-3d-colorful-paint-text-effect-online-801.html",
        emoji: "🎨",
        name: "IMPRESSIVE"
    },
    matrix: {
        url: "https://en.ephoto360.com/matrix-text-effect-154.html",
        emoji: "💻",
        name: "MATRIX"
    },
    light: {
        url: "https://en.ephoto360.com/light-text-effect-futuristic-technology-style-648.html",
        emoji: "💡",
        name: "LIGHT"
    },
    neon: {
        url: "https://en.ephoto360.com/create-colorful-neon-light-text-effects-online-797.html",
        emoji: "🌈",
        name: "NEON"
    },
    devil: {
        url: "https://en.ephoto360.com/neon-devil-wings-text-effect-online-683.html",
        emoji: "😈",
        name: "DEVIL"
    },
    purple: {
        url: "https://en.ephoto360.com/purple-text-effect-online-100.html",
        emoji: "💜",
        name: "PURPLE"
    },
    thunder: {
        url: "https://en.ephoto360.com/thunder-text-effect-online-97.html",
        emoji: "⚡",
        name: "THUNDER"
    },
    leaves: {
        url: "https://en.ephoto360.com/green-brush-text-effect-typography-maker-online-153.html",
        emoji: "🍃",
        name: "LEAVES"
    },
    "1917": {
        url: "https://en.ephoto360.com/1917-style-text-effect-523.html",
        emoji: "📽️",
        name: "1917"
    },
    arena: {
        url: "https://en.ephoto360.com/create-cover-arena-of-valor-by-mastering-360.html",
        emoji: "🎮",
        name: "ARENA"
    },
    hacker: {
        url: "https://en.ephoto360.com/create-anonymous-hacker-avatars-cyan-neon-677.html",
        emoji: "👨‍💻",
        name: "HACKER"
    },
    sand: {
        url: "https://en.ephoto360.com/write-names-and-messages-on-the-sand-online-582.html",
        emoji: "🏖️",
        name: "SAND"
    },
    blackpink: {
        url: "https://en.ephoto360.com/create-a-blackpink-style-logo-with-members-signatures-810.html",
        emoji: "🎤",
        name: "BLACKPINK"
    },
    glitch: {
        url: "https://en.ephoto360.com/create-digital-glitch-text-effects-online-767.html",
        emoji: "📺",
        name: "GLITCH"
    },
    fire: {
        url: "https://en.ephoto360.com/flame-lettering-effect-372.html",
        emoji: "🔥",
        name: "FIRE"
    }
};

// Generate command for each style
async function generateText(conn, from, mek, style, text, reply) {
    try {
        const styleData = styles[style];
        if (!styleData) throw new Error('Invalid style');

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        await reply(faizanStyle(styleData.name, `Processing: ${text}`, '🔍'));

        const result = await mumaker.ephoto(styleData.url, text);
        
        if (!result?.image) throw new Error('No image generated');

        await conn.sendMessage(from, {
            image: { url: result.image },
            caption: faizanStyle(styleData.name, `Text: ${text}`, '✅')
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

    } catch (err) {
        console.error(`${style} error:`, err);
        await reply(faizanStyle(style.toUpperCase(), err.message || 'Failed', '❌'));
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
    }
}

// ============ COMMANDS ============

cmd({
    pattern: "metallic",
    alias: ["metal", "metallictxt"],
    desc: "Create metallic 3D text effect",
    category: "fun",
    react: "🔥",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply(faizanStyle('METALLIC', 'Please provide text\nExample: .metallic FAIZAN', '❌'));
    await generateText(conn, from, mek, 'metallic', q, reply);
});

cmd({
    pattern: "ice",
    alias: ["icetxt", "iceeffect"],
    desc: "Create ice text effect",
    category: "fun",
    react: "❄️",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply(faizanStyle('ICE', 'Please provide text\nExample: .ice FAIZAN', '❌'));
    await generateText(conn, from, mek, 'ice', q, reply);
});

cmd({
    pattern: "snow",
    alias: ["snowtxt", "snoweffect"],
    desc: "Create snow text effect",
    category: "fun",
    react: "☃️",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply(faizanStyle('SNOW', 'Please provide text\nExample: .snow FAIZAN', '❌'));
    await generateText(conn, from, mek, 'snow', q, reply);
});

cmd({
    pattern: "impressive",
    alias: ["impressivetxt", "impressiveeffect"],
    desc: "Create impressive colorful paint effect",
    category: "fun",
    react: "🎨",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply(faizanStyle('IMPRESSIVE', 'Please provide text\nExample: .impressive FAIZAN', '❌'));
    await generateText(conn, from, mek, 'impressive', q, reply);
});

cmd({
    pattern: "matrix",
    alias: ["matrixcode", "matrixeffect"],
    desc: "Create matrix code text effect",
    category: "fun",
    react: "💻",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply(faizanStyle('MATRIX', 'Please provide text\nExample: .matrix FAIZAN', '❌'));
    await generateText(conn, from, mek, 'matrix', q, reply);
});

cmd({
    pattern: "light",
    alias: ["lighttxt", "lighteffect"],
    desc: "Create futuristic light text effect",
    category: "fun",
    react: "💡",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply(faizanStyle('LIGHT', 'Please provide text\nExample: .light FAIZAN', '❌'));
    await generateText(conn, from, mek, 'light', q, reply);
});

cmd({
    pattern: "neon",
    alias: ["neontxt", "neoneffect"],
    desc: "Create colorful neon light text effect",
    category: "fun",
    react: "🌈",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply(faizanStyle('NEON', 'Please provide text\nExample: .neon FAIZAN', '❌'));
    await generateText(conn, from, mek, 'neon', q, reply);
});

cmd({
    pattern: "devil",
    alias: ["deviltxt", "devileffect"],
    desc: "Create devil wings neon text effect",
    category: "fun",
    react: "😈",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply(faizanStyle('DEVIL', 'Please provide text\nExample: .devil FAIZAN', '❌'));
    await generateText(conn, from, mek, 'devil', q, reply);
});

cmd({
    pattern: "purple",
    alias: ["purpletxt", "purpleeffect"],
    desc: "Create purple text effect",
    category: "fun",
    react: "💜",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply(faizanStyle('PURPLE', 'Please provide text\nExample: .purple FAIZAN', '❌'));
    await generateText(conn, from, mek, 'purple', q, reply);
});

cmd({
    pattern: "thunder",
    alias: ["thundertxt", "thundereffect"],
    desc: "Create thunder text effect",
    category: "fun",
    react: "⚡",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply(faizanStyle('THUNDER', 'Please provide text\nExample: .thunder FAIZAN', '❌'));
    await generateText(conn, from, mek, 'thunder', q, reply);
});

cmd({
    pattern: "leaves",
    alias: ["leavestxt", "leaveseffect"],
    desc: "Create green brush text effect",
    category: "fun",
    react: "🍃",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply(faizanStyle('LEAVES', 'Please provide text\nExample: .leaves FAIZAN', '❌'));
    await generateText(conn, from, mek, 'leaves', q, reply);
});

cmd({
    pattern: "1917",
    alias: ["style1917", "vintage"],
    desc: "Create 1917 vintage style text effect",
    category: "fun",
    react: "📽️",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply(faizanStyle('1917', 'Please provide text\nExample: .1917 FAIZAN', '❌'));
    await generateText(conn, from, mek, '1917', q, reply);
});

cmd({
    pattern: "arena",
    alias: ["arenatxt", "arenaeffect"],
    desc: "Create Arena of Valor cover text effect",
    category: "fun",
    react: "🎮",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply(faizanStyle('ARENA', 'Please provide text\nExample: .arena FAIZAN', '❌'));
    await generateText(conn, from, mek, 'arena', q, reply);
});

cmd({
    pattern: "hacker",
    alias: ["hackertxt", "hackereffect"],
    desc: "Create anonymous hacker avatar text effect",
    category: "fun",
    react: "👨‍💻",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply(faizanStyle('HACKER', 'Please provide text\nExample: .hacker FAIZAN', '❌'));
    await generateText(conn, from, mek, 'hacker', q, reply);
});

cmd({
    pattern: "sand",
    alias: ["sandtxt", "sandeffect"],
    desc: "Create sand writing text effect",
    category: "fun",
    react: "🏖️",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply(faizanStyle('SAND', 'Please provide text\nExample: .sand FAIZAN', '❌'));
    await generateText(conn, from, mek, 'sand', q, reply);
});

cmd({
    pattern: "blackpink",
    alias: ["bptxt", "blackpinkeffect"],
    desc: "Create Blackpink style logo effect",
    category: "fun",
    react: "🎤",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply(faizanStyle('BLACKPINK', 'Please provide text\nExample: .blackpink FAIZAN', '❌'));
    await generateText(conn, from, mek, 'blackpink', q, reply);
});

cmd({
    pattern: "glitch",
    alias: ["glitchtxt", "glitcheffect"],
    desc: "Create digital glitch text effect",
    category: "fun",
    react: "📺",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply(faizanStyle('GLITCH', 'Please provide text\nExample: .glitch FAIZAN', '❌'));
    await generateText(conn, from, mek, 'glitch', q, reply);
});

cmd({
    pattern: "fire",
    alias: ["firetxt", "fireeffect"],
    desc: "Create flaming fire text effect",
    category: "fun",
    react: "🔥",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply(faizanStyle('FIRE', 'Please provide text\nExample: .fire FAIZAN', '❌'));
    await generateText(conn, from, mek, 'fire', q, reply);
});

// Menu command to show all styles
cmd({
    pattern: "textstyles",
    alias: ["txtstyles", "textmaker"],
    desc: "Show all available text styles",
    category: "fun",
    react: "📜",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    let styleList = `🎨 *AVAILABLE TEXT STYLES*\n\n`;
    styleList += `│❀ 🔥 .metallic - 3D Metal Effect\n`;
    styleList += `│❀ ❄️ .ice - Ice Cold Effect\n`;
    styleList += `│❀ ☃️ .snow - Snow Effect\n`;
    styleList += `│❀ 🎨 .impressive - Colorful Paint\n`;
    styleList += `│❀ 💻 .matrix - Matrix Code\n`;
    styleList += `│❀ 💡 .light - Futuristic Light\n`;
    styleList += `│❀ 🌈 .neon - Colorful Neon\n`;
    styleList += `│❀ 😈 .devil - Devil Wings\n`;
    styleList += `│❀ 💜 .purple - Purple Theme\n`;
    styleList += `│❀ ⚡ .thunder - Thunder Effect\n`;
    styleList += `│❀ 🍃 .leaves - Green Brush\n`;
    styleList += `│❀ 📽️ .1917 - Vintage Style\n`;
    styleList += `│❀ 🎮 .arena - Arena of Valor\n`;
    styleList += `│❀ 👨‍💻 .hacker - Anonymous Hacker\n`;
    styleList += `│❀ 🏖️ .sand - Sand Writing\n`;
    styleList += `│❀ 🎤 .blackpink - Blackpink Style\n`;
    styleList += `│❀ 📺 .glitch - Digital Glitch\n`;
    styleList += `│❀ 🔥 .fire - Flaming Letters\n\n`;
    styleList += `*Usage:* .<style> <text>\n`;
    styleList += `*Example:* .metallic FAIZAN`;

    await reply(faizanStyle('TEXT STYLES', styleList, '✅'));
});
