const config = require('../config')
const { cmd, commands } = require('../command')
const { runtime } = require('../lib/functions')

// FAIZAN style formatter
function faizanStyle(title, value, status) {
    return `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || '𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃'} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ 📜 ${title}:* ${value}
*│❀ ⚙️ 𝐒𝐭𝐚𝐭𝐮𝐬:* ${status}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> ${config.DESCRIPTION || 'ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 🤍'}
`;
}

cmd({
    pattern: "list2",
    alias: ["listcmd", "commands2", "cmdlist"],
    desc: "Show all available commands with descriptions",
    category: "menu",
    react: "📜",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        // Show loading
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

        // Count total commands and aliases
        const commandsArray = Object.values(commands)
        const totalCommands = commandsArray.length
        let aliasCount = 0
        
        commandsArray.forEach(cmd => {
            if (cmd.alias) aliasCount += cmd.alias.length
        })

        // Get unique categories
        const categories = [...new Set(commandsArray.map(c => c.category))]

        // Build bot info section
        const botInfo = `
*│❀ 🤖 Bot Name:* ${config.BOT_NAME || 'FAIZAN-MD'}
*│❀ 👑 Owner:* ${config.OWNER_NAME || 'FAIZAN'}
*│❀ ⚙️ Prefix:* [${config.PREFIX || '.'}]
*│❀ 🌐 Platform:* ${process.env.PLATFORM || 'Server'}
*│❀ 📦 Version:* 5.0.0
*│❀ 🕒 Runtime:* ${runtime(process.uptime())}
`.trim()

        // Build stats section
        const statsInfo = `
*│❀ 📜 Total Commands:* ${totalCommands}
*│❀ 🔄 Total Aliases:* ${aliasCount}
*│❀ 🗂️ Categories:* ${categories.length}
`.trim()

        // Start building menu text
        let menuText = `*│❀ 🤖 BOT INFO*\n${botInfo}\n\n*│❀ 📊 STATS*\n${statsInfo}\n\n*│❀ 📋 COMMANDS BY CATEGORY*\n\n`

        // Organize commands by category
        const categorized = {}
        categories.forEach(cat => {
            categorized[cat] = commandsArray.filter(c => c.category === cat)
        })

        // Generate menu for each category
        for (const [category, cmds] of Object.entries(categorized)) {
            const catEmoji = getCategoryEmoji(category)
            menuText += `*│❀ ${catEmoji} ${category.toUpperCase()}* [${cmds.length} commands]\n`
            
            cmds.forEach(c => {
                menuText += `*│❀   └ .${c.pattern}*`
                if (c.alias && c.alias.length > 0) {
                    menuText += ` (${c.alias.map(a => `.${a}`).join(', ')})`
                }
                menuText += `\n`
                if (c.desc) {
                    menuText += `*│❀      └ ${c.desc}*\n`
                }
            })
            menuText += `\n`
        }

        menuText += `*│❀ 📝 Note:* Use .help <command> for detailed help\n`

        // Send with image
        await conn.sendMessage(
            from,
            {
                image: { url: config.MENU_IMAGE_URL || 'https://files.catbox.moe/npizv8.jpg' },
                caption: faizanStyle('COMMAND LIST', menuText, '✅'),
                contextInfo: {
                    mentionedJid: [m.sender],
                    forwardingScore: 999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363425143124298@newsletter',
                        newsletterName: config.BOT_NAME || 'FAIZAN-MD',
                        serverMessageId: 143
                    }
                }
            },
            { quoted: mek }
        )

        // Success reaction
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

    } catch (e) {
        console.error('Command List Error:', e)
        reply(faizanStyle('ERROR', e.message, '❌'))
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
    }
});

// Helper function to get emoji for category
function getCategoryEmoji(category) {
    const emojiMap = {
        'main': '🏠',
        'menu': '📜',
        'download': '📥',
        'downloader': '📥',
        'fun': '🎮',
        'game': '🎲',
        'games': '🎲',
        'group': '👥',
        'admin': '👥',
        'owner': '👑',
        'ai': '🤖',
        'tools': '🛠️',
        'utility': '🛠️',
        'convert': '🔄',
        'converter': '🔄',
        'search': '🔍',
        'info': 'ℹ️',
        'image': '🖼️',
        'sticker': '🎭',
        'stickers': '🎭',
        'anime': '🎎',
        'other': '📌',
        'misc': '📌',
        'whatsapp': '📱',
        'settings': '⚙️',
        'news': '📰'
    }
    return emojiMap[category.toLowerCase()] || '🔹'
          }
