const { cmd } = require('../command');
const fs = require('fs');
const path = require('path');
const config = require('../config');


// Sudo list file path
const sudoFile = path.join(__dirname, '../assets/sudo.json');

// Ensure assets folder exists
if (!fs.existsSync(path.dirname(sudoFile))) {
    fs.mkdirSync(path.dirname(sudoFile), { recursive: true });
}

// Load sudo list
let sudoList = [];
if (fs.existsSync(sudoFile)) {
    try {
        sudoList = JSON.parse(fs.readFileSync(sudoFile, 'utf-8'));
    } catch (e) {
        sudoList = [];
        fs.writeFileSync(sudoFile, JSON.stringify([]));
    }
} else {
    fs.writeFileSync(sudoFile, JSON.stringify([]));
}

// Save sudo list
function saveSudoList() {
    fs.writeFileSync(sudoFile, JSON.stringify(sudoList, null, 2));
    console.log(`[SUDO] Saved ${sudoList.length} sudo users`);
}

// Check if user is sudo
function isSudo(userId) {
    const number = userId.split('@')[0];
    const result = sudoList.includes(number) || sudoList.includes(userId);
    console.log(`[SUDO] Check ${number}: ${result}`);
    return result;
}

// Add sudo user
function addSudo(userId) {
    const number = userId.split('@')[0];
    if (!sudoList.includes(number)) {
        sudoList.push(number);
        saveSudoList();
        console.log(`[SUDO] Added: ${number}`);
        return true;
    }
    console.log(`[SUDO] Already sudo: ${number}`);
    return false;
}

// Remove sudo user
function removeSudo(userId) {
    const number = userId.split('@')[0];
    if (sudoList.includes(number)) {
        sudoList = sudoList.filter(id => id !== number);
        saveSudoList();
        console.log(`[SUDO] Removed: ${number}`);
        return true;
    }
    console.log(`[SUDO] Not found: ${number}`);
    return false;
}

// Get sudo list
function getSudoList() {
    return sudoList;
}

function faizanStyle(title, value, status) {
    return `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || '𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃'} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ 👑 ${title}:* ${value}
*│❀ ⚙️ 𝐒𝐭𝐚𝐭𝐮𝐬:* ${status}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> ${config.DESCRIPTION || 'ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 🤍'}
`;
}

// ============ ADD SUDO ============
cmd({
    pattern: "addsudo",
    alias: ["makesudo", "sudo"],
    desc: "Add a user to sudo list",
    category: "owner",
    react: "👑",
    filename: __filename
},
async (conn, mek, m, { from, args, reply, isOwner }) => {
    try {
        if (!isOwner) {
            return reply(faizanStyle('ADD SUDO', 'Owner only', '❌'));
        }

        let target = null;
        
        if (m.quoted && m.quoted.sender) {
            target = m.quoted.sender;
        }
        else if (m.mentionedJid && m.mentionedJid[0]) {
            target = m.mentionedJid[0];
        }
        else if (args[0]) {
            let num = args[0].replace(/[^0-9]/g, '');
            if (num.length >= 10) {
                target = num + '@s.whatsapp.net';
            }
        }

        if (!target) {
            return reply(faizanStyle('ADD SUDO', 'Please mention/tag a user or reply to their message', '❌'));
        }

        const targetNumber = target.split('@')[0];
        
        if (isSudo(target)) {
            return reply(faizanStyle('ADD SUDO', `User @${targetNumber} is already sudo`, 'ℹ️'));
        }

        addSudo(target);
        
        await reply(faizanStyle('ADD SUDO', `User @${targetNumber} has been added to SUDO list\n\nThey can now use ALL bot commands`, '✅'));

    } catch (err) {
        console.error('Add sudo error:', err);
        reply(faizanStyle('ERROR', err.message, '❌'));
    }
});

// ============ REMOVE SUDO ============
cmd({
    pattern: "removesudo",
    alias: ["delsudo", "unsudo"],
    desc: "Remove a user from sudo list",
    category: "owner",
    react: "🔻",
    filename: __filename
},
async (conn, mek, m, { from, args, reply, isOwner }) => {
    try {
        if (!isOwner) {
            return reply(faizanStyle('REMOVE SUDO', 'Owner only', '❌'));
        }

        let target = null;
        
        if (m.quoted && m.quoted.sender) {
            target = m.quoted.sender;
        }
        else if (m.mentionedJid && m.mentionedJid[0]) {
            target = m.mentionedJid[0];
        }
        else if (args[0]) {
            let num = args[0].replace(/[^0-9]/g, '');
            if (num.length >= 10) {
                target = num + '@s.whatsapp.net';
            }
        }

        if (!target) {
            return reply(faizanStyle('REMOVE SUDO', 'Please mention/tag a user', '❌'));
        }

        const targetNumber = target.split('@')[0];
        
        if (!isSudo(target)) {
            return reply(faizanStyle('REMOVE SUDO', `User @${targetNumber} is not sudo`, 'ℹ️'));
        }

        removeSudo(target);
        
        await reply(faizanStyle('REMOVE SUDO', `User @${targetNumber} has been removed from SUDO list`, '✅'));

    } catch (err) {
        console.error('Remove sudo error:', err);
        reply(faizanStyle('ERROR', err.message, '❌'));
    }
});

// ============ SUDO LIST ============
cmd({
    pattern: "sudolist",
    alias: ["sudo", "sudos"],
    desc: "Show sudo users",
    category: "owner",
    react: "📋",
    filename: __filename
},
async (conn, mek, m, { from, reply, isOwner }) => {
    try {
        if (!isOwner) {
            return reply(faizanStyle('SUDO LIST', 'Owner only', '❌'));
        }

        if (sudoList.length === 0) {
            return reply(faizanStyle('SUDO LIST', 'No sudo users', 'ℹ️'));
        }

        let listText = `👑 *SUDO USERS (${sudoList.length})*\n\n`;
        sudoList.forEach((id, i) => {
            listText += `${i+1}. +${id}\n`;
        });

        await reply(faizanStyle('SUDO LIST', listText, '✅'));

    } catch (err) {
        console.error('Sudo list error:', err);
        reply(faizanStyle('ERROR', err.message, '❌'));
    }
});

// ============ CHECK SUDO ============
cmd({
    pattern: "checksudo",
    alias: ["sudo status", "issudo"],
    desc: "Check if user is sudo",
    category: "owner",
    react: "🔍",
    filename: __filename
},
async (conn, mek, m, { from, args, reply, isOwner }) => {
    try {
        if (!isOwner) {
            return reply(faizanStyle('CHECK SUDO', 'Owner only', '❌'));
        }

        let target = null;
        
        if (m.quoted && m.quoted.sender) {
            target = m.quoted.sender;
        }
        else if (m.mentionedJid && m.mentionedJid[0]) {
            target = m.mentionedJid[0];
        }
        else if (args[0]) {
            let num = args[0].replace(/[^0-9]/g, '');
            if (num.length >= 10) {
                target = num + '@s.whatsapp.net';
            }
        }

        if (!target) {
            return reply(faizanStyle('CHECK SUDO', 'Please mention/tag a user', '❌'));
        }

        const sudoStatus = isSudo(target);
        const status = sudoStatus ? '✅ SUDO USER' : '❌ NORMAL USER';
        
        await reply(faizanStyle('CHECK SUDO', `User @${target.split('@')[0]}\n\nStatus: ${status}`, sudoStatus ? '👑' : '👤'));

    } catch (err) {
        console.error('Check sudo error:', err);
        reply(faizanStyle('ERROR', err.message, '❌'));
    }
});

module.exports = { isSudo, addSudo, removeSudo, getSudoList };
